import { readFileSync } from "node:fs";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadBaseline } from "#compare";
import { HOTSPOT_SCANNER_CONFIG_FILENAME } from "../src/config/index.js";
import { formatExemplarConfig } from "../src/config/exemplar.js";
import { stripAnsi } from "../src/report/color.js";
import * as report from "#report";
import * as scan from "#scan";
import {
  CliExitError,
  CliUsageError,
  collectGlob,
  collectOnlySection,
  createCliProgram,
  DEFAULT_BASELINE_OUTPUT,
  deriveCsvStem,
  parseFormat,
  parseGranularity,
  parseOnlySectionCli,
  parsePositiveInteger,
  resolvePackageVersion,
  resolveTableColor,
  runCli,
  validateBaselinePath,
  validateExplainTarget,
  validateOutputPath,
  validateScopePatterns,
} from "./hotspot-scanner.js";

const smallTsFixture = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../tests/fixtures/repos/small-ts",
);

const packageVersion = (
  JSON.parse(
    readFileSync(
      join(fileURLToPath(new URL(".", import.meta.url)), "../package.json"),
      "utf8",
    ),
  ) as { version: string }
).version;

const triageFixturePath = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../tests/fixtures/report/sample-result.json",
);

function loadTriageFixture() {
  const raw = JSON.parse(readFileSync(triageFixturePath, "utf8")) as {
    _comment?: string;
    version: string;
    hotspots: unknown[];
    functions: unknown[];
    coupling: unknown[];
    meta: {
      since: string;
      scannedAt: string;
      granularity: "file";
      warnings?: unknown[];
    };
  };
  const { _comment: _ignored, ...fixture } = raw;
  void _ignored;
  return fixture;
}

function mockScanResult() {
  return {
    version: "1.0",
    hotspots: [
      {
        filePath: "src/example.ts",
        hotspotScore: 0.88,
        complexityNormalized: 0.9,
        churnNormalized: 0.85,
        cyclomaticComplexity: 42,
        functionCount: 8,
        commitCount: 15,
        linesChanged: 320,
        authorCount: 3,
      },
    ],
    functions: [],
    coupling: [],
    meta: {
      since: "12 months ago",
      scannedAt: "2026-01-01T00:00:00.000Z",
      granularity: "file",
      warnings: [],
    },
  };
}

async function createIsolatedSmallTsRepo(): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), "hotspot-cli-config-"));
  await cp(smallTsFixture, tempDir, { recursive: true });
  return tempDir;
}

function getScanHelpText(): string {
  const program = createCliProgram();
  const scan = program.commands.find((command) => command.name() === "scan");
  const chunks: string[] = [];
  scan?.configureOutput({
    writeOut: (str) => {
      chunks.push(str);
    },
    writeErr: (str) => {
      chunks.push(str);
    },
  });
  scan?.outputHelp();
  return chunks.join("");
}

function captureStdout(): { chunks: string[]; restore: () => void } {
  const chunks: string[] = [];
  const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    chunks.push(String(chunk));
    return true;
  });
  return {
    chunks,
    restore: () => spy.mockRestore(),
  };
}

describe("hotspot-scanner CLI parsing", () => {
  it("parseFormat accepts table, json, markdown, and csv", () => {
    expect(parseFormat("table")).toBe("table");
    expect(parseFormat("json")).toBe("json");
    expect(parseFormat("markdown")).toBe("markdown");
    expect(parseFormat("csv")).toBe("csv");
  });

  it("parseFormat rejects invalid values", () => {
    expect(() => parseFormat("xml")).toThrow(CliUsageError);
    expect(() => parseFormat("xml")).toThrow(/Invalid --format/);
    expect(() => parseFormat("xml")).toThrow(/table, json, markdown, or csv/);
  });

  it("parseGranularity accepts file and function", () => {
    expect(parseGranularity("file")).toBe("file");
    expect(parseGranularity("function")).toBe("function");
  });

  it("parseGranularity rejects invalid values", () => {
    expect(() => parseGranularity("module")).toThrow(CliUsageError);
    expect(() => parseGranularity("module")).toThrow(/Invalid --granularity/);
    expect(() => parseGranularity("module")).toThrow(/file or function/);
  });

  it("parsePositiveInteger accepts positive integers", () => {
    expect(parsePositiveInteger("20", "--top")).toBe(20);
    expect(parsePositiveInteger("3", "--min-cochange")).toBe(3);
  });

  it("parsePositiveInteger rejects non-positive values", () => {
    expect(() => parsePositiveInteger("0", "--top")).toThrow(CliUsageError);
    expect(() => parsePositiveInteger("abc", "--top")).toThrow(
      /--top must be a positive integer/,
    );
  });
});

