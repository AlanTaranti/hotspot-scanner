import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HOTSPOT_SCANNER_CONFIG_FILENAME } from "../src/config/index.js";
import * as diagnostics from "#diagnostics";
import * as report from "#report";
import * as scan from "#scan";
import {
  CliUsageError,
  collectGlob,
  createCliProgram,
  deriveCsvStem,
  parseFormat,
  parseGranularity,
  parsePositiveInteger,
  runCli,
  validateBaselinePath,
  validateOutputPath,
  validateScopePatterns,
} from "./hotspot-scanner.js";

const smallTsFixture = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../tests/fixtures/repos/small-ts",
);

async function createIsolatedSmallTsRepo(): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), "hotspot-cli-config-"));
  await cp(smallTsFixture, tempDir, { recursive: true });
  return tempDir;
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
        "--include",
        "--exclude",
        "--baseline",
      ]),
    );
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

describe("runCli", () => {
  afterEach(() => {
    vi.restoreAllMocks();
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
    const progressSpy = vi
      .spyOn(diagnostics, "maybeLogProgress")
      .mockReturnValue(true);
    vi.spyOn(scan, "runScan").mockImplementation(async (options) => {
      options.onProgress?.({ commitsProcessed: 1000 });
      return {
        version: "1.0",
        hotspots: [],
        functions: [],
        coupling: [],
        meta: {
          since: "12 months ago",
          scannedAt: "2026-01-01T00:00:00.000Z",
          granularity: "file",
        },
      };
    });
    captureStdout();

    await runCli(["node", "hotspot-scanner", "scan", ".", "--format", "table"]);

    expect(progressSpy).toHaveBeenCalledWith(1000);
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
        "rank,fileA,fileB,strength,coChanges,hasStaticDependency",
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
    const warningSpy = vi
      .spyOn(diagnostics, "logWarning")
      .mockImplementation(() => {});
    vi.spyOn(scan, "runScan").mockImplementation(async (options) => {
      options.onWarning?.("test warning");
      return {
        version: "1.0",
        hotspots: [],
        functions: [],
        coupling: [],
        meta: {
          since: "12 months ago",
          scannedAt: "2026-01-01T00:00:00.000Z",
          granularity: "file",
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
      expect(warningSpy).toHaveBeenCalledWith("test warning");
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

  it("throws CliUsageError for empty --include", async () => {
    await expect(
      runCli(["node", "hotspot-scanner", "scan", ".", "--include", ""]),
    ).rejects.toThrow(CliUsageError);
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
});