describe("createCliProgram", () => {
  it("exposes root --version / -V from package.json", () => {
    const program = createCliProgram();

    expect(program.version()).toBe(packageVersion);
    expect(program.options.map((option) => option.short)).toContain("-V");
    expect(program.options.map((option) => option.long)).toContain("--version");
  });

  it("exposes scan command with defaults", () => {
    const program = createCliProgram();
    const scan = program.commands.find((command) => command.name() === "scan");

    expect(scan).toBeDefined();
    expect(scan?.name()).toBe("scan");
    expect(scan?.options.map((option) => option.long)).toEqual(
      expect.arrayContaining([
        "--since",
        "--format",
        "--output",
        "--top",
        "--min-cochange",
        "--concurrency",
        "--include",
        "--exclude",
        "--baseline",
        "--config",
        "--quiet",
        "--no-progress",
        "--only",
        "--no-triage-hints",
        "--no-color",
        "--explain",
      ]),
    );
  });

  it("scan help lists --explain", () => {
    const help = getScanHelpText();

    expect(help).toContain("--explain");
    expect(help).toMatch(/score breakdown/);
  });

  it("scan help lists --config", () => {
    const program = createCliProgram();
    const scan = program.commands.find((command) => command.name() === "scan");

    expect(scan?.helpInformation()).toContain("--config");
  });

  it("scan help documents optional path with default .", () => {
    const program = createCliProgram();
    const scan = program.commands.find((command) => command.name() === "scan");

    const help = scan?.helpInformation() ?? "";
    expect(help).toMatch(/\[path\]/);
    expect(help).toMatch(/default: \./);
  });

  it("scan help includes Examples block with cwd, JSON+output, and aliases", () => {
    const help = getScanHelpText();
    expect(help).toContain("Examples:");
    expect(help).toContain("hotspot-scanner scan");
    expect(help).toMatch(/-f json -o report\.json/);
    expect(help).toMatch(/-f table -t 10 -g function/);
    expect(help).toMatch(/--baseline prior\.json/);
  });

  it("scan help warns that filtered JSON is not a baseline", () => {
    const help = getScanHelpText();

    expect(help).toMatch(/--only.*not suitable as a --baseline/i);
  });

  it("scan help lists short and long forms for aliased flags", () => {
    const program = createCliProgram();
    const scan = program.commands.find((command) => command.name() === "scan");

    const help = scan?.helpInformation() ?? "";
    expect(help).toMatch(/-f, --format/);
    expect(help).toMatch(/-o, --output/);
    expect(help).toMatch(/-t, --top/);
    expect(help).toMatch(/-g, --granularity/);
  });

  it("exposes short aliases on scan options", () => {
    const program = createCliProgram();
    const scan = program.commands.find((command) => command.name() === "scan");

    expect(scan?.options.map((option) => option.short)).toEqual(
      expect.arrayContaining(["-f", "-o", "-t", "-g"]),
    );
    expect(scan?.options.map((option) => option.long)).toEqual(
      expect.arrayContaining([
        "--format",
        "--output",
        "--top",
        "--granularity",
        "--dry-run",
      ]),
    );
  });

  it("exposes init command", () => {
    const program = createCliProgram();
    const init = program.commands.find((command) => command.name() === "init");

    expect(init).toBeDefined();
    expect(init?.options.map((option) => option.long)).toContain("--force");
  });

  it("exposes doctor command with --config", () => {
    const program = createCliProgram();
    const doctor = program.commands.find(
      (command) => command.name() === "doctor",
    );

    expect(doctor).toBeDefined();
    expect(doctor?.options.map((option) => option.long)).toContain("--config");
  });

  it("root help mentions init and doctor commands", () => {
    const program = createCliProgram();

    expect(program.helpInformation()).toContain("init");
    expect(program.helpInformation()).toContain("doctor");
  });

  it("scan help lists --dry-run", () => {
    const help = getScanHelpText();

    expect(help).toContain("--dry-run");
  });

  it("exposes baseline save command with scan options", () => {
    const program = createCliProgram();
    const baseline = program.commands.find(
      (command) => command.name() === "baseline",
    );
    const save = baseline?.commands.find((command) => command.name() === "save");

    expect(baseline).toBeDefined();
    expect(save).toBeDefined();
    expect(save?.options.map((option) => option.long)).toEqual(
      expect.arrayContaining([
        "--output",
        "--since",
        "--granularity",
        "--top",
        "--min-cochange",
        "--concurrency",
        "--include",
        "--exclude",
        "--config",
      ]),
    );
    expect(save?.options.map((option) => option.long)).not.toContain(
      "--format",
    );
    expect(save?.options.map((option) => option.long)).not.toContain(
      "--baseline",
    );
  });

  it("baseline save help documents default output path and overwrite", () => {
    const program = createCliProgram();
    const baseline = program.commands.find(
      (command) => command.name() === "baseline",
    );
    const save = baseline?.commands.find((command) => command.name() === "save");
    const chunks: string[] = [];
    save?.configureOutput({
      writeOut: (str) => {
        chunks.push(str);
      },
      writeErr: (str) => {
        chunks.push(str);
      },
    });
    save?.outputHelp();
    const help = chunks.join("");

    expect(help).toContain(DEFAULT_BASELINE_OUTPUT);
    expect(help).toMatch(/overwritten without prompt/i);
  });

  it("exposes compare command with required --baseline and scan options", () => {
    const program = createCliProgram();
    const compare = program.commands.find(
      (command) => command.name() === "compare",
    );

    expect(compare).toBeDefined();
    expect(compare?.name()).toBe("compare");
    const baselineOption = compare?.options.find(
      (option) => option.long === "--baseline",
    );
    expect(baselineOption?.required).toBe(true);
    expect(compare?.options.map((option) => option.long)).toEqual(
      expect.arrayContaining([
        "--baseline",
        "--format",
        "--output",
        "--top",
        "--since",
        "--granularity",
        "--min-cochange",
        "--concurrency",
        "--include",
        "--exclude",
        "--config",
        "--quiet",
        "--no-progress",
        "--only",
        "--no-triage-hints",
        "--no-color",
      ]),
    );
    expect(compare?.options.map((option) => option.long)).not.toContain(
      "--dry-run",
    );
    expect(compare?.options.map((option) => option.long)).not.toContain(
      "--explain",
    );
  });

  it("compare help documents required --baseline", () => {
    const program = createCliProgram();
    const compare = program.commands.find(
      (command) => command.name() === "compare",
    );
    const chunks: string[] = [];
    compare?.configureOutput({
      writeOut: (str) => {
        chunks.push(str);
      },
      writeErr: (str) => {
        chunks.push(str);
      },
    });
    compare?.outputHelp();
    const help = chunks.join("");

    expect(help).toMatch(/--baseline.*required/i);
    expect(help).toContain("Baseline ScanResult JSON");
    expect(help).toContain("Examples:");
    expect(help).toMatch(/compare --baseline/);
  });
});

describe("collectGlob", () => {
  it("appends patterns to the accumulator", () => {
    expect(collectGlob("src/**", [])).toEqual(["src/**"]);
    expect(collectGlob("lib/**", ["src/**"])).toEqual(["src/**", "lib/**"]);
  });

  it("rejects empty patterns", () => {
    expect(() => collectGlob("", [])).toThrow(CliUsageError);
  });
});

describe("parseOnlySectionCli", () => {
  it("accepts hotspots, coupling, and functions", () => {
    expect(parseOnlySectionCli("hotspots")).toBe("hotspots");
    expect(parseOnlySectionCli("coupling")).toBe("coupling");
    expect(parseOnlySectionCli("functions")).toBe("functions");
  });

  it("rejects invalid and empty values", () => {
    expect(() => parseOnlySectionCli("bogus")).toThrow(CliUsageError);
    expect(() => parseOnlySectionCli("bogus")).toThrow(
      /Invalid --only: bogus\. Expected hotspots, coupling, or functions\./,
    );
    expect(() => parseOnlySectionCli("")).toThrow(CliUsageError);
    expect(() => parseOnlySectionCli("")).toThrow(
      /--only section must not be empty/,
    );
  });
});

describe("collectOnlySection", () => {
  it("accumulates valid sections", () => {
    expect(collectOnlySection("hotspots", [])).toEqual(["hotspots"]);
    expect(collectOnlySection("coupling", ["hotspots"])).toEqual([
      "hotspots",
      "coupling",
    ]);
  });

  it("rejects invalid sections", () => {
    expect(() => collectOnlySection("foo", [])).toThrow(CliUsageError);
  });
});

describe("resolveTableColor", () => {
  const enabledBase = {
    format: "table" as const,
    noColor: false,
    envNoColor: undefined,
    stdoutIsTTY: true,
  };

  it("enables color for table stdout on a TTY", () => {
    expect(resolveTableColor(enabledBase)).toBe(true);
  });

  it("disables color for non-table formats", () => {
    expect(
      resolveTableColor({ ...enabledBase, format: "json" }),
    ).toBe(false);
    expect(
      resolveTableColor({ ...enabledBase, format: "markdown" }),
    ).toBe(false);
    expect(
      resolveTableColor({ ...enabledBase, format: "csv" }),
    ).toBe(false);
  });

  it("disables color for --no-color, NO_COLOR, --output, and non-TTY", () => {
    expect(resolveTableColor({ ...enabledBase, noColor: true })).toBe(false);
    expect(
      resolveTableColor({ ...enabledBase, envNoColor: "1" }),
    ).toBe(false);
    expect(
      resolveTableColor({ ...enabledBase, outputPath: "/tmp/out.txt" }),
    ).toBe(false);
    expect(
      resolveTableColor({ ...enabledBase, stdoutIsTTY: false }),
    ).toBe(false);
    expect(
      resolveTableColor({ ...enabledBase, stdoutIsTTY: undefined }),
    ).toBe(false);
  });

  it("allows color when NO_COLOR is empty", () => {
    expect(resolveTableColor({ ...enabledBase, envNoColor: "" })).toBe(true);
  });
});

describe("validateScopePatterns", () => {
  it("rejects empty patterns", () => {
    expect(() => validateScopePatterns([""], "--include")).toThrow(
      CliUsageError,
    );
  });
});

describe("validateOutputPath", () => {
  it("rejects empty path", async () => {
    await expect(validateOutputPath("")).rejects.toThrow(CliUsageError);
    await expect(validateOutputPath("")).rejects.toThrow(
      /--output path must not be empty/,
    );
  });

  it("rejects directory path", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-test-"));
    try {
      await expect(validateOutputPath(tempDir)).rejects.toThrow(CliUsageError);
      await expect(validateOutputPath(tempDir)).rejects.toThrow(
        /--output path is a directory/,
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects missing parent directory", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-test-"));
    const missingParent = join(tempDir, "missing", "report.json");
    try {
      await expect(validateOutputPath(missingParent)).rejects.toThrow(
        CliUsageError,
      );
      await expect(validateOutputPath(missingParent)).rejects.toThrow(
        /--output parent directory does not exist/,
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("accepts valid path in existing directory", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-test-"));
    const outputPath = join(tempDir, "report.json");
    try {
      await expect(validateOutputPath(outputPath)).resolves.toBeUndefined();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe("validateBaselinePath", () => {
  it("rejects empty path", async () => {
    await expect(validateBaselinePath("")).rejects.toThrow(CliUsageError);
    await expect(validateBaselinePath("")).rejects.toThrow(
      /--baseline path must not be empty/,
    );
  });

  it("rejects directory path", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-test-"));
    try {
      await expect(validateBaselinePath(tempDir)).rejects.toThrow(
        CliUsageError,
      );
      await expect(validateBaselinePath(tempDir)).rejects.toThrow(
        /--baseline path is a directory/,
      );
      await expect(validateBaselinePath(tempDir)).rejects.toThrow(
        /--format json --output/,
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects missing file", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-test-"));
    const missingPath = join(tempDir, "missing-baseline.json");
    try {
      await expect(validateBaselinePath(missingPath)).rejects.toThrow(
        CliUsageError,
      );
      await expect(validateBaselinePath(missingPath)).rejects.toThrow(
        /--baseline file does not exist/,
      );
      await expect(validateBaselinePath(missingPath)).rejects.toThrow(
        /--format json --output/,
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("accepts valid baseline file", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-test-"));
    const baselinePath = join(tempDir, "baseline.json");
    await writeFile(baselinePath, "{}", "utf8");
    try {
      await expect(validateBaselinePath(baselinePath)).resolves.toBeUndefined();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe("resolvePackageVersion", () => {
  it("matches package.json version field", () => {
    expect(resolvePackageVersion()).toBe(packageVersion);
  });
});

describe("validateExplainTarget", () => {
  it("rejects path:function targets in file granularity", () => {
    expect(() =>
      validateExplainTarget(
        { kind: "function", filePath: "src/a.ts", functionName: "run" },
        "file",
      ),
    ).toThrow(CliUsageError);
    expect(() =>
      validateExplainTarget(
        { kind: "function", filePath: "src/a.ts", functionName: "run" },
        "file",
      ),
    ).toThrow(/--granularity function/);
  });

  it("allows path:function targets in function granularity", () => {
    expect(() =>
      validateExplainTarget(
        { kind: "function", filePath: "src/a.ts", functionName: "run" },
        "function",
      ),
    ).not.toThrow();
  });

  it("allows plain file paths in file granularity", () => {
    expect(() =>
      validateExplainTarget({ kind: "file", filePath: "src/a.ts" }, "file"),
    ).not.toThrow();
  });
});

describe("runCli", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints package version for --version without running scan", async () => {
    const runScanSpy = vi.spyOn(scan, "runScan");
    const { chunks } = captureStdout();

    await runCli(["node", "hotspot-scanner", "--version"]);

    expect(chunks.join("")).toContain(packageVersion);
    expect(runScanSpy).not.toHaveBeenCalled();
  });

  it("prints package version for -V without running scan", async () => {
    const runScanSpy = vi.spyOn(scan, "runScan");
    const { chunks } = captureStdout();

    await runCli(["node", "hotspot-scanner", "-V"]);

    expect(chunks.join("")).toContain(packageVersion);
    expect(runScanSpy).not.toHaveBeenCalled();
  });

  it("prints table on successful scan", async () => {
    vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "1.0",
      hotspots: [
        {
          filePath: "src/example.ts",
          hotspotScore: 1,
          complexityNormalized: 1,
          churnNormalized: 1,
          cyclomaticComplexity: 10,
          functionCount: 2,
          commitCount: 5,
          linesChanged: 100,
          authorCount: 1,
        },
      ],
      functions: [],
      coupling: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "file",
      },
    });
    const { chunks } = captureStdout();

    await runCli(["node", "hotspot-scanner", "scan", ".", "--format", "table"]);

    const output = chunks.join("");
    expect(output).toContain("Scan window:");
    expect(output).toContain("Top Hotspots");
    expect(output).toContain("Top Coupling Pairs");
  });

  it("prints JSON on successful scan", async () => {
    vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "1.0",
      hotspots: [],
      functions: [],
      coupling: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "file",
      },
    });
    const { chunks } = captureStdout();

    await runCli(["node", "hotspot-scanner", "scan", ".", "--format", "json"]);

    const parsed = JSON.parse(chunks.join("")) as { version: string };
    expect(parsed.version).toBe("1.0");
  });

  it("forwards scan callbacks to diagnostics", async () => {
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(scan, "runScan").mockImplementation(async (options) => {
      options.onProgress?.({
        phase: "git",
        commitsProcessed: 1000,
      });
      return {
        version: "1.0",
        hotspots: [],
        functions: [],
        coupling: [],
        meta: {
          since: "12 months ago",
          scannedAt: "2026-01-01T00:00:00.000Z",
          granularity: "file",
          warnings: [],
        },
      };
    });
    captureStdout();

    await runCli(["node", "hotspot-scanner", "scan", ".", "--format", "table"]);

    expect(stderrSpy).toHaveBeenCalledWith("Processing git commit 1,000...\n");
  });

  it("logs complexity progress with batch and file counters", async () => {
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(scan, "runScan").mockImplementation(async (options) => {
      options.onProgress?.({
        phase: "complexity",
        commitsProcessed: 0,
        filesProcessed: 50,
        batchesProcessed: 1,
        totalFiles: 100,
        totalBatches: 2,
      });
      return {
        version: "1.0",
        hotspots: [],
        functions: [],
        coupling: [],
        meta: {
          since: "12 months ago",
          scannedAt: "2026-01-01T00:00:00.000Z",
          granularity: "file",
          warnings: [],
        },
      };
    });
    captureStdout();

    await runCli(["node", "hotspot-scanner", "scan", ".", "--format", "table"]);

    expect(stderrSpy).toHaveBeenCalledWith(
      "Processing complexity batch 1/2 (50/100 files)...\n",
    );
  });

  it("suppresses progress when --no-progress is set", async () => {
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(scan, "runScan").mockImplementation(async (options) => {
      options.onProgress?.({
        phase: "git",
        commitsProcessed: 1000,
      });
      options.onWarning?.({
        severity: "info",
        message: "info diagnostic",
        code: "INFO_CODE",
      });
      return {
        version: "1.0",
        hotspots: [],
        functions: [],
        coupling: [],
        meta: {
          since: "12 months ago",
          scannedAt: "2026-01-01T00:00:00.000Z",
          granularity: "file",
          warnings: [],
        },
      };
    });
    const { chunks } = captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      ".",
      "--format",
      "table",
      "--no-progress",
    ]);

    expect(stderrSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Processing git commit"),
    );
    expect(stderrSpy).toHaveBeenCalledWith("info: info diagnostic\n");
    expect(chunks.join("")).toContain("Top Hotspots");
  });

  it("suppresses progress and info warnings when --quiet is set", async () => {
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(scan, "runScan").mockImplementation(async (options) => {
      options.onProgress?.({
        phase: "git",
        commitsProcessed: 1000,
      });
      options.onWarning?.({
        severity: "info",
        message: "info diagnostic",
        code: "INFO_CODE",
      });
      options.onWarning?.({
        severity: "warning",
        message: "warn diagnostic",
        code: "WARN_CODE",
      });
      return {
        version: "1.0",
        hotspots: [],
        functions: [],
        coupling: [],
        meta: {
          since: "12 months ago",
          scannedAt: "2026-01-01T00:00:00.000Z",
          granularity: "file",
          warnings: [],
        },
      };
    });
    const { chunks } = captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      ".",
      "--format",
      "table",
      "--quiet",
    ]);

    expect(stderrSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Processing git commit"),
    );
    expect(stderrSpy).not.toHaveBeenCalledWith("info: info diagnostic\n");
    expect(stderrSpy).toHaveBeenCalledWith("warning: warn diagnostic\n");
    expect(chunks.join("")).toContain("Top Hotspots");
  });

  it("still throws CliUsageError under --quiet", async () => {
    vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "1.0",
      hotspots: [],
      functions: [],
      coupling: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "file",
      },
    });
    captureStdout();

    await expect(
      runCli([
        "node",
        "hotspot-scanner",
        "scan",
        ".",
        "--format",
        "csv",
        "--quiet",
      ]),
    ).rejects.toThrow(/--format csv requires --output/);
  });

  it("writes report to file under --quiet", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-test-"));
    const outputPath = join(tempDir, "report.json");
    vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "1.0",
      hotspots: [],
      functions: [],
      coupling: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "file",
      },
    });
    const { chunks } = captureStdout();

    try {
      await runCli([
        "node",
        "hotspot-scanner",
        "scan",
        ".",
        "--format",
        "json",
        "--output",
        outputPath,
        "--quiet",
      ]);

      expect(chunks.join("")).toBe("");
      const fileContent = await import("node:fs/promises").then((fs) =>
        fs.readFile(outputPath, "utf8"),
      );
      const parsed = JSON.parse(fileContent) as { version: string };
      expect(parsed.version).toBe("1.0");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("appends newline when reporter output omits trailing newline", async () => {
    vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "1.0",
      hotspots: [],
      functions: [],
      coupling: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "file",
      },
    });
    vi.spyOn(report, "createReporter").mockReturnValue({
      render: () => "table-without-newline",
    });
    const { chunks } = captureStdout();

    await runCli(["node", "hotspot-scanner", "scan", ".", "--format", "table"]);

    expect(chunks.join("")).toBe("table-without-newline\n");
  });

  it("deriveCsvStem strips lowercase .csv suffix once", () => {
    expect(deriveCsvStem("out/report.csv")).toBe("out/report");
    expect(deriveCsvStem("out/report")).toBe("out/report");
    expect(deriveCsvStem("out/report.CSV")).toBe("out/report.CSV");
  });

  it("writes CSV bundle to stem-derived files when --output and --format csv are set", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-test-"));
    const outputPath = join(tempDir, "report.csv");
    vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "1.0",
      hotspots: [
        {
          filePath: "src/hot.ts",
          complexityNormalized: 0.9,
          churnNormalized: 0.9444,
          hotspotScore: 0.85,
          cyclomaticComplexity: 42,
          functionCount: 8,
          commitCount: 15,
          linesChanged: 320,
          authorCount: 3,
        },
      ],
      functions: [],
      coupling: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "file",
      },
    });
    const { chunks } = captureStdout();

    try {
      await runCli([
        "node",
        "hotspot-scanner",
        "scan",
        ".",
        "--format",
        "csv",
        "--output",
        outputPath,
      ]);

      expect(chunks.join("")).toBe("");
      const fs = await import("node:fs/promises");
      const metaContent = await fs.readFile(
        join(tempDir, "report.meta.json"),
        "utf8",
      );
      const hotspotsContent = await fs.readFile(
        join(tempDir, "report.hotspots.csv"),
        "utf8",
      );
      const couplingContent = await fs.readFile(
        join(tempDir, "report.coupling.csv"),
        "utf8",
      );
      expect(JSON.parse(metaContent).kind).toBe("scan");
      expect(hotspotsContent.split("\n")[0]).toBe(
        "rank,file,score,cpx,cpxN,churn,churnN,funcs,authors,lines",
      );
      expect(couplingContent.split("\n")[0]).toBe(
        "rank,fileA,fileB,strength,coChanges,hasStaticDependency,staticDependencyDirection,hasRuntimeStaticDependency,hasTypeOnlyStaticDependency,hasReExportStaticDependency",
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("throws CliUsageError when --format csv is used without --output", async () => {
    vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "1.0",
      hotspots: [],
      functions: [],
      coupling: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "file",
      },
    });

    await expect(
      runCli(["node", "hotspot-scanner", "scan", ".", "--format", "csv"]),
    ).rejects.toThrow(CliUsageError);
    await expect(
      runCli(["node", "hotspot-scanner", "scan", ".", "--format", "csv"]),
    ).rejects.toThrow(/--format csv requires --output/);
    await expect(
      runCli(["node", "hotspot-scanner", "scan", ".", "--format", "csv"]),
    ).rejects.toThrow(/Hint:.*--output/);
  });

  it("writes report to file when --output is set", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-test-"));
    const outputPath = join(tempDir, "report.json");
    vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "1.0",
      hotspots: [],
      functions: [],
      coupling: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "file",
      },
    });
    const { chunks } = captureStdout();

    try {
      await runCli([
        "node",
        "hotspot-scanner",
        "scan",
        ".",
        "--format",
        "json",
        "--output",
        outputPath,
      ]);

      expect(chunks.join("")).toBe("");
      const fileContent = await import("node:fs/promises").then((fs) =>
        fs.readFile(outputPath, "utf8"),
      );
      const parsed = JSON.parse(fileContent) as { version: string };
      expect(parsed.version).toBe("1.0");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("overwrites existing output file", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-test-"));
    const outputPath = join(tempDir, "report.json");
    await writeFile(outputPath, "old content", "utf8");
    vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "1.0",
      hotspots: [],
      functions: [],
      coupling: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "file",
      },
    });
    captureStdout();

    try {
      await runCli([
        "node",
        "hotspot-scanner",
        "scan",
        ".",
        "--format",
        "json",
        "--output",
        outputPath,
      ]);

      const fileContent = await import("node:fs/promises").then((fs) =>
        fs.readFile(outputPath, "utf8"),
      );
      const parsed = JSON.parse(fileContent) as { version: string };
      expect(parsed.version).toBe("1.0");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps warnings on stderr when --output is set", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-test-"));
    const outputPath = join(tempDir, "report.json");
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(scan, "runScan").mockImplementation(async (options) => {
      options.onWarning?.({
        severity: "warning",
        message: "test warning",
        code: "TEST_WARNING",
      });
      return {
        version: "1.0",
        hotspots: [],
        functions: [],
        coupling: [],
        meta: {
          since: "12 months ago",
          scannedAt: "2026-01-01T00:00:00.000Z",
          granularity: "file",
          warnings: [],
        },
      };
    });
    const { chunks } = captureStdout();

    try {
      await runCli([
        "node",
        "hotspot-scanner",
        "scan",
        ".",
        "--format",
        "json",
        "--output",
        outputPath,
      ]);

      expect(chunks.join("")).toBe("");
      expect(stderrSpy).toHaveBeenCalledWith("warning: test warning\n");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("throws CliUsageError when argv is too short", async () => {
    await expect(runCli(["node", "hotspot-scanner"])).rejects.toThrow(
      CliUsageError,
    );
  });

  it("throws CliUsageError for invalid --format", async () => {
    await expect(
      runCli(["node", "hotspot-scanner", "scan", ".", "--format", "xml"]),
    ).rejects.toThrow(CliUsageError);
  });

  it("throws CliUsageError for non-positive --top", async () => {
    await expect(
      runCli(["node", "hotspot-scanner", "scan", ".", "--top", "0"]),
    ).rejects.toThrow(CliUsageError);
  });

  it("throws CliUsageError for non-positive --min-cochange", async () => {
    await expect(
      runCli(["node", "hotspot-scanner", "scan", ".", "--min-cochange", "-1"]),
    ).rejects.toThrow(CliUsageError);
  });

  it("throws CliUsageError for non-positive --concurrency", async () => {
    await expect(
      runCli(["node", "hotspot-scanner", "scan", ".", "--concurrency", "0"]),
    ).rejects.toThrow(CliUsageError);
    await expect(
      runCli(["node", "hotspot-scanner", "scan", ".", "--concurrency", "0"]),
    ).rejects.toThrow(/--concurrency must be a positive integer/);
  });

  it("forwards --config to runScan when explicitly set", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    const configPath = join(repoPath, "custom-config.json");
    await writeFile(
      configPath,
      JSON.stringify({ since: "6 months ago", top: 5 }),
      "utf8",
    );
    const runScanSpy = vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "1.0",
      hotspots: [],
      functions: [],
      coupling: [],
      meta: {
        since: "6 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "file",
        warnings: [],
      },
    });
    captureStdout();

    try {
      await runCli([
        "node",
        "hotspot-scanner",
        "scan",
        repoPath,
        "--config",
        configPath,
        "--format",
        "table",
      ]);

      expect(runScanSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          repoPath,
          configPath,
        }),
      );
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("CLI --since overrides --config file values", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    const configPath = join(repoPath, "custom-config.json");
    await writeFile(
      configPath,
      JSON.stringify({ since: "6 months ago" }),
      "utf8",
    );
    const runScanSpy = vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "1.0",
      hotspots: [],
      functions: [],
      coupling: [],
      meta: {
        since: "1 week ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "file",
        warnings: [],
      },
    });
    captureStdout();

    try {
      await runCli([
        "node",
        "hotspot-scanner",
        "scan",
        repoPath,
        "--config",
        configPath,
        "--since",
        "1 week ago",
        "--format",
        "table",
      ]);

      expect(runScanSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          repoPath,
          configPath,
          since: "1 week ago",
        }),
      );
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("uses config top from --config file for reporter when CLI omits --top", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    const configPath = join(repoPath, "custom-config.json");
    await writeFile(configPath, JSON.stringify({ top: 5 }), "utf8");
    vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "1.0",
      hotspots: [],
      functions: [],
      coupling: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "file",
        warnings: [],
      },
    });
    const render = vi.fn(() => "table-output\n");
    vi.spyOn(report, "createReporter").mockReturnValue({
      render,
      renderCompare: vi.fn(),
    });
    captureStdout();

    try {
      await runCli([
        "node",
        "hotspot-scanner",
        "scan",
        repoPath,
        "--config",
        configPath,
        "--format",
        "table",
      ]);

      expect(render).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ top: 5 }),
      );
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("throws ConfigError when --config file is missing", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    const missingPath = join(repoPath, "missing-config.json");

    try {
      await expect(
        runCli([
          "node",
          "hotspot-scanner",
          "scan",
          repoPath,
          "--config",
          missingPath,
          "--format",
          "table",
        ]),
      ).rejects.toThrow(/Config file not found/);
      await expect(
        runCli([
          "node",
          "hotspot-scanner",
          "scan",
          repoPath,
          "--config",
          missingPath,
          "--format",
          "table",
        ]),
      ).rejects.toThrow(/Hint:.*must exist/);
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("forwards --concurrency to runScan when explicitly set", async () => {
    const runScanSpy = vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "1.0",
      hotspots: [],
      functions: [],
      coupling: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "file",
        warnings: [],
      },
    });
    captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      ".",
      "--concurrency",
      "2",
      "--format",
      "table",
    ]);

    expect(runScanSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        concurrency: 2,
      }),
    );
  });

  it("forwards only explicit CLI overrides to runScan when config is present", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    try {
      await writeFile(
        join(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME),
        JSON.stringify({ since: "6 months ago", top: 5 }),
        "utf8",
      );
      const runScanSpy = vi.spyOn(scan, "runScan").mockResolvedValue({
        version: "1.0",
        hotspots: [],
        functions: [],
        coupling: [],
        meta: {
          since: "6 months ago",
          scannedAt: "2026-01-01T00:00:00.000Z",
          granularity: "file",
        },
      });
      captureStdout();

      await runCli([
        "node",
        "hotspot-scanner",
        "scan",
        repoPath,
        "--format",
        "table",
      ]);

      expect(runScanSpy).toHaveBeenCalledWith({
        repoPath,
        onWarning: expect.any(Function),
        onProgress: expect.any(Function),
      });
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("CLI --since overrides repo config", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    try {
      await writeFile(
        join(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME),
        JSON.stringify({ since: "6 months ago" }),
        "utf8",
      );
      const runScanSpy = vi.spyOn(scan, "runScan").mockResolvedValue({
        version: "1.0",
        hotspots: [],
        functions: [],
        coupling: [],
        meta: {
          since: "1 week ago",
          scannedAt: "2026-01-01T00:00:00.000Z",
          granularity: "file",
        },
      });
      captureStdout();

      await runCli([
        "node",
        "hotspot-scanner",
        "scan",
        repoPath,
        "--since",
        "1 week ago",
        "--format",
        "table",
      ]);

      expect(runScanSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          repoPath,
          since: "1 week ago",
        }),
      );
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("uses config top for reporter when CLI omits --top", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    try {
      await writeFile(
        join(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME),
        JSON.stringify({ top: 5 }),
        "utf8",
      );
      vi.spyOn(scan, "runScan").mockResolvedValue({
        version: "1.0",
        hotspots: [],
        functions: [],
        coupling: [],
        meta: {
          since: "12 months ago",
          scannedAt: "2026-01-01T00:00:00.000Z",
          granularity: "file",
        },
      });
      const render = vi.fn(() => "table-output\n");
      vi.spyOn(report, "createReporter").mockReturnValue({
        render,
        renderCompare: vi.fn(),
      });
      captureStdout();

      await runCli([
        "node",
        "hotspot-scanner",
        "scan",
        repoPath,
        "--format",
        "table",
      ]);

      expect(render).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ top: 5 }),
      );
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("forwards include and exclude patterns to runScan", async () => {
    const runScanSpy = vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "1.0",
      hotspots: [],
      functions: [],
      coupling: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "file",
      },
    });
    captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      ".",
      "--include",
      "src/**",
      "--exclude",
      "generated/**",
    ]);

    expect(runScanSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        include: ["src/**"],
        exclude: ["generated/**"],
      }),
    );
  });

  it("forwards granularity to runScan", async () => {
    const runScanSpy = vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "1.0",
      hotspots: [],
      functions: [],
      coupling: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "function",
      },
    });
    captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      ".",
      "--granularity",
      "function",
    ]);

    expect(runScanSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        granularity: "function",
      }),
    );
  });

  it("accepts short aliases -f -o -t -g equivalent to long flags", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-test-"));
    const outputPath = join(tempDir, "report.json");
    const runScanSpy = vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "1.0",
      hotspots: [],
      functions: [],
      coupling: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "function",
      },
    });
    const render = vi.fn(() => '{"version":"1.0"}\n');
    vi.spyOn(report, "createReporter").mockReturnValue({
      render,
      renderCompare: vi.fn(),
    });
    const { chunks } = captureStdout();

    try {
      await runCli([
        "node",
        "hotspot-scanner",
        "scan",
        ".",
        "-f",
        "json",
        "-o",
        outputPath,
        "-t",
        "5",
        "-g",
        "function",
      ]);

      expect(runScanSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          granularity: "function",
        }),
      );
      expect(render).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ format: "json", top: 5 }),
      );
      expect(chunks.join("")).toBe("");
      const fileContent = await import("node:fs/promises").then((fs) =>
        fs.readFile(outputPath, "utf8"),
      );
      expect(JSON.parse(fileContent).version).toBe("1.0");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("long flags still work alongside short aliases", async () => {
    const runScanSpy = vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "1.0",
      hotspots: [],
      functions: [],
      coupling: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "file",
      },
    });
    const render = vi.fn(() => "table-output\n");
    vi.spyOn(report, "createReporter").mockReturnValue({
      render,
      renderCompare: vi.fn(),
    });
    captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      ".",
      "--format",
      "table",
      "--top",
      "15",
      "--granularity",
      "file",
    ]);

    expect(runScanSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        granularity: "file",
      }),
    );
    expect(render).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ format: "table", top: 15 }),
    );
  });

  it("throws CliUsageError for invalid -f alias value", async () => {
    await expect(
      runCli(["node", "hotspot-scanner", "scan", ".", "-f", "xml"]),
    ).rejects.toThrow(CliUsageError);
    await expect(
      runCli(["node", "hotspot-scanner", "scan", ".", "-f", "xml"]),
    ).rejects.toThrow(/Invalid --format/);
  });

  it("throws CliUsageError for empty --include", async () => {
    await expect(
      runCli(["node", "hotspot-scanner", "scan", ".", "--include", ""]),
    ).rejects.toThrow(CliUsageError);
  });

  it("throws CliUsageError for invalid --only before scan", async () => {
    const runScanSpy = vi.spyOn(scan, "runScan");

    await expect(
      runCli(["node", "hotspot-scanner", "scan", ".", "--only", "bogus"]),
    ).rejects.toThrow(CliUsageError);
    await expect(
      runCli(["node", "hotspot-scanner", "scan", ".", "--only", "bogus"]),
    ).rejects.toThrow(/Invalid --only: bogus/);

    expect(runScanSpy).not.toHaveBeenCalled();
  });

  it("throws CliUsageError for empty --only before scan", async () => {
    const runScanSpy = vi.spyOn(scan, "runScan");

    await expect(
      runCli(["node", "hotspot-scanner", "scan", ".", "--only", ""]),
    ).rejects.toThrow(CliUsageError);

    expect(runScanSpy).not.toHaveBeenCalled();
  });

  it("forwards --only union to reporter for JSON output", async () => {
    vi.spyOn(scan, "runScan").mockResolvedValue(loadTriageFixture());
    const render = vi.fn(() => '{"version":"1.0"}\n');
    vi.spyOn(report, "createReporter").mockReturnValue({
      render,
      renderCompare: vi.fn(),
    });
    captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      ".",
      "--format",
      "json",
      "--only",
      "hotspots",
      "--only",
      "coupling",
    ]);

    expect(render).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        only: ["hotspots", "coupling"],
      }),
    );
  });

  it("passes triageHints false when --no-triage-hints is set", async () => {
    vi.spyOn(scan, "runScan").mockResolvedValue(loadTriageFixture());
    const render = vi.fn(() => "table-output\n");
    vi.spyOn(report, "createReporter").mockReturnValue({
      render,
      renderCompare: vi.fn(),
    });
    captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      ".",
      "--format",
      "table",
      "--no-triage-hints",
    ]);

    expect(render).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ triageHints: false }),
    );
  });

  it("omits triage section in table output when --no-triage-hints is set", async () => {
    vi.spyOn(scan, "runScan").mockResolvedValue(loadTriageFixture());
    const { chunks } = captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      ".",
      "--format",
      "table",
      "--no-triage-hints",
    ]);

    const output = chunks.join("");
    expect(output).not.toContain("Triage hints");
    expect(output).toContain("Glossary");
  });

  it("disables table color for --no-color", async () => {
    vi.spyOn(scan, "runScan").mockResolvedValue(loadTriageFixture());
    const render = vi.fn(() => "table-output\n");
    vi.spyOn(report, "createReporter").mockReturnValue({
      render,
      renderCompare: vi.fn(),
    });
    captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      ".",
      "--format",
      "table",
      "--no-color",
    ]);

    expect(render).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ color: false }),
    );
  });

  it("disables table color when NO_COLOR is set", async () => {
    const previous = process.env.NO_COLOR;
    process.env.NO_COLOR = "1";
    vi.spyOn(scan, "runScan").mockResolvedValue(loadTriageFixture());
    const render = vi.fn(() => "table-output\n");
    vi.spyOn(report, "createReporter").mockReturnValue({
      render,
      renderCompare: vi.fn(),
    });
    captureStdout();

    try {
      await runCli(["node", "hotspot-scanner", "scan", ".", "--format", "table"]);

      expect(render).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ color: false }),
      );
    } finally {
      if (previous === undefined) {
        delete process.env.NO_COLOR;
      } else {
        process.env.NO_COLOR = previous;
      }
    }
  });

  it("disables table color when --output is set", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-test-"));
    const outputPath = join(tempDir, "report.txt");
    vi.spyOn(scan, "runScan").mockResolvedValue(loadTriageFixture());
    const render = vi.fn(() => "table-output\n");
    vi.spyOn(report, "createReporter").mockReturnValue({
      render,
      renderCompare: vi.fn(),
    });
    captureStdout();

    try {
      await runCli([
        "node",
        "hotspot-scanner",
        "scan",
        ".",
        "--format",
        "table",
        "--output",
        outputPath,
      ]);

      expect(render).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ color: false }),
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("disables table color for non-table formats", async () => {
    vi.spyOn(scan, "runScan").mockResolvedValue(loadTriageFixture());
    const render = vi.fn(() => '{"version":"1.0"}\n');
    vi.spyOn(report, "createReporter").mockReturnValue({
      render,
      renderCompare: vi.fn(),
    });
    captureStdout();

    await runCli(["node", "hotspot-scanner", "scan", ".", "--format", "json"]);

    expect(render).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ color: false }),
    );
  });

  it("enables table color on TTY stdout without disable flags", async () => {
    const previousIsTTY = process.stdout.isTTY;
    const previousNoColor = process.env.NO_COLOR;
    delete process.env.NO_COLOR;
    Object.defineProperty(process.stdout, "isTTY", {
      value: true,
      configurable: true,
    });
    vi.spyOn(scan, "runScan").mockResolvedValue(loadTriageFixture());
    const render = vi.fn(() => "table-output\n");
    vi.spyOn(report, "createReporter").mockReturnValue({
      render,
      renderCompare: vi.fn(),
    });
    captureStdout();

    try {
      await runCli([
        "node",
        "hotspot-scanner",
        "scan",
        ".",
        "--format",
        "table",
      ]);

      expect(render).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ color: true }),
      );
    } finally {
      Object.defineProperty(process.stdout, "isTTY", {
        value: previousIsTTY,
        configurable: true,
      });
      if (previousNoColor === undefined) {
        delete process.env.NO_COLOR;
      } else {
        process.env.NO_COLOR = previousNoColor;
      }
    }
  });

  it("renders ANSI colors on TTY table stdout by default", async () => {
    const previousIsTTY = process.stdout.isTTY;
    const previousNoColor = process.env.NO_COLOR;
    delete process.env.NO_COLOR;
    Object.defineProperty(process.stdout, "isTTY", {
      value: true,
      configurable: true,
    });
    vi.spyOn(scan, "runScan").mockResolvedValue(loadTriageFixture());
    const { chunks } = captureStdout();

    try {
      await runCli([
        "node",
        "hotspot-scanner",
        "scan",
        ".",
        "--format",
        "table",
      ]);

      const output = chunks.join("");
      expect(output).not.toBe(stripAnsi(output));
    } finally {
      Object.defineProperty(process.stdout, "isTTY", {
        value: previousIsTTY,
        configurable: true,
      });
      if (previousNoColor === undefined) {
        delete process.env.NO_COLOR;
      } else {
        process.env.NO_COLOR = previousNoColor;
      }
    }
  });

  it("renders compare output when --baseline is set", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-test-"));
    const baselinePath = join(tempDir, "baseline.json");
    const scanResult = {
      version: "1.0" as const,
      hotspots: [
        {
          filePath: "src/example.ts",
          hotspotScore: 1,
          complexityNormalized: 1,
          churnNormalized: 1,
          cyclomaticComplexity: 10,
          functionCount: 2,
          commitCount: 5,
          linesChanged: 100,
          authorCount: 1,
        },
      ],
      functions: [],
      coupling: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "file" as const,
        warnings: [],
      },
    };
    await writeFile(baselinePath, JSON.stringify(scanResult), "utf8");
    vi.spyOn(scan, "runScan").mockResolvedValue(scanResult);
    const renderCompare = vi.fn(
      () =>
        '{"version":"1.0","hotspots":{"new":[],"removed":[],"rankChanged":[]}}\n',
    );
    vi.spyOn(report, "createReporter").mockReturnValue({
      render: vi.fn(),
      renderCompare,
    });
    const { chunks } = captureStdout();

    try {
      await runCli([
        "node",
        "hotspot-scanner",
        "scan",
        ".",
        "--baseline",
        baselinePath,
        "--format",
        "json",
      ]);

      expect(renderCompare).toHaveBeenCalled();
      expect(chunks.join("")).toContain('"version":"1.0"');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("uses normal render when --baseline is omitted", async () => {
    const render = vi.fn(() => "normal-scan-output\n");
    vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "1.0",
      hotspots: [],
      functions: [],
      coupling: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "file",
      },
    });
    vi.spyOn(report, "createReporter").mockReturnValue({
      render,
      renderCompare: vi.fn(),
    });
    const { chunks } = captureStdout();

    await runCli(["node", "hotspot-scanner", "scan", ".", "--format", "table"]);

    expect(render).toHaveBeenCalled();
    expect(chunks.join("")).toContain("normal-scan-output");
  });

  it("defaults repoPath to . when scan omits path", async () => {
    const runScanSpy = vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "1.0",
      hotspots: [],
      functions: [],
      coupling: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "file",
      },
    });
    captureStdout();

    await runCli(["node", "hotspot-scanner", "scan", "--format", "table"]);

    expect(runScanSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        repoPath: ".",
      }),
    );
  });

  it("honors explicit path when provided", async () => {
    const explicitPath = "/tmp/explicit-repo";
    const runScanSpy = vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "1.0",
      hotspots: [],
      functions: [],
      coupling: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "file",
      },
    });
    captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      explicitPath,
      "--format",
      "table",
    ]);

    expect(runScanSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        repoPath: explicitPath,
      }),
    );
  });

  it("throws BaselineError with contract hint when baseline JSON is invalid", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-test-"));
    const baselinePath = join(tempDir, "invalid-baseline.json");
    await writeFile(baselinePath, '{"version":"9.9"}', "utf8");
    vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "1.0",
      hotspots: [],
      functions: [],
      coupling: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "file",
        warnings: [],
      },
    });
    captureStdout();

    try {
      await expect(
        runCli([
          "node",
          "hotspot-scanner",
          "scan",
          ".",
          "--baseline",
          baselinePath,
          "--format",
          "table",
        ]),
      ).rejects.toThrow(/Unsupported baseline version/);
      await expect(
        runCli([
          "node",
          "hotspot-scanner",
          "scan",
          ".",
          "--baseline",
          baselinePath,
          "--format",
          "table",
        ]),
      ).rejects.toThrow(/Hint:.*JSON contract/);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("writes explain block to stderr after report without altering JSON stdout", async () => {
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "1.0",
      hotspots: [
        {
          filePath: "src/example.ts",
          hotspotScore: 0.88,
          complexityNormalized: 0.9,
          churnNormalized: 0.85,
          cyclomaticComplexity: 42,
          functionCount: 8,
          commitCount: 15,
          linesChanged: 320,
          authorCount: 3,
        },
      ],
      functions: [],
      coupling: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "file",
      },
    });
    const { chunks } = captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      ".",
      "--format",
      "json",
      "--explain",
      "src/example.ts",
    ]);

    const stdout = chunks.join("");
    expect(() => JSON.parse(stdout)).not.toThrow();
    expect(stdout).not.toContain("=== Explain:");
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("=== Explain: src/example.ts (rank 1) ==="),
    );
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("hotspotScore = 2·c·h / (c+h)"),
    );
  });

  it("writes not-found explain message to stderr and still completes scan", async () => {
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "1.0",
      hotspots: [],
      functions: [],
      coupling: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "file",
      },
    });
    const { chunks } = captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      ".",
      "--format",
      "table",
      "--explain",
      "src/missing.ts",
    ]);

    expect(chunks.join("")).toContain("Top Hotspots");
    expect(stderrSpy).toHaveBeenCalledWith(
      "explain: no hotspot ranking for src/missing.ts\n",
    );
  });

  it("throws CliUsageError for path:function explain in file granularity before scan", async () => {
    const runScanSpy = vi.spyOn(scan, "runScan");
    captureStdout();

    await expect(
      runCli([
        "node",
        "hotspot-scanner",
        "scan",
        ".",
        "--explain",
        "src/example.ts:run",
      ]),
    ).rejects.toThrow(CliUsageError);
    await expect(
      runCli([
        "node",
        "hotspot-scanner",
        "scan",
        ".",
        "--explain",
        "src/example.ts:run",
      ]),
    ).rejects.toThrow(/--granularity function/);

    expect(runScanSpy).not.toHaveBeenCalled();
  });

  it("keeps report file unchanged when --explain is set with --output", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-test-"));
    const outputPath = join(tempDir, "report.json");
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "1.0",
      hotspots: [
        {
          filePath: "src/example.ts",
          hotspotScore: 0.88,
          complexityNormalized: 0.9,
          churnNormalized: 0.85,
          cyclomaticComplexity: 42,
          functionCount: 8,
          commitCount: 15,
          linesChanged: 320,
          authorCount: 3,
        },
      ],
      functions: [],
      coupling: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "file",
      },
    });
    const { chunks } = captureStdout();

    try {
      await runCli([
        "node",
        "hotspot-scanner",
        "scan",
        ".",
        "--format",
        "json",
        "--output",
        outputPath,
        "--explain",
        "src/example.ts",
      ]);

      expect(chunks.join("")).toBe("");
      const fileContent = await import("node:fs/promises").then((fs) =>
        fs.readFile(outputPath, "utf8"),
      );
      const parsed = JSON.parse(fileContent) as { version: string };
      expect(parsed.version).toBe("1.0");
      expect(fileContent).not.toContain("=== Explain:");
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining("=== Explain: src/example.ts (rank 1) ==="),
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("fails when cwd is not a git repository and path is omitted", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-nogit-"));
    const originalCwd = process.cwd();
    captureStdout();

    try {
      process.chdir(tempDir);

      await expect(
        runCli(["node", "hotspot-scanner", "scan", "--format", "table"]),
      ).rejects.toThrow(/not a git repository/i);
      await expect(
        runCli(["node", "hotspot-scanner", "scan", "--format", "table"]),
      ).rejects.toThrow(/Hint:.*\.git/);
    } finally {
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe("runCli baseline save", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes baseline JSON to default path when --output is omitted", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-baseline-"));
    const originalCwd = process.cwd();
    vi.spyOn(scan, "runScan").mockResolvedValue(mockScanResult());
    const { chunks } = captureStdout();

    try {
      process.chdir(tempDir);

      await runCli(["node", "hotspot-scanner", "baseline", "save", "."]);

      expect(chunks.join("")).toBe("");
      const baselinePath = join(tempDir, "hotspot-baseline.json");
      const loaded = await loadBaseline(baselinePath);
      expect(loaded.version).toBe("1.0");
      expect(loaded.hotspots).toHaveLength(1);
    } finally {
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("writes baseline JSON to --output override path", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-baseline-"));
    const outputPath = join(tempDir, "custom-baseline.json");
    vi.spyOn(scan, "runScan").mockResolvedValue(mockScanResult());
    const { chunks } = captureStdout();

    try {
      await runCli([
        "node",
        "hotspot-scanner",
        "baseline",
        "save",
        ".",
        "--output",
        outputPath,
      ]);

      expect(chunks.join("")).toBe("");
      const loaded = await loadBaseline(outputPath);
      expect(loaded.version).toBe("1.0");
      expect(loaded.hotspots[0]?.filePath).toBe("src/example.ts");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("overwrites existing baseline file without prompt", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-baseline-"));
    const outputPath = join(tempDir, "baseline.json");
    await writeFile(outputPath, '{"version":"9.9"}', "utf8");
    vi.spyOn(scan, "runScan").mockResolvedValue(mockScanResult());
    captureStdout();

    try {
      await runCli([
        "node",
        "hotspot-scanner",
        "baseline",
        "save",
        ".",
        "--output",
        outputPath,
      ]);

      const loaded = await loadBaseline(outputPath);
      expect(loaded.version).toBe("1.0");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("throws CliUsageError when --output path is a directory", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-baseline-"));
    vi.spyOn(scan, "runScan").mockResolvedValue(mockScanResult());
    captureStdout();

    try {
      await expect(
        runCli([
          "node",
          "hotspot-scanner",
          "baseline",
          "save",
          ".",
          "--output",
          tempDir,
        ]),
      ).rejects.toThrow(CliUsageError);
      await expect(
        runCli([
          "node",
          "hotspot-scanner",
          "baseline",
          "save",
          ".",
          "--output",
          tempDir,
        ]),
      ).rejects.toThrow(/--output path is a directory/);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("throws CliUsageError when --output parent directory is missing", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-baseline-"));
    const missingParent = join(tempDir, "missing", "baseline.json");
    vi.spyOn(scan, "runScan").mockResolvedValue(mockScanResult());
    captureStdout();

    try {
      await expect(
        runCli([
          "node",
          "hotspot-scanner",
          "baseline",
          "save",
          ".",
          "--output",
          missingParent,
        ]),
      ).rejects.toThrow(CliUsageError);
      await expect(
        runCli([
          "node",
          "hotspot-scanner",
          "baseline",
          "save",
          ".",
          "--output",
          missingParent,
        ]),
      ).rejects.toThrow(/--output parent directory does not exist/);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("forwards scan options to runScan", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-baseline-"));
    const outputPath = join(tempDir, "baseline.json");
    const runScanSpy = vi.spyOn(scan, "runScan").mockResolvedValue(mockScanResult());
    captureStdout();

    try {
      await runCli([
        "node",
        "hotspot-scanner",
        "baseline",
        "save",
        ".",
        "--output",
        outputPath,
        "--since",
        "6 months ago",
        "--granularity",
        "function",
        "--include",
        "src/**",
      ]);

      expect(runScanSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          repoPath: ".",
          since: "6 months ago",
          granularity: "function",
          include: ["src/**"],
        }),
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe("runCli compare", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exits non-zero when --baseline is omitted", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new CliExitError(Number(code));
    });
    captureStdout();

    try {
      await expect(
        runCli(["node", "hotspot-scanner", "compare", "."]),
      ).rejects.toMatchObject({ exitCode: 1 });
    } finally {
      exitSpy.mockRestore();
    }
  });

  it("renders compare output via executeCompareAndRender wiring", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-compare-"));
    const baselinePath = join(tempDir, "baseline.json");
    const scanResult = mockScanResult();
    await writeFile(baselinePath, JSON.stringify(scanResult), "utf8");
    const runScanSpy = vi.spyOn(scan, "runScan").mockResolvedValue(scanResult);
    const renderCompare = vi.fn(
      () =>
        '{"version":"1.0","hotspots":{"new":[],"removed":[],"rankChanged":[]}}\n',
    );
    vi.spyOn(report, "createReporter").mockReturnValue({
      render: vi.fn(),
      renderCompare,
    });
    const { chunks } = captureStdout();

    try {
      await runCli([
        "node",
        "hotspot-scanner",
        "compare",
        ".",
        "--baseline",
        baselinePath,
        "--format",
        "json",
      ]);

      expect(runScanSpy).toHaveBeenCalled();
      expect(renderCompare).toHaveBeenCalled();
      expect(chunks.join("")).toContain('"version":"1.0"');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("throws CliUsageError when --format csv is used without --output", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-compare-"));
    const baselinePath = join(tempDir, "baseline.json");
    await writeFile(baselinePath, JSON.stringify(mockScanResult()), "utf8");
    vi.spyOn(scan, "runScan").mockResolvedValue(mockScanResult());
    captureStdout();

    try {
      await expect(
        runCli([
          "node",
          "hotspot-scanner",
          "compare",
          ".",
          "--baseline",
          baselinePath,
          "--format",
          "csv",
        ]),
      ).rejects.toThrow(CliUsageError);
      await expect(
        runCli([
          "node",
          "hotspot-scanner",
          "compare",
          ".",
          "--baseline",
          baselinePath,
          "--format",
          "csv",
        ]),
      ).rejects.toThrow(/--format csv requires --output/);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe("runCli init", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes exemplar config and exits 0", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-init-"));
    const { chunks } = captureStdout();

    try {
      await runCli(["node", "hotspot-scanner", "init", tempDir]);

      const configPath = join(tempDir, HOTSPOT_SCANNER_CONFIG_FILENAME);
      const content = await import("node:fs/promises").then((fs) =>
        fs.readFile(configPath, "utf8"),
      );
      expect(content).toBe(formatExemplarConfig());
      expect(chunks.join("")).toContain(`Wrote config to ${configPath}`);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("refuses overwrite without --force", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-init-"));
    captureStdout();

    try {
      await runCli(["node", "hotspot-scanner", "init", tempDir]);

      await expect(
        runCli(["node", "hotspot-scanner", "init", tempDir]),
      ).rejects.toThrow(/Config file already exists/);
      await expect(
        runCli(["node", "hotspot-scanner", "init", tempDir]),
      ).rejects.toThrow(/--force/);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("overwrites with --force", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-init-"));
    const configPath = join(tempDir, HOTSPOT_SCANNER_CONFIG_FILENAME);
    captureStdout();

    try {
      await runCli(["node", "hotspot-scanner", "init", tempDir]);
      await writeFile(configPath, '{"since":"1 week ago"}\n', "utf8");

      await runCli([
        "node",
        "hotspot-scanner",
        "init",
        tempDir,
        "--force",
      ]);

      const content = await import("node:fs/promises").then((fs) =>
        fs.readFile(configPath, "utf8"),
      );
      expect(content).toBe(formatExemplarConfig());
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("throws InitError when target is not a directory", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-init-"));
    const filePath = join(tempDir, "not-a-dir.txt");
    await writeFile(filePath, "x", "utf8");
    captureStdout();

    try {
      await expect(
        runCli(["node", "hotspot-scanner", "init", filePath]),
      ).rejects.toThrow(/not a directory/);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe("runCli doctor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exits 0 and prints findings on healthy small-ts fixture", async () => {
    const { chunks } = captureStdout();

    await runCli(["node", "hotspot-scanner", "doctor", smallTsFixture]);

    const output = chunks.join("");
    expect(output).toMatch(/pass:.*Node/);
    expect(output).toMatch(/pass:.*git is available/);
    expect(output).toMatch(/pass:.*Git repository/);
  });

  it("exits non-zero when target path is missing", async () => {
    const missingPath = join(tmpdir(), `hotspot-doctor-missing-${Date.now()}`);
    captureStdout();

    await expect(
      runCli(["node", "hotspot-scanner", "doctor", missingPath]),
    ).rejects.toThrow(CliExitError);

    await expect(
      runCli(["node", "hotspot-scanner", "doctor", missingPath]),
    ).rejects.toMatchObject({ exitCode: 1 });
  });
});

describe("runCli scan --dry-run", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints scope preview without running full scan", async () => {
    const runScanSpy = vi.spyOn(scan, "runScan");
    const { chunks } = captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      smallTsFixture,
      "--dry-run",
    ]);

    const output = chunks.join("");
    expect(output).toContain(`repo: ${smallTsFixture}`);
    expect(output).toContain("since:");
    expect(output).toContain("eligible files:");
    expect(output).toMatch(/eligible files: [1-9]\d*/);
    expect(output).toContain("concurrency:");
    expect(runScanSpy).not.toHaveBeenCalled();
  });

  it("rejects --baseline with --dry-run", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-test-"));
    const baselinePath = join(tempDir, "baseline.json");
    await writeFile(baselinePath, "{}", "utf8");
    captureStdout();

    try {
      await expect(
        runCli([
          "node",
          "hotspot-scanner",
          "scan",
          smallTsFixture,
          "--dry-run",
          "--baseline",
          baselinePath,
        ]),
      ).rejects.toThrow(CliUsageError);
      await expect(
        runCli([
          "node",
          "hotspot-scanner",
          "scan",
          smallTsFixture,
          "--dry-run",
          "--baseline",
          baselinePath,
        ]),
      ).rejects.toThrow(/--baseline cannot be used with --dry-run/);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("ignores --format and --output for preview output", async () => {
    const runScanSpy = vi.spyOn(scan, "runScan");
    const renderSpy = vi.spyOn(report, "createReporter");
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-test-"));
    const outputPath = join(tempDir, "report.json");
    const { chunks } = captureStdout();

    try {
      await runCli([
        "node",
        "hotspot-scanner",
        "scan",
        smallTsFixture,
        "--dry-run",
        "--format",
        "json",
        "--output",
        outputPath,
      ]);

      const output = chunks.join("");
      expect(output).toContain("eligible files:");
      expect(output).not.toContain('"version"');
      expect(runScanSpy).not.toHaveBeenCalled();
      expect(renderSpy).not.toHaveBeenCalled();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
