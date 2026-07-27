import { readFileSync } from "node:fs";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BaselineError, loadBaseline } from "#compare";
import { HOTSPOT_SCANNER_CONFIG_FILENAME } from "../src/config/index.js";
import { formatExemplarConfig } from "../src/config/exemplar.js";
import { stripAnsi } from "../src/report/color.js";
import * as report from "#report";
import * as scan from "#scan";
import * as diagnostics from "#diagnostics";
import {
  CliExitError,
  CliUsageError,
  collectGlob,
  collectOnlySection,
  createCliProgram,
  DEFAULT_BASELINE_OUTPUT,
  deriveCsvStem,
  maybeRewritePathToScan,
  parseConfigPrintFormat,
  parseDoctorFormat,
  parseFormat,
  parseOnlySectionCli,
  parsePositiveInteger,
  parseWarningsMode,
  resolveCliExitCode,
  resolvePackageVersion,
  resolveSequentialCliOption,
  resolveTableColor,
  runCli,
  validateBaselinePath,
  validateExplainTarget,
  validateOutputPath,
  validateScopePatterns,
} from "./hotspot-scanner.js";
import {
  COMPLETION_SHELLS,
  getCompletionScript,
} from "./completion-scripts.js";
import * as scanActions from "./scan-actions.js";
import { formatAmbiguousRenameWarnings } from "../src/git/rename-warnings.js";
import type { ScanWarning } from "../src/types/index.js";

const smallTsFixture = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../tests/fixtures/repos/small-ts",
);

const monorepoNestedFixture = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../tests/fixtures/repos/monorepo-nested",
);

const monorepoApiPackagePath = join(
  monorepoNestedFixture,
  "packages",
  "api",
);

function extractEligibleFileCount(output: string): number {
  const match = output.match(/eligible files: (\d+)/);
  expect(match).not.toBeNull();
  return Number.parseInt(match![1]!, 10);
}

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

function loadCompareFixture(name: string) {
  const raw = JSON.parse(readFileSync(join(
    fileURLToPath(new URL(".", import.meta.url)),
    `../tests/fixtures/report/${name}`,
  ), "utf8")) as { _comment?: string } & ReturnType<typeof mockScanResult>;
  const { _comment: _ignored, ...fixture } = raw;
  void _ignored;
  return fixture;
}

function loadTriageFixture() {
  const raw = JSON.parse(readFileSync(triageFixturePath, "utf8")) as {
    _comment?: string;
    version: string;
    hotspots: unknown[];
    meta: {
      since: string;
      scannedAt: string;
      warnings?: unknown[];
    };
  };
  const { _comment: _ignored, ...fixture } = raw;
  void _ignored;
  return fixture;
}

function mockScanResult() {
  return {
    version: "3.0",
    hotspots: [
      {
        filePath: "src/example.ts",
        hotspotScore: 0.88,
        complexityNormalized: 0.9,
        churnNormalized: 0.85,
        ncloc: 42,
        commitCount: 15,
        linesChanged: 320,
        authorCount: 3,
      },
    ],
    meta: {
      since: "12 months ago",
      scannedAt: "2026-01-01T00:00:00.000Z",
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

function buildAmbiguousRenameWarnings(count: number): ScanWarning[] {
  const paths = Array.from({ length: count }, (_, i) => `src/file${i}.ts`);
  return formatAmbiguousRenameWarnings(paths).map((message) => ({
    severity: "warning" as const,
    code: "RENAME_HISTORY_INCOMPLETE",
    message,
  }));
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

  it("parseWarningsMode accepts summary, full, and json", () => {
    expect(parseWarningsMode("summary")).toBe("summary");
    expect(parseWarningsMode("full")).toBe("full");
    expect(parseWarningsMode("json")).toBe("json");
  });

  it("parseWarningsMode rejects invalid values", () => {
    expect(() => parseWarningsMode("brief")).toThrow(CliUsageError);
    expect(() => parseWarningsMode("brief")).toThrow(/Invalid --warnings/);
    expect(() => parseWarningsMode("brief")).toThrow(/summary, full, or json/);
  });

  it("parseDoctorFormat accepts text and json", () => {
    expect(parseDoctorFormat("text")).toBe("text");
    expect(parseDoctorFormat("json")).toBe("json");
  });

  it("parseDoctorFormat rejects invalid values", () => {
    expect(() => parseDoctorFormat("xml")).toThrow(CliUsageError);
    expect(() => parseDoctorFormat("xml")).toThrow(/Invalid --format/);
    expect(() => parseDoctorFormat("xml")).toThrow(/text or json/);
  });

  it("parseConfigPrintFormat accepts text and json", () => {
    expect(parseConfigPrintFormat("text")).toBe("text");
    expect(parseConfigPrintFormat("json")).toBe("json");
  });

  it("parseConfigPrintFormat rejects invalid values", () => {
    expect(() => parseConfigPrintFormat("xml")).toThrow(CliUsageError);
    expect(() => parseConfigPrintFormat("xml")).toThrow(/Invalid --format/);
    expect(() => parseConfigPrintFormat("xml")).toThrow(/text or json/);
  });

  it("parsePositiveInteger accepts positive integers", () => {
    expect(parsePositiveInteger("20", "--top")).toBe(20);
    expect(parsePositiveInteger("3", "--concurrency")).toBe(3);
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
        "--concurrency",
        "--sequential",
        "--no-overlap",
        "--include",
        "--exclude",
        "--include-tests",
        "--baseline",
        "--config",
        "--quiet",
        "--no-progress",
        "--verbose",
        "--warnings",
        "--only",
        "--no-triage-hints",
        "--no-color",
        "--explain",
        "--strict",
      ]),
    );
  });

  it("scan help lists --warnings with summary default", () => {
    const help = getScanHelpText();

    expect(help).toContain("--warnings");
    expect(help).toMatch(/summary\|full\|json/);
    expect(help).toMatch(/default:\s*"summary"/);
  });

  it("scan help lists --strict", () => {
    const help = getScanHelpText();

    expect(help).toContain("--strict");
    expect(help).toMatch(/COMPARE_SINCE_MISMATCH/);
  });

  it("scan help lists --sequential and --no-overlap with alias language", () => {
    const help = getScanHelpText();

    expect(help).toContain("--sequential");
    expect(help).toContain("--no-overlap");
    expect(help).toMatch(/alias for --sequential/i);
    expect(help).not.toMatch(/\bM\d+\b/);
    expect(help).toMatch(/concurrent|sequential/i);
  });

  it("scan help lists --include-tests", () => {
    const help = getScanHelpText();

    expect(help).toContain("--include-tests");
    expect(help).toMatch(/test files/i);
  });

  it("scan help lists --explain", () => {
    const help = getScanHelpText();

    expect(help).toContain("--explain");
    expect(help).toMatch(/score breakdown/);
  });

  it("scan help lists --fail-on-explain-miss", () => {
    const help = getScanHelpText();

    expect(help).toContain("--fail-on-explain-miss");
    expect(help).toMatch(/not found/i);
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
    expect(help).toMatch(/-f table -t 10/);
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
  });

  it("exposes short aliases on scan options", () => {
    const program = createCliProgram();
    const scan = program.commands.find((command) => command.name() === "scan");

    expect(scan?.options.map((option) => option.short)).toEqual(
      expect.arrayContaining(["-f", "-o", "-t"]),
    );
    expect(scan?.options.map((option) => option.long)).toEqual(
      expect.arrayContaining([
        "--format",
        "--output",
        "--top",
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

  it("exposes config validate and print subcommands", () => {
    const program = createCliProgram();
    const config = program.commands.find((command) => command.name() === "config");

    expect(config).toBeDefined();
    const subcommands = config?.commands.map((command) => command.name()) ?? [];
    expect(subcommands).toEqual(expect.arrayContaining(["validate", "print"]));

    const print = config?.commands.find((command) => command.name() === "print");
    expect(print?.options.map((option) => option.long)).toEqual(
      expect.arrayContaining([
        "--since",
        "--format",
        "--top",
        "--concurrency",
        "--include",
        "--exclude",
        "--config",
      ]),
    );
  });

  it("config print help lists --format text default", () => {
    const program = createCliProgram();
    const config = program.commands.find((command) => command.name() === "config");
    const print = config?.commands.find((command) => command.name() === "print");
    const chunks: string[] = [];
    print?.configureOutput({
      writeOut: (str) => {
        chunks.push(str);
      },
      writeErr: (str) => {
        chunks.push(str);
      },
    });
    print?.outputHelp();

    expect(chunks.join("")).toContain("--format");
    expect(chunks.join("")).toContain("text");
  });

  it("exposes doctor command with --config and --include-tests", () => {
    const program = createCliProgram();
    const doctor = program.commands.find(
      (command) => command.name() === "doctor",
    );

    expect(doctor).toBeDefined();
    const optionLongs = doctor?.options.map((option) => option.long) ?? [];
    expect(optionLongs).toContain("--config");
    expect(optionLongs).toContain("--include-tests");
    expect(optionLongs).toContain("--format");
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
        "--top",
        "--concurrency",
        "--sequential",
        "--no-overlap",
        "--include",
        "--exclude",
        "--include-tests",
        "--config",
        "--quiet",
        "--no-progress",
        "--verbose",
        "--warnings",
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
    expect(help).toContain("--quiet");
    expect(help).toContain("--no-progress");
    expect(help).toContain("--verbose");
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
        "--concurrency",
        "--sequential",
        "--no-overlap",
        "--include",
        "--exclude",
        "--include-tests",
        "--config",
        "--quiet",
        "--no-progress",
        "--verbose",
        "--warnings",
        "--only",
        "--no-triage-hints",
        "--no-color",
        "--explain",
        "--strict",
      ]),
    );
    expect(compare?.options.map((option) => option.long)).not.toContain(
      "--dry-run",
    );
  });

  it("compare help lists --warnings with summary default", () => {
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

    expect(help).toContain("--warnings");
    expect(help).toMatch(/summary\|full\|json/);
    expect(help).toMatch(/default:\s*"summary"/);
  });

  it("compare help lists --explain and --strict", () => {
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

    expect(help).toContain("--explain");
    expect(help).toMatch(/compare delta/i);
    expect(help).toContain("--fail-on-explain-miss");
    expect(help).toContain("--strict");
    expect(help).toMatch(/COMPARE_SINCE_MISMATCH/);
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

    expect(help).toMatch(/--baseline[\s\S]*required/i);
    expect(help).toContain("Baseline ScanResult JSON");
    expect(help).toContain("Examples:");
    expect(help).toMatch(/compare --baseline/);
  });

  it("exposes completion command with shell argument", () => {
    const program = createCliProgram();
    const completion = program.commands.find(
      (command) => command.name() === "completion",
    );

    expect(completion).toBeDefined();
    expect(completion?.registeredArguments).toHaveLength(1);
    expect(completion?.registeredArguments[0]?.name()).toBe("shell");
  });

  it("completion help documents bash, zsh, and fish", () => {
    const program = createCliProgram();
    const completion = program.commands.find(
      (command) => command.name() === "completion",
    );
    const chunks: string[] = [];
    completion?.configureOutput({
      writeOut: (str) => {
        chunks.push(str);
      },
      writeErr: (str) => {
        chunks.push(str);
      },
    });
    completion?.outputHelp();
    const help = chunks.join("");

    expect(help).toMatch(/bash.*zsh.*fish|bash \| zsh \| fish/);
    expect(help).toContain("Supported shells:");
    expect(help).toContain("hotspot-scanner completion bash");
  });
});

const LOCKED_COMMANDS = [
  "init",
  "doctor",
  "scan",
  "baseline",
  "compare",
  "completion",
] as const;

const REPRESENTATIVE_SCAN_FLAGS = [
  "--format",
  "--output",
  "--exclude",
  "--include",
  "--config",
  "--since",
  "--warnings",
  "--quiet",
  "--verbose",
  "--no-progress",
  "--fail-on-explain-miss",
  "--csv-single-file",
] as const;

const WARNINGS_JSON_TEXT = "summary|full|json";

function expectCompletionScriptBasics(script: string): void {
  for (const command of LOCKED_COMMANDS) {
    expect(script).toContain(command);
  }
  for (const flag of REPRESENTATIVE_SCAN_FLAGS) {
    expect(script).toContain(flag);
  }
  expect(script).not.toContain("--granularity");
  expect(script).not.toContain("functions");
  expect(script).toContain("save");
}

function expectWarningsJsonText(shell: string, script: string): void {
  if (shell === "bash") {
    expect(script).toContain("--warnings");
    return;
  }
  expect(script).toContain(WARNINGS_JSON_TEXT);
}

describe("getCompletionScript", () => {
  it.each(COMPLETION_SHELLS)("returns a non-empty %s script with commands and flags", (shell) => {
    const script = getCompletionScript(shell);

    expect(script.length).toBeGreaterThan(0);
    expectCompletionScriptBasics(script);
    expectWarningsJsonText(shell, script);
  });

  it("rejects unknown shells with CliUsageError listing allowed shells", () => {
    expect(() => getCompletionScript("powershell")).toThrow(CliUsageError);
    expect(() => getCompletionScript("powershell")).toThrow(/Invalid shell/);
    expect(() => getCompletionScript("powershell")).toThrow(/bash/);
    expect(() => getCompletionScript("powershell")).toThrow(/zsh/);
    expect(() => getCompletionScript("powershell")).toThrow(/fish/);
  });
});

describe("runCli completion", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(COMPLETION_SHELLS)("prints %s completion script to stdout", async (shell) => {
    const runScanSpy = vi.spyOn(scan, "runScan");
    const { chunks } = captureStdout();

    await runCli(["node", "hotspot-scanner", "completion", shell]);

    const output = chunks.join("");
    expect(output.length).toBeGreaterThan(0);
    expectCompletionScriptBasics(output);
    expectWarningsJsonText(shell, output);
    expect(runScanSpy).not.toHaveBeenCalled();
  });

  it("throws CliUsageError for invalid shell", async () => {
    await expect(
      runCli(["node", "hotspot-scanner", "completion", "nushell"]),
    ).rejects.toThrow(CliUsageError);
    await expect(
      runCli(["node", "hotspot-scanner", "completion", "nushell"]),
    ).rejects.toThrow(/bash/);
    await expect(
      runCli(["node", "hotspot-scanner", "completion", "nushell"]),
    ).rejects.toThrow(/zsh/);
    await expect(
      runCli(["node", "hotspot-scanner", "completion", "nushell"]),
    ).rejects.toThrow(/fish/);
  });
});

describe("resolveSequentialCliOption", () => {
  it("returns true when --sequential is set", () => {
    expect(resolveSequentialCliOption({ sequential: true })).toBe(true);
  });

  it("returns true when --no-overlap is set", () => {
    expect(resolveSequentialCliOption({ noOverlap: true })).toBe(true);
  });

  it("returns true when Commander sets overlap to false", () => {
    expect(resolveSequentialCliOption({ overlap: false })).toBe(true);
  });

  it("returns false when neither flag is set", () => {
    expect(resolveSequentialCliOption({})).toBe(false);
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
  it("accepts hotspots only", () => {
    expect(parseOnlySectionCli("hotspots")).toBe("hotspots");
  });

  it("rejects functions and invalid values", () => {
    expect(() => parseOnlySectionCli("functions")).toThrow(CliUsageError);
    expect(() => parseOnlySectionCli("functions")).toThrow(
      /Invalid --only: functions\. Expected hotspots\./,
    );
    expect(() => parseOnlySectionCli("bogus")).toThrow(CliUsageError);
    expect(() => parseOnlySectionCli("bogus")).toThrow(
      /Invalid --only: bogus\. Expected hotspots\./,
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
    expect(collectOnlySection("hotspots", ["hotspots"])).toEqual([
      "hotspots",
      "hotspots",
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
        /baseline save/,
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
        /baseline save/,
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
  it("rejects path:function targets", () => {
    expect(() => validateExplainTarget("src/a.ts:run")).toThrow(CliUsageError);
    expect(() => validateExplainTarget("src/a.ts:run")).toThrow(
      /--explain does not support path:function/,
    );
  });

  it("allows plain file paths", () => {
    expect(() => validateExplainTarget("src/a.ts")).not.toThrow();
  });
});

describe("maybeRewritePathToScan", () => {
  const nodeArgv = ["node", "hotspot-scanner"] as const;

  it.each([
    [".", ["."]],
    ["./repo", ["./repo"]],
    ["/abs/repo", ["/abs/repo"]],
  ])("rewrites path-like token %s to scan", (pathToken, tail) => {
    const argv = [...nodeArgv, pathToken, ...tail.slice(1)] as string[];
    expect(maybeRewritePathToScan(argv)).toEqual([
      ...nodeArgv,
      "scan",
      pathToken,
      ...tail.slice(1),
    ]);
  });

  it("rewrites an existing directory to scan", () => {
    expect(maybeRewritePathToScan([...nodeArgv, smallTsFixture])).toEqual([
      ...nodeArgv,
      "scan",
      smallTsFixture,
    ]);
  });

  it("preserves trailing scan flags after rewrite", () => {
    expect(
      maybeRewritePathToScan([
        ...nodeArgv,
        ".",
        "--format",
        "json",
      ]),
    ).toEqual([...nodeArgv, "scan", ".", "--format", "json"]);
  });

  it.each([
    ["bare argv", [...nodeArgv]],
    ["known subcommand scan", [...nodeArgv, "scan", "."]],
    ["known subcommand init", [...nodeArgv, "init", "."]],
    ["known subcommand doctor", [...nodeArgv, "doctor", "."]],
    ["known subcommand baseline", [...nodeArgv, "baseline", "save", "."]],
    ["known subcommand compare", [...nodeArgv, "compare", ".", "--baseline", "b.json"]],
    ["known subcommand completion", [...nodeArgv, "completion", "bash"]],
    ["help token", [...nodeArgv, "--help"]],
    ["version token", [...nodeArgv, "--version"]],
    ["flag token", [...nodeArgv, "--quiet"]],
    ["non-path token", [...nodeArgv, "not-a-command"]],
  ])("does not rewrite %s", (_label, argv) => {
    expect(maybeRewritePathToScan(argv)).toEqual(argv);
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
      version: "3.0",
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
          parseFailed: false,
        },
      ],
      functions: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "file",
        warnings: [],
      },
    });
    const { chunks } = captureStdout();

    await runCli(["node", "hotspot-scanner", "scan", ".", "--format", "table"]);

    const output = chunks.join("");
    expect(output).toContain("Scan window:");
    expect(output).toContain("Top Hotspots");
  });

  it("prints JSON on successful scan", async () => {
    vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "3.0",
      hotspots: [],
      functions: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "file",
      },
    });
    const { chunks } = captureStdout();

    await runCli(["node", "hotspot-scanner", "scan", ".", "--format", "json"]);

    const parsed = JSON.parse(chunks.join("")) as { version: string };
    expect(parsed.version).toBe("3.0");
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
        version: "3.0",
        hotspots: [],
        functions: [],
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
      "since=12 months ago · git 1,000 commits…\n",
    );
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
        version: "3.0",
        hotspots: [],
        functions: [],
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
      "since=12 months ago · complexity [##########----------] 50/100 files · batch 1/2\n",
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
        version: "3.0",
        hotspots: [],
        functions: [],
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
        version: "3.0",
        hotspots: [],
        functions: [],
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
      version: "3.0",
      hotspots: [],
      functions: [],
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

  it("throws CliUsageError for invalid --warnings", async () => {
    captureStdout();

    await expect(
      runCli([
        "node",
        "hotspot-scanner",
        "scan",
        ".",
        "--warnings",
        "brief",
      ]),
    ).rejects.toThrow(CliUsageError);
    await expect(
      runCli([
        "node",
        "hotspot-scanner",
        "scan",
        ".",
        "--warnings",
        "brief",
      ]),
    ).rejects.toThrow(/Invalid --warnings.*summary, full, or json/);
  });

  it("aggregates rename warnings on stderr under default summary mode", async () => {
    const renameWarnings = buildAmbiguousRenameWarnings(5);
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(scan, "runScan").mockImplementation(async (options) => {
      for (const warning of renameWarnings) {
        options.onWarning?.(warning);
      }
      return {
        version: "3.0",
        hotspots: [],
        functions: [],
        meta: {
          since: "12 months ago",
          scannedAt: "2026-01-01T00:00:00.000Z",
          granularity: "file",
          warnings: renameWarnings,
        },
      };
    });
    captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      ".",
      "--format",
      "json",
    ]);

    const stderr = stderrSpy.mock.calls.map((call) => String(call[0])).join("");
    expect(stderr).toContain(
      "warning: Rename history may be incomplete for 5 path(s).",
    );
    for (const warning of renameWarnings) {
      expect(stderr).not.toContain(warning.message);
    }
  });

  it("keeps meta.warnings complete under summary, full, and json modes", async () => {
    const renameWarnings = buildAmbiguousRenameWarnings(8);
    const metaLengths: number[] = [];

    for (const modeArgs of [
      [],
      ["--warnings", "summary"],
      ["--warnings", "full"],
      ["--warnings", "json"],
    ]) {
      vi.restoreAllMocks();
      const { chunks, restore } = captureStdout();
      vi.spyOn(scan, "runScan").mockImplementation(async (options) => {
        for (const warning of renameWarnings) {
          options.onWarning?.(warning);
        }
        return {
          version: "3.0",
          hotspots: [],
          functions: [],
          meta: {
            since: "12 months ago",
            scannedAt: "2026-01-01T00:00:00.000Z",
            granularity: "file",
            warnings: renameWarnings,
          },
        };
      });
      vi.spyOn(process.stderr, "write").mockImplementation(() => true);

      await runCli([
        "node",
        "hotspot-scanner",
        "scan",
        ".",
        "--format",
        "json",
        ...modeArgs,
      ]);

      const parsed = JSON.parse(chunks.join("")) as {
        meta: { warnings: ScanWarning[] };
      };
      metaLengths.push(parsed.meta.warnings.length);
      restore();
    }

    expect(metaLengths).toEqual([8, 8, 8, 8]);
  });

  it("emits parseable stderr JSON under --warnings=json", async () => {
    const renameWarnings = buildAmbiguousRenameWarnings(5);
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(scan, "runScan").mockImplementation(async (options) => {
      for (const warning of renameWarnings) {
        options.onWarning?.(warning);
      }
      return {
        version: "3.0",
        hotspots: [],
        functions: [],
        meta: {
          since: "12 months ago",
          scannedAt: "2026-01-01T00:00:00.000Z",
          granularity: "file",
          warnings: renameWarnings,
        },
      };
    });
    captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      ".",
      "--format",
      "json",
      "--warnings",
      "json",
    ]);

    const stderr = stderrSpy.mock.calls.map((call) => String(call[0])).join("");
    const jsonLine = stderr
      .split("\n")
      .find((line) => line.startsWith('{"warnings":'));
    expect(jsonLine).toBeDefined();
    const parsed = JSON.parse(jsonLine!) as { warnings: ScanWarning[] };
    expect(parsed.warnings).toEqual(renameWarnings);
    expect(stderr).not.toContain(
      "warning: Rename history may be incomplete for 5 path(s).",
    );
  });

  it("emits empty warnings array on stderr under --warnings=json with no warnings", async () => {
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "3.0",
      hotspots: [],
      functions: [],
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
      "--format",
      "json",
      "--warnings",
      "json",
    ]);

    const stderr = stderrSpy.mock.calls.map((call) => String(call[0])).join("");
    expect(stderr).toContain('{"warnings":[]}');
  });

  it("expands per-path rename warnings on stderr with --warnings=full", async () => {
    const renameWarnings = buildAmbiguousRenameWarnings(3);
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(scan, "runScan").mockImplementation(async (options) => {
      for (const warning of renameWarnings) {
        options.onWarning?.(warning);
      }
      return {
        version: "3.0",
        hotspots: [],
        functions: [],
        meta: {
          since: "12 months ago",
          scannedAt: "2026-01-01T00:00:00.000Z",
          granularity: "file",
          warnings: renameWarnings,
        },
      };
    });
    captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      ".",
      "--format",
      "table",
      "--warnings",
      "full",
    ]);

    for (const warning of renameWarnings) {
      expect(stderrSpy).toHaveBeenCalledWith(`warning: ${warning.message}\n`);
    }
    expect(stderrSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("for 3 path(s)"),
    );
  });

  it("emits full warning detail under --quiet --warnings=full while suppressing info", async () => {
    const renameWarnings = buildAmbiguousRenameWarnings(2);
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
      for (const warning of renameWarnings) {
        options.onWarning?.(warning);
      }
      return {
        version: "3.0",
        hotspots: [],
        functions: [],
        meta: {
          since: "12 months ago",
          scannedAt: "2026-01-01T00:00:00.000Z",
          granularity: "file",
          warnings: renameWarnings,
        },
      };
    });
    captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      ".",
      "--format",
      "table",
      "--quiet",
      "--warnings",
      "full",
    ]);

    expect(stderrSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Processing git commit"),
    );
    expect(stderrSpy).not.toHaveBeenCalledWith("info: info diagnostic\n");
    for (const warning of renameWarnings) {
      expect(stderrSpy).toHaveBeenCalledWith(`warning: ${warning.message}\n`);
    }
  });

  it("does not expand warnings when --verbose is set without --warnings=full", async () => {
    const renameWarnings = buildAmbiguousRenameWarnings(4);
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(scan, "runScan").mockImplementation(async (options) => {
      options.onSpawnArgv?.(["git", "-C", "/repo", "log", "--numstat"]);
      for (const warning of renameWarnings) {
        options.onWarning?.(warning);
      }
      return {
        version: "3.0",
        hotspots: [],
        functions: [],
        meta: {
          since: "12 months ago",
          scannedAt: "2026-01-01T00:00:00.000Z",
          granularity: "file",
          warnings: renameWarnings,
        },
      };
    });
    captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      ".",
      "--format",
      "table",
      "--verbose",
    ]);

    expect(stderrSpy).toHaveBeenCalledWith(
      "verbose: git git -C /repo log --numstat\n",
    );
    const stderr = stderrSpy.mock.calls.map((call) => String(call[0])).join("");
    expect(stderr).toContain(
      "warning: Rename history may be incomplete for 4 path(s).",
    );
    for (const warning of renameWarnings) {
      expect(stderr).not.toContain(warning.message);
    }
  });

  it("forwards --warnings on baseline save", async () => {
    const renameWarnings = buildAmbiguousRenameWarnings(3);
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-warnings-"));
    const originalCwd = process.cwd();
    vi.spyOn(scan, "runScan").mockImplementation(async (options) => {
      for (const warning of renameWarnings) {
        options.onWarning?.(warning);
      }
      return {
        ...mockScanResult(),
        meta: {
          ...mockScanResult().meta,
          warnings: renameWarnings,
        },
      };
    });
    captureStdout();

    try {
      process.chdir(tempDir);
      await runCli([
        "node",
        "hotspot-scanner",
        "baseline",
        "save",
        ".",
        "--warnings",
        "summary",
      ]);
    } finally {
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }

    const stderr = stderrSpy.mock.calls.map((call) => String(call[0])).join("");
    expect(stderr).toContain(
      "warning: Rename history may be incomplete for 3 path(s).",
    );
  });

  it("writes report to file under --quiet", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-test-"));
    const outputPath = join(tempDir, "report.json");
    vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "3.0",
      hotspots: [],
      functions: [],
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
      expect(parsed.version).toBe("3.0");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("appends newline when reporter output omits trailing newline", async () => {
    vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "3.0",
      hotspots: [],
      functions: [],
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
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "3.0",
      hotspots: [
        {
          filePath: "src/hot.ts",
          complexityNormalized: 0.9,
          churnNormalized: 0.9444,
          hotspotScore: 0.85,
          ncloc: 42,
          commitCount: 15,
          linesChanged: 320,
          authorCount: 3,
        },
      ],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        warnings: [],
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
      expect(JSON.parse(metaContent).kind).toBe("scan");
      expect(hotspotsContent.split("\n")[0]).toBe(
        "rank,file,score,ncloc,nclocN,churn,churnN,authors,lines",
      );
      const stderr = stderrSpy.mock.calls.map(([chunk]) => String(chunk)).join("");
      expect(stderr).toContain("Wrote CSV bundle:");
      expect(stderr).toContain(`  ${join(tempDir, "report.hotspots.csv")}`);
      expect(stderr).toContain(`  ${join(tempDir, "report.meta.json")}`);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("suppresses CSV bundle confirmation under --quiet", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-test-"));
    const outputPath = join(tempDir, "report.csv");
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(scan, "runScan").mockResolvedValue(mockScanResult());
    captureStdout();

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
        "--quiet",
      ]);

      const stderr = stderrSpy.mock.calls.map(([chunk]) => String(chunk)).join("");
      expect(stderr).not.toContain("Wrote CSV bundle:");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("writes scan hotspots CSV to exact --output with --csv-single-file", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-test-"));
    const outputPath = join(tempDir, "hotspots-only.csv");
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "3.0",
      hotspots: [
        {
          filePath: "src/hot.ts",
          complexityNormalized: 0.9,
          churnNormalized: 0.9444,
          hotspotScore: 0.85,
          ncloc: 42,
          commitCount: 15,
          linesChanged: 320,
          authorCount: 3,
        },
      ],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        warnings: [],
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
        "--csv-single-file",
      ]);

      expect(chunks.join("")).toBe("");
      const fs = await import("node:fs/promises");
      const hotspotsContent = await fs.readFile(outputPath, "utf8");
      expect(hotspotsContent.split("\n")[0]).toBe(
        "rank,file,score,ncloc,nclocN,churn,churnN,authors,lines",
      );
      await expect(
        fs.access(join(tempDir, "hotspots-only.meta.json")),
      ).rejects.toThrow();
      await expect(
        fs.access(join(tempDir, "hotspots-only.hotspots.csv")),
      ).rejects.toThrow();
      const stderr = stderrSpy.mock.calls.map(([chunk]) => String(chunk)).join("");
      expect(stderr).not.toContain("Wrote CSV bundle:");
      expect(stderr).toContain(`Wrote ${outputPath}`);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("confirms successful --output writes on stderr", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-write-confirm-"));
    const outputPath = join(tempDir, "report.json");
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(scan, "runScan").mockResolvedValue(mockScanResult());
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

      const stderr = stderrSpy.mock.calls.map(([chunk]) => String(chunk)).join("");
      expect(stderr).toContain(`Wrote ${outputPath}`);
      expect(chunks.join("")).toBe("");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("suppresses single-file write confirm under --quiet", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-write-confirm-"));
    const outputPath = join(tempDir, "report.md");
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(scan, "runScan").mockResolvedValue(mockScanResult());
    captureStdout();

    try {
      await runCli([
        "node",
        "hotspot-scanner",
        "scan",
        ".",
        "--format",
        "markdown",
        "--output",
        outputPath,
        "--quiet",
      ]);

      const stderr = stderrSpy.mock.calls.map(([chunk]) => String(chunk)).join("");
      expect(stderr).not.toContain(`Wrote ${outputPath}`);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("does not confirm stdout-only scan output", async () => {
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(scan, "runScan").mockResolvedValue(mockScanResult());
    const { chunks } = captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      ".",
      "--format",
      "json",
    ]);

    const stderr = stderrSpy.mock.calls.map(([chunk]) => String(chunk)).join("");
    expect(stderr).not.toMatch(/^Wrote /m);
    expect(chunks.join("")).toContain('"version": "3.0"');
  });

  it("throws CliUsageError when --csv-single-file is used without --format csv", async () => {
    vi.spyOn(scan, "runScan").mockResolvedValue(mockScanResult());
    captureStdout();

    await expect(
      runCli([
        "node",
        "hotspot-scanner",
        "scan",
        ".",
        "--csv-single-file",
        "--output",
        "out.csv",
      ]),
    ).rejects.toThrow(CliUsageError);
    await expect(
      runCli([
        "node",
        "hotspot-scanner",
        "scan",
        ".",
        "--csv-single-file",
        "--output",
        "out.csv",
      ]),
    ).rejects.toThrow(/--csv-single-file requires --format csv/);
  });

  it("pickSingleFileCsvContent throws when hotspots CSV key is missing", () => {
    expect(() =>
      scanActions.pickSingleFileCsvContent({}, "hotspots.csv"),
    ).toThrow(CliUsageError);
    expect(() =>
      scanActions.pickSingleFileCsvContent({}, "hotspots.csv"),
    ).toThrow(/--csv-single-file requires hotspots CSV content/);
  });

  it("throws CliUsageError when --format csv is used without --output", async () => {
    vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "3.0",
      hotspots: [],
      functions: [],
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
      version: "3.0",
      hotspots: [],
      functions: [],
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
      expect(parsed.version).toBe("3.0");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("overwrites existing output file", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-test-"));
    const outputPath = join(tempDir, "report.json");
    await writeFile(outputPath, "old content", "utf8");
    vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "3.0",
      hotspots: [],
      functions: [],
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
      expect(parsed.version).toBe("3.0");
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
        version: "3.0",
        hotspots: [],
        functions: [],
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

  it("rewrites path-first argv to scan", async () => {
    const runScanSpy = vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "3.0",
      hotspots: [],
      functions: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "file",
        warnings: [],
      },
    });
    const { chunks } = captureStdout();

    await runCli(["node", "hotspot-scanner", ".", "--format", "table"]);

    expect(runScanSpy).toHaveBeenCalled();
    expect(chunks.join("")).toContain("Scan window:");
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
      version: "3.0",
      hotspots: [],
      functions: [],
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
      version: "3.0",
      hotspots: [],
      functions: [],
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
      version: "3.0",
      hotspots: [],
      functions: [],
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
      version: "3.0",
      hotspots: [],
      functions: [],
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

  it("forwards --sequential to runScan when explicitly set", async () => {
    const runScanSpy = vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "3.0",
      hotspots: [],
      functions: [],
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
      "--sequential",
      "--format",
      "table",
    ]);

    expect(runScanSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        sequential: true,
      }),
    );
  });

  it("forwards --no-overlap to runScan as sequential: true", async () => {
    const runScanSpy = vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "3.0",
      hotspots: [],
      functions: [],
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
      "--no-overlap",
      "--format",
      "table",
    ]);

    expect(runScanSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        sequential: true,
      }),
    );
  });

  it("accepts both --sequential and --no-overlap without CliUsageError", async () => {
    const runScanSpy = vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "3.0",
      hotspots: [],
      functions: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "file",
        warnings: [],
      },
    });
    captureStdout();

    await expect(
      runCli([
        "node",
        "hotspot-scanner",
        "scan",
        ".",
        "--sequential",
        "--no-overlap",
        "--format",
        "table",
      ]),
    ).resolves.toBeUndefined();

    expect(runScanSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        sequential: true,
      }),
    );
  });

  it("omits sequential on runScan when neither flag is set", async () => {
    const runScanSpy = vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "3.0",
      hotspots: [],
      functions: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "file",
        warnings: [],
      },
    });
    captureStdout();

    await runCli(["node", "hotspot-scanner", "scan", ".", "--format", "table"]);

    const call = runScanSpy.mock.calls[0]?.[0];
    expect(call).toBeDefined();
    expect(call).not.toHaveProperty("sequential");
  });

  it("accepts --sequential without granularity flag", async () => {
    const runScanSpy = vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "3.0",
      hotspots: [],
      functions: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        warnings: [],
      },
    });
    captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      smallTsFixture,
      "--sequential",
      "--format",
      "table",
    ]);

    expect(runScanSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        sequential: true,
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
        version: "3.0",
        hotspots: [],
        functions: [],
        meta: {
          since: "6 months ago",
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
        repoPath,
        "--format",
        "table",
      ]);

      expect(runScanSpy).toHaveBeenCalledWith({
        repoPath,
        onWarning: expect.any(Function),
        onProgress: expect.any(Function),
        signal: expect.any(AbortSignal),
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
        version: "3.0",
        hotspots: [],
        functions: [],
        meta: {
          since: "1 week ago",
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
          signal: expect.any(AbortSignal),
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
        version: "3.0",
        hotspots: [],
        functions: [],
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

  it("forwards --include-tests to runScan on scan", async () => {
    const runScanSpy = vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "3.0",
      hotspots: [],
      functions: [],
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
      "--include-tests",
      "--format",
      "table",
    ]);

    expect(runScanSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        includeTests: true,
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("omits includeTests on runScan when --include-tests is not set", async () => {
    const runScanSpy = vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "3.0",
      hotspots: [],
      functions: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "file",
        warnings: [],
      },
    });
    captureStdout();

    await runCli(["node", "hotspot-scanner", "scan", ".", "--format", "table"]);

    const call = runScanSpy.mock.calls[0]?.[0];
    expect(call).toBeDefined();
    expect(call).not.toHaveProperty("includeTests");
    expect(call).toHaveProperty("signal");
  });

  it("forwards --include-tests with --exclude to runScan", async () => {
    const runScanSpy = vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "3.0",
      hotspots: [],
      functions: [],
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
      "--include-tests",
      "--exclude",
      "legacy/**",
    ]);

    expect(runScanSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        includeTests: true,
        exclude: ["legacy/**"],
      }),
    );
  });

  it("forwards include and exclude patterns to runScan", async () => {
    const runScanSpy = vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "3.0",
      hotspots: [],
      functions: [],
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

  it("accepts short aliases -f -o -t equivalent to long flags", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-test-"));
    const outputPath = join(tempDir, "report.json");
    const runScanSpy = vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "3.0",
      hotspots: [],
      functions: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    const render = vi.fn(() => '{"version":"3.0"}\n');
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
      ]);

      expect(runScanSpy).toHaveBeenCalled();
      expect(render).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ format: "json", top: 5 }),
      );
      expect(chunks.join("")).toBe("");
      const fileContent = await import("node:fs/promises").then((fs) =>
        fs.readFile(outputPath, "utf8"),
      );
      expect(JSON.parse(fileContent).version).toBe("3.0");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("long flags still work alongside short aliases", async () => {
    const runScanSpy = vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "3.0",
      hotspots: [],
      functions: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
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
    ]);

    expect(runScanSpy).toHaveBeenCalled();
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

  it("rejects --only functions before scan", async () => {
    const runScanSpy = vi.spyOn(scan, "runScan");

    await expect(
      runCli([
        "node",
        "hotspot-scanner",
        "scan",
        ".",
        "--format",
        "json",
        "--only",
        "functions",
      ]),
    ).rejects.toThrow(CliUsageError);
    await expect(
      runCli([
        "node",
        "hotspot-scanner",
        "scan",
        ".",
        "--format",
        "json",
        "--only",
        "functions",
      ]),
    ).rejects.toThrow(/Invalid --only: functions/);

    expect(runScanSpy).not.toHaveBeenCalled();
  });

  it("forwards --only hotspots to reporter for JSON output", async () => {
    vi.spyOn(scan, "runScan").mockResolvedValue(loadTriageFixture());
    const render = vi.fn(() => '{"version":"3.0"}\n');
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
    ]);

    expect(render).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        only: ["hotspots"],
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
    const render = vi.fn(() => '{"version":"3.0"}\n');
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
    const scanResult = mockScanResult();
    await writeFile(baselinePath, JSON.stringify(scanResult), "utf8");
    vi.spyOn(scan, "runScan").mockResolvedValue(scanResult);
    const renderCompare = vi.fn(
      () =>
        '{"version":"3.0","hotspots":{"new":[],"removed":[],"rankChanged":[]}}\n',
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
      expect(chunks.join("")).toContain('"version":"3.0"');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("uses normal render when --baseline is omitted", async () => {
    const render = vi.fn(() => "normal-scan-output\n");
    vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "3.0",
      hotspots: [],
      functions: [],
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
      version: "3.0",
      hotspots: [],
      functions: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "file",
        warnings: [],
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
      version: "3.0",
      hotspots: [],
      functions: [],
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
      version: "3.0",
      hotspots: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
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
      ).rejects.toThrow(/baseline save/);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("writes explain block to stderr after report without altering JSON stdout", async () => {
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "3.0",
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
          parseFailed: false,
        },
      ],
      functions: [],
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
      version: "3.0",
      hotspots: [],
      functions: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "file",
        warnings: [],
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

  it("throws CliUsageError when --fail-on-explain-miss is set without --explain", async () => {
    const runScanSpy = vi.spyOn(scan, "runScan");
    captureStdout();

    await expect(
      runCli([
        "node",
        "hotspot-scanner",
        "scan",
        ".",
        "--fail-on-explain-miss",
      ]),
    ).rejects.toThrow(CliUsageError);
    await expect(
      runCli([
        "node",
        "hotspot-scanner",
        "scan",
        ".",
        "--fail-on-explain-miss",
      ]),
    ).rejects.toThrow(/--fail-on-explain-miss requires --explain/);

    expect(runScanSpy).not.toHaveBeenCalled();
  });

  it("exits 1 with --fail-on-explain-miss when explain target is missing", async () => {
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "3.0",
      hotspots: [],
      functions: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "file",
        warnings: [],
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
        "table",
        "--explain",
        "src/missing.ts",
        "--fail-on-explain-miss",
      ]),
    ).rejects.toThrow(CliExitError);
    await expect(
      runCli([
        "node",
        "hotspot-scanner",
        "scan",
        ".",
        "--format",
        "table",
        "--explain",
        "src/missing.ts",
        "--fail-on-explain-miss",
      ]),
    ).rejects.toMatchObject({ exitCode: 1 });

    expect(stderrSpy).toHaveBeenCalledWith(
      "explain: no hotspot ranking for src/missing.ts\n",
    );
  });

  it("completes with exit 0 when --fail-on-explain-miss finds the explain target", async () => {
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "3.0",
      hotspots: [
        {
          filePath: "src/example.ts",
          hotspotScore: 0.88,
          complexityNormalized: 0.9,
          churnNormalized: 0.85,
          ncloc: 42,
          commitCount: 15,
          linesChanged: 320,
          authorCount: 3,
        },
      ],
      functions: [],
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
      "--format",
      "table",
      "--explain",
      "src/example.ts",
      "--fail-on-explain-miss",
    ]);

    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("=== Explain: src/example.ts (rank 1) ==="),
    );
  });

  it("throws CliUsageError for path:function explain before scan", async () => {
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
    ).rejects.toThrow(/--explain does not support path:function/);

    expect(runScanSpy).not.toHaveBeenCalled();
  });

  it("keeps report file unchanged when --explain is set with --output", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-test-"));
    const outputPath = join(tempDir, "report.json");
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "3.0",
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
      expect(parsed.version).toBe("3.0");
      expect(fileContent).not.toContain("=== Explain:");
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining("=== Explain: src/example.ts (rank 1) ==="),
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("writes compare explain on stderr for scan --baseline --explain without altering JSON stdout", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-test-"));
    const baselinePath = join(tempDir, "baseline.json");
    const baseline = loadCompareFixture("compare-baseline-file.json");
    const current = loadCompareFixture("compare-current-file.json");
    await writeFile(baselinePath, JSON.stringify(baseline), "utf8");
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(scan, "runScan").mockResolvedValue(current);
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
        "--explain",
        "src/new.ts",
      ]);

      const stdout = chunks.join("");
      expect(() => JSON.parse(stdout)).not.toThrow();
      expect(stdout).not.toContain("=== Explain:");
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining("=== Compare Explain: src/new.ts (new) ==="),
      );
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining("classification: new"),
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("exits 1 with --strict when since windows mismatch but still writes compare JSON", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-test-"));
    const baselinePath = join(tempDir, "baseline.json");
    const baseline = loadCompareFixture("compare-baseline-file.json");
    const current = {
      ...loadCompareFixture("compare-current-file.json"),
      meta: {
        ...loadCompareFixture("compare-current-file.json").meta,
        since: "12 months ago",
      },
    };
    await writeFile(baselinePath, JSON.stringify(baseline), "utf8");
    vi.spyOn(scan, "runScan").mockResolvedValue(current);
    const { chunks } = captureStdout();

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
          "json",
          "--strict",
        ]),
      ).rejects.toMatchObject({ exitCode: 1 });

      const stdout = chunks.join("");
      const parsed = JSON.parse(stdout) as { version: string };
      expect(parsed.version).toBe("3.0");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("completes with exit 0 when since windows mismatch without --strict", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-test-"));
    const baselinePath = join(tempDir, "baseline.json");
    const baseline = loadCompareFixture("compare-baseline-file.json");
    const current = {
      ...loadCompareFixture("compare-current-file.json"),
      meta: {
        ...loadCompareFixture("compare-current-file.json").meta,
        since: "12 months ago",
      },
    };
    await writeFile(baselinePath, JSON.stringify(baseline), "utf8");
    vi.spyOn(scan, "runScan").mockResolvedValue(current);
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

      expect(() => JSON.parse(chunks.join(""))).not.toThrow();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("does not exit 1 under --strict when only scan warnings are present", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-test-"));
    const baselinePath = join(tempDir, "baseline.json");
    const baseline = loadCompareFixture("compare-baseline-file.json");
    const current = {
      ...loadCompareFixture("compare-current-file.json"),
      meta: {
        ...loadCompareFixture("compare-current-file.json").meta,
        warnings: [
          {
            severity: "warning" as const,
            code: "EMPTY_SINCE_WINDOW",
            message: "No commits in since window",
          },
        ],
      },
    };
    await writeFile(baselinePath, JSON.stringify(baseline), "utf8");
    vi.spyOn(scan, "runScan").mockResolvedValue(current);
    captureStdout();

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
        "--strict",
      ]);
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

  it("prints verbose git argv lines when --verbose is set", async () => {
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(scan, "runScan").mockImplementation(async (options) => {
      options.onSpawnArgv?.(["git", "-C", "/repo", "log", "--numstat"]);
      return {
        version: "3.0",
        hotspots: [],
        functions: [],
        meta: {
          since: "12 months ago",
          scannedAt: "2026-01-01T00:00:00.000Z",
          granularity: "file",
          warnings: [],
        },
      };
    });
    captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      ".",
      "--format",
      "table",
      "--verbose",
    ]);

    expect(stderrSpy).toHaveBeenCalledWith(
      "verbose: git git -C /repo log --numstat\n",
    );
  });

  it("suppresses verbose git argv lines when --quiet wins", async () => {
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(scan, "runScan").mockImplementation(async (options) => {
      options.onSpawnArgv?.(["git", "-C", "/repo", "log", "--numstat"]);
      return {
        version: "3.0",
        hotspots: [],
        functions: [],
        meta: {
          since: "12 months ago",
          scannedAt: "2026-01-01T00:00:00.000Z",
          granularity: "file",
          warnings: [],
        },
      };
    });
    captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      ".",
      "--format",
      "table",
      "--verbose",
      "--quiet",
    ]);

    expect(stderrSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("verbose: git"),
    );
  });

  it("forwards onSpawnArgv to runScan when --verbose is set", async () => {
    const runScanSpy = vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "3.0",
      hotspots: [],
      functions: [],
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
      "--format",
      "table",
      "--verbose",
    ]);

    expect(runScanSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        onSpawnArgv: expect.any(Function),
      }),
    );
  });

  it("exits 130 on SIGINT during scan without writing report", async () => {
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    let scanStarted = false;
    vi.spyOn(scan, "runScan").mockImplementation((options) => {
      scanStarted = true;
      return new Promise((_resolve, reject) => {
        options.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });
    const { chunks } = captureStdout();

    const runPromise = runCli([
      "node",
      "hotspot-scanner",
      "scan",
      ".",
      "--format",
      "table",
    ]);
    await vi.waitFor(() => expect(scanStarted).toBe(true));
    const sigintListeners = process.listeners("SIGINT") as Array<() => void>;
    sigintListeners[sigintListeners.length - 1]?.();

    await expect(runPromise).rejects.toMatchObject({
      exitCode: 130,
      name: "ScanCancelExit",
    });
    expect(stderrSpy).toHaveBeenCalledWith("warning: scan cancelled\n");
    expect(chunks.join("")).toBe("");
  });

  it("exits 143 on SIGTERM during compare without writing report", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-cancel-"));
    const baselinePath = join(tempDir, "baseline.json");
    await writeFile(baselinePath, JSON.stringify(mockScanResult()), "utf8");
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    let scanStarted = false;
    vi.spyOn(scan, "runScan").mockImplementation((options) => {
      scanStarted = true;
      return new Promise((_resolve, reject) => {
        options.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });
    const { chunks } = captureStdout();

    try {
      const runPromise = runCli([
        "node",
        "hotspot-scanner",
        "compare",
        ".",
        "--baseline",
        baselinePath,
        "--format",
        "json",
      ]);
      await vi.waitFor(() => expect(scanStarted).toBe(true));
      const sigtermListeners = process.listeners("SIGTERM") as Array<() => void>;
      sigtermListeners[sigtermListeners.length - 1]?.();

      await expect(runPromise).rejects.toMatchObject({
        exitCode: 143,
        name: "ScanCancelExit",
      });
      expect(stderrSpy).toHaveBeenCalledWith("warning: scan cancelled\n");
      expect(chunks.join("")).toBe("");
    } finally {
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
      expect(loaded.version).toBe("3.0");
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
      expect(loaded.version).toBe("3.0");
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
      expect(loaded.version).toBe("3.0");
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

  it("forwards --include-tests to runScan on baseline save", async () => {
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
        "--include-tests",
      ]);

      expect(runScanSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          includeTests: true,
        }),
      );
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
        "--include",
        "src/**",
      ]);

      expect(runScanSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          repoPath: ".",
          since: "6 months ago",
          include: ["src/**"],
        }),
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("forwards --sequential to runScan on baseline save", async () => {
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
        "--sequential",
      ]);

      expect(runScanSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          sequential: true,
        }),
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("suppresses progress when --no-progress is set on baseline save", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-baseline-"));
    const outputPath = join(tempDir, "baseline.json");
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
      return mockScanResult();
    });
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
        "--no-progress",
      ]);

      expect(stderrSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("Processing git commit"),
      );
      expect(stderrSpy).toHaveBeenCalledWith("info: info diagnostic\n");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("suppresses progress and info warnings when --quiet is set on baseline save", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-baseline-"));
    const outputPath = join(tempDir, "baseline.json");
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
      return mockScanResult();
    });
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
        "--quiet",
      ]);

      expect(stderrSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("Processing git commit"),
      );
      expect(stderrSpy).not.toHaveBeenCalledWith("info: info diagnostic\n");
      expect(stderrSpy).toHaveBeenCalledWith("warning: warn diagnostic\n");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("prints verbose git argv lines when --verbose is set on baseline save", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-baseline-"));
    const outputPath = join(tempDir, "baseline.json");
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(scan, "runScan").mockImplementation(async (options) => {
      options.onSpawnArgv?.(["git", "-C", "/repo", "log", "--numstat"]);
      return mockScanResult();
    });
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
        "--verbose",
      ]);

      expect(stderrSpy).toHaveBeenCalledWith(
        "verbose: git git -C /repo log --numstat\n",
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("suppresses verbose git argv lines when --quiet wins on baseline save", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-baseline-"));
    const outputPath = join(tempDir, "baseline.json");
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(scan, "runScan").mockImplementation(async (options) => {
      options.onSpawnArgv?.(["git", "-C", "/repo", "log", "--numstat"]);
      return mockScanResult();
    });
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
        "--verbose",
        "--quiet",
      ]);

      expect(stderrSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("verbose: git"),
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("forwards onSpawnArgv to runScan when --verbose is set on baseline save", async () => {
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
        "--verbose",
      ]);

      expect(runScanSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          onSpawnArgv: expect.any(Function),
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

  it("forwards --include-tests to runScan on compare", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-compare-"));
    const baselinePath = join(tempDir, "baseline.json");
    const scanResult = mockScanResult();
    await writeFile(baselinePath, JSON.stringify(scanResult), "utf8");
    const runScanSpy = vi.spyOn(scan, "runScan").mockResolvedValue(scanResult);
    vi.spyOn(report, "createReporter").mockReturnValue({
      render: vi.fn(),
      renderCompare: vi.fn(() => '{"version":"3.0"}\n'),
    });
    captureStdout();

    try {
      await runCli([
        "node",
        "hotspot-scanner",
        "compare",
        ".",
        "--baseline",
        baselinePath,
        "--include-tests",
        "--format",
        "json",
      ]);

      expect(runScanSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          includeTests: true,
        }),
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("forwards --no-overlap to runScan on compare", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-compare-"));
    const baselinePath = join(tempDir, "baseline.json");
    const scanResult = mockScanResult();
    await writeFile(baselinePath, JSON.stringify(scanResult), "utf8");
    const runScanSpy = vi.spyOn(scan, "runScan").mockResolvedValue(scanResult);
    vi.spyOn(report, "createReporter").mockReturnValue({
      render: vi.fn(),
      renderCompare: vi.fn(() => '{"version":"3.0"}\n'),
    });
    captureStdout();

    try {
      await runCli([
        "node",
        "hotspot-scanner",
        "compare",
        ".",
        "--baseline",
        baselinePath,
        "--no-overlap",
        "--format",
        "json",
      ]);

      expect(runScanSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          sequential: true,
        }),
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
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
        '{"version":"3.0","hotspots":{"new":[],"removed":[],"rankChanged":[]}}\n',
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
      expect(chunks.join("")).toContain('"version":"3.0"');
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

  it("writes compare hotspots.new CSV to exact --output with --csv-single-file", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-compare-"));
    const outputPath = join(tempDir, "delta.csv");
    const baselinePath = join(tempDir, "baseline.json");
    const baseline = loadCompareFixture("compare-baseline-file.json");
    const current = loadCompareFixture("compare-current-file.json");
    await writeFile(baselinePath, JSON.stringify(baseline), "utf8");
    vi.spyOn(scan, "runScan").mockResolvedValue(current);
    captureStdout();

    try {
      await runCli([
        "node",
        "hotspot-scanner",
        "compare",
        ".",
        "--baseline",
        baselinePath,
        "--format",
        "csv",
        "--output",
        outputPath,
        "--csv-single-file",
      ]);

      const fs = await import("node:fs/promises");
      const hotspotsContent = await fs.readFile(outputPath, "utf8");
      expect(hotspotsContent.split("\n")[0]).toBe(
        "rank,file,score,ncloc,nclocN,churn,churnN,authors",
      );
      await expect(
        fs.access(join(tempDir, "delta.meta.json")),
      ).rejects.toThrow();
      await expect(
        fs.access(join(tempDir, "delta.hotspots.new.csv")),
      ).rejects.toThrow();
      await expect(
        fs.access(join(tempDir, "delta.hotspots.removed.csv")),
      ).rejects.toThrow();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("throws CliUsageError when compare --csv-single-file is used without --format csv", async () => {
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
          "--csv-single-file",
          "--output",
          "out.csv",
        ]),
      ).rejects.toThrow(/--csv-single-file requires --format csv/);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("writes compare explain on stderr for compare --explain without altering JSON stdout", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-compare-"));
    const baselinePath = join(tempDir, "baseline.json");
    const baseline = loadCompareFixture("compare-baseline-file.json");
    const current = loadCompareFixture("compare-current-file.json");
    await writeFile(baselinePath, JSON.stringify(baseline), "utf8");
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(scan, "runScan").mockResolvedValue(current);
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
        "--explain",
        "src/new.ts",
      ]);

      const stdout = chunks.join("");
      expect(() => JSON.parse(stdout)).not.toThrow();
      expect(stdout).not.toContain("=== Compare Explain:");
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining("=== Compare Explain: src/new.ts (new) ==="),
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("writes not-found compare explain message to stderr", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-compare-"));
    const baselinePath = join(tempDir, "baseline.json");
    const baseline = loadCompareFixture("compare-baseline-file.json");
    const current = loadCompareFixture("compare-current-file.json");
    await writeFile(baselinePath, JSON.stringify(baseline), "utf8");
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(scan, "runScan").mockResolvedValue(current);
    captureStdout();

    try {
      await runCli([
        "node",
        "hotspot-scanner",
        "compare",
        ".",
        "--baseline",
        baselinePath,
        "--format",
        "table",
        "--explain",
        "src/missing.ts",
      ]);

      expect(stderrSpy).toHaveBeenCalledWith(
        "explain: no compare delta for src/missing.ts\n",
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("throws CliUsageError when compare --fail-on-explain-miss is set without --explain", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-compare-"));
    const baselinePath = join(tempDir, "baseline.json");
    const baseline = loadCompareFixture("compare-baseline-file.json");
    await writeFile(baselinePath, JSON.stringify(baseline), "utf8");
    const runScanSpy = vi.spyOn(scan, "runScan");
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
          "--fail-on-explain-miss",
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
          "--fail-on-explain-miss",
        ]),
      ).rejects.toThrow(/--fail-on-explain-miss requires --explain/);

      expect(runScanSpy).not.toHaveBeenCalled();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("exits 1 with compare --fail-on-explain-miss when explain target is missing", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-compare-"));
    const baselinePath = join(tempDir, "baseline.json");
    const baseline = loadCompareFixture("compare-baseline-file.json");
    const current = loadCompareFixture("compare-current-file.json");
    await writeFile(baselinePath, JSON.stringify(baseline), "utf8");
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(scan, "runScan").mockResolvedValue(current);
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
          "table",
          "--explain",
          "src/missing.ts",
          "--fail-on-explain-miss",
        ]),
      ).rejects.toThrow(CliExitError);
      await expect(
        runCli([
          "node",
          "hotspot-scanner",
          "compare",
          ".",
          "--baseline",
          baselinePath,
          "--format",
          "table",
          "--explain",
          "src/missing.ts",
          "--fail-on-explain-miss",
        ]),
      ).rejects.toMatchObject({ exitCode: 1 });

      expect(stderrSpy).toHaveBeenCalledWith(
        "explain: no compare delta for src/missing.ts\n",
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("exits 1 with compare --strict when since windows mismatch", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-compare-"));
    const baselinePath = join(tempDir, "baseline.json");
    const baseline = loadCompareFixture("compare-baseline-file.json");
    const current = {
      ...loadCompareFixture("compare-current-file.json"),
      meta: {
        ...loadCompareFixture("compare-current-file.json").meta,
        since: "12 months ago",
      },
    };
    await writeFile(baselinePath, JSON.stringify(baseline), "utf8");
    vi.spyOn(scan, "runScan").mockResolvedValue(current);
    const { chunks } = captureStdout();

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
          "json",
          "--strict",
        ]),
      ).rejects.toMatchObject({ exitCode: 1 });

      expect(() => JSON.parse(chunks.join(""))).not.toThrow();
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
    expect(output).toMatch(/pass:.*eligible files: \d+/);
  });

  it("exits 0 on monorepo nested package path with remount and scope", async () => {
    const { chunks } = captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "doctor",
      monorepoApiPackagePath,
    ]);

    const output = chunks.join("");
    expect(output).toMatch(/pass:.*Git repository:.*monorepo-nested/);
    expect(output).toMatch(/pass:.*eligible files: \d+/);
    expect(output).toMatch(/remounted to git root/i);
  });

  it("reports scope eligible count matching dry-run for the same path", async () => {
    const doctorStdout = captureStdout();
    await runCli([
      "node",
      "hotspot-scanner",
      "doctor",
      monorepoApiPackagePath,
    ]);
    const doctorOutput = doctorStdout.chunks.join("");

    const dryRunStdout = captureStdout();
    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      monorepoApiPackagePath,
      "--dry-run",
    ]);
    const dryRunOutput = dryRunStdout.chunks.join("");

    expect(extractEligibleFileCount(doctorOutput)).toBe(
      extractEligibleFileCount(dryRunOutput),
    );
  });

  it("reports scope eligible count matching dry-run with --include-tests", async () => {
    const doctorStdout = captureStdout();
    await runCli([
      "node",
      "hotspot-scanner",
      "doctor",
      smallTsFixture,
      "--include-tests",
    ]);
    const doctorOutput = doctorStdout.chunks.join("");

    const dryRunStdout = captureStdout();
    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      smallTsFixture,
      "--dry-run",
      "--include-tests",
    ]);
    const dryRunOutput = dryRunStdout.chunks.join("");

    expect(extractEligibleFileCount(doctorOutput)).toBe(
      extractEligibleFileCount(dryRunOutput),
    );
    expect(doctorOutput).toMatch(/pass:.*eligible files: \d+/);
    expect(dryRunOutput).toContain("test files: included");
  });

  it("forwards --include-tests to runDoctor", async () => {
    const doctorModule = await import("#doctor");
    const runDoctorSpy = vi.spyOn(doctorModule, "runDoctor").mockResolvedValue({
      findings: [],
      exitCode: 0,
    });
    captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "doctor",
      smallTsFixture,
      "--include-tests",
    ]);

    expect(runDoctorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        includeTests: true,
      }),
    );
  });

  it("omits includeTests on runDoctor when --include-tests is not set", async () => {
    const doctorModule = await import("#doctor");
    const runDoctorSpy = vi.spyOn(doctorModule, "runDoctor").mockResolvedValue({
      findings: [],
      exitCode: 0,
    });
    captureStdout();

    await runCli(["node", "hotspot-scanner", "doctor", smallTsFixture]);

    const call = runDoctorSpy.mock.calls[0]?.[0];
    expect(call).toBeDefined();
    expect(call).not.toHaveProperty("includeTests");
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

  it("prints JSON doctor report with --format json", async () => {
    const doctorModule = await import("#doctor");
    vi.spyOn(doctorModule, "runDoctor").mockResolvedValue({
      findings: [
        {
          id: "node-engines",
          status: "pass",
          message: "Node v22.0.0 satisfies engines.node (>=22)",
        },
      ],
      exitCode: 0,
    });
    const { chunks } = captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "doctor",
      smallTsFixture,
      "--format",
      "json",
    ]);

    const parsed = JSON.parse(chunks.join("")) as {
      version: string;
      findings: unknown[];
      exitCode: number;
    };
    expect(parsed.version).toBe("1.0");
    expect(parsed.findings).toHaveLength(1);
    expect(parsed.exitCode).toBe(0);
  });

  it("prints JSON doctor report before non-zero exit", async () => {
    const doctorModule = await import("#doctor");
    vi.spyOn(doctorModule, "runDoctor").mockResolvedValue({
      findings: [
        {
          id: "git-repo",
          status: "fail",
          message: "not a git repository",
        },
      ],
      exitCode: 1,
    });
    const { chunks } = captureStdout();

    await expect(
      runCli([
        "node",
        "hotspot-scanner",
        "doctor",
        ".",
        "--format",
        "json",
      ]),
    ).rejects.toMatchObject({ exitCode: 1 });

    const parsed = JSON.parse(chunks.join("")) as {
      version: string;
      exitCode: number;
      findings: Array<{ id: string; status: string; message: string }>;
    };
    expect(parsed.version).toBe("1.0");
    expect(parsed.exitCode).toBe(1);
    expect(parsed.findings[0]?.id).toBe("git-repo");
  });

  it("throws CliUsageError for invalid doctor --format", async () => {
    const doctorModule = await import("#doctor");
    const runDoctorSpy = vi.spyOn(doctorModule, "runDoctor");
    captureStdout();

    await expect(
      runCli([
        "node",
        "hotspot-scanner",
        "doctor",
        smallTsFixture,
        "--format",
        "xml",
      ]),
    ).rejects.toThrow(CliUsageError);

    expect(runDoctorSpy).not.toHaveBeenCalled();
  });

  it("exits 1 when effective since is rejected by git", async () => {
    const probeModule = await import("../dist/git/probe-since.js");
    vi.spyOn(probeModule, "probeSinceWindow").mockResolvedValue({
      status: "invalid",
      message: "fatal: bad since format",
    });
    captureStdout();

    await expect(
      runCli(["node", "hotspot-scanner", "doctor", smallTsFixture]),
    ).rejects.toMatchObject({ exitCode: 1 });
  });

  it("exits 0 with warn when since window is empty", async () => {
    const probeModule = await import("../dist/git/probe-since.js");
    vi.spyOn(probeModule, "probeSinceWindow").mockResolvedValue({
      status: "empty",
    });
    const { chunks } = captureStdout();

    await runCli(["node", "hotspot-scanner", "doctor", smallTsFixture]);

    const output = chunks.join("");
    expect(output).toMatch(/warn:.*since/i);
    expect(output).toMatch(/No commits found for effective since/i);
  });
});

describe("runCli config", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("validate exits 0 for a valid config file", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    const configPath = join(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME);
    await writeFile(
      configPath,
      JSON.stringify({ since: "12 months ago", top: 20 }),
      "utf8",
    );
    const { chunks } = captureStdout();

    try {
      await runCli([
        "node",
        "hotspot-scanner",
        "config",
        "validate",
        configPath,
      ]);

      expect(chunks.join("")).toContain(`Config file is valid: ${configPath}`);
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("validate exits 2 for invalid JSON", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-config-validate-"));
    const configPath = join(tempDir, HOTSPOT_SCANNER_CONFIG_FILENAME);
    await writeFile(configPath, "{ not json", "utf8");
    captureStdout();

    try {
      await expect(
        runCli([
          "node",
          "hotspot-scanner",
          "config",
          "validate",
          configPath,
        ]),
      ).rejects.toThrow(/Invalid JSON/);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("validate exits 2 when no config is discoverable", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-config-validate-"));
    captureStdout();

    try {
      await expect(
        runCli(["node", "hotspot-scanner", "config", "validate", tempDir]),
      ).rejects.toThrow(/No .hotspot-scanner.json found/);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("print shows source tags in text format", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    const configPath = join(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME);
    await writeFile(
      configPath,
      JSON.stringify({ since: "6 months ago", top: 15 }),
      "utf8",
    );
    const { chunks } = captureStdout();

    try {
      await runCli(["node", "hotspot-scanner", "config", "print", repoPath]);

      const output = chunks.join("");
      expect(output).toContain(`config file: ${configPath}`);
      expect(output).toContain("since: 6 months ago (source: config)");
      expect(output).toContain("top: 15 (source: config)");
      expect(output).toContain("(source: default)");
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("print --format json emits ConfigPrintJson shape", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    const configPath = join(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME);
    await writeFile(
      configPath,
      JSON.stringify({ since: "6 months ago" }),
      "utf8",
    );
    const { chunks } = captureStdout();

    try {
      await runCli([
        "node",
        "hotspot-scanner",
        "config",
        "print",
        repoPath,
        "--format",
        "json",
      ]);

      const parsed = JSON.parse(chunks.join("")) as {
        configPath: string;
        values: { since: string };
        sources: { since: string };
      };
      expect(parsed.configPath).toBe(configPath);
      expect(parsed.values.since).toBe("6 months ago");
      expect(parsed.sources.since).toBe("config");
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("print marks CLI overrides with cli source", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    const configPath = join(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME);
    await writeFile(
      configPath,
      JSON.stringify({ since: "6 months ago" }),
      "utf8",
    );
    const { chunks } = captureStdout();

    try {
      await runCli([
        "node",
        "hotspot-scanner",
        "config",
        "print",
        repoPath,
        "--since",
        "3 months ago",
      ]);

      const output = chunks.join("");
      expect(output).toContain("since: 3 months ago (source: cli)");
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("rejects invalid config print --format", async () => {
    captureStdout();

    await expect(
      runCli([
        "node",
        "hotspot-scanner",
        "config",
        "print",
        smallTsFixture,
        "--format",
        "xml",
      ]),
    ).rejects.toThrow(CliUsageError);
  });
});

describe("runCli scan --dry-run", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("forwards --include-tests to previewScanScope on dry-run", async () => {
    const previewSpy = vi.spyOn(scan, "previewScanScope").mockResolvedValue({
      repoPath: smallTsFixture,
      since: "12 months ago",
      include: [],
      exclude: [],
      includeTests: true,
      eligibleFileCount: 1,
      concurrency: 1,
      configPath: null,
      unknownConfigKeys: [],
    });
    const { chunks } = captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      smallTsFixture,
      "--dry-run",
      "--include-tests",
    ]);

    expect(previewSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        includeTests: true,
      }),
    );
    expect(chunks.join("")).toContain("test files: included");
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
    expect(output).toContain("config file:");
    expect(output).toContain("since:");
    expect(output).toContain("eligible files:");
    expect(output).toMatch(/eligible files: [1-9]\d*/);
    expect(output).toContain("concurrency:");
    expect(runScanSpy).not.toHaveBeenCalled();
  });

  it("prints config path, remount, and unknown keys when applicable", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    const configPath = join(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME);
    await writeFile(
      configPath,
      JSON.stringify({ since: "12 months ago", typoKey: true }),
      "utf8",
    );
    const { chunks } = captureStdout();

    try {
      await runCli([
        "node",
        "hotspot-scanner",
        "scan",
        monorepoApiPackagePath,
        "--dry-run",
        "--config",
        configPath,
      ]);

      const output = chunks.join("");
      expect(output).toContain(`config file: ${configPath}`);
      expect(output).toMatch(/remounted to git root/i);
      expect(output).toContain("Unknown config key(s) ignored: typoKey");
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
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

describe("resolveCliExitCode", () => {
  it("maps BaselineError to exit 2", () => {
    expect(resolveCliExitCode(new BaselineError("invalid baseline"))).toBe(2);
  });

  it("maps CliUsageError to exit 2", () => {
    expect(resolveCliExitCode(new CliUsageError("bad flag"))).toBe(2);
  });

  it("maps CliExitError and ScanCancelExit to their exit codes", () => {
    expect(resolveCliExitCode(new CliExitError(1))).toBe(1);
    expect(resolveCliExitCode(new scanActions.ScanCancelExit(130))).toBe(130);
  });

  it("maps generic errors to exit 1", () => {
    expect(resolveCliExitCode(new Error("boom"))).toBe(1);
  });
});

describe("stderr feedback copy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits brief timing line after successful scan when timings present", async () => {
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(scan, "runScan").mockResolvedValue({
      ...mockScanResult(),
      meta: {
        ...mockScanResult().meta,
        timings: { gitMs: 100, complexityMs: 200, totalMs: 250 },
      },
    });
    captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      ".",
      "--format",
      "json",
    ]);

    const stderr = stderrSpy.mock.calls.map(([chunk]) => String(chunk)).join("");
    expect(stderr).toContain("timing: total 250ms");
  });

  it("suppresses brief timing line under --quiet", async () => {
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(scan, "runScan").mockResolvedValue({
      ...mockScanResult(),
      meta: {
        ...mockScanResult().meta,
        timings: { gitMs: 100, complexityMs: 200, totalMs: 250 },
      },
    });
    captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      ".",
      "--format",
      "json",
      "--quiet",
    ]);

    const stderr = stderrSpy.mock.calls.map(([chunk]) => String(chunk)).join("");
    expect(stderr).not.toContain("timing: total");
  });

  it("passes resolved since into createCliDiagnosticHandlers", async () => {
    const handlersSpy = vi
      .spyOn(diagnostics, "createCliDiagnosticHandlers")
      .mockReturnValue({
        onWarning: vi.fn(),
        onProgress: vi.fn(),
        emitWarningTeaser: vi.fn(),
        flushWarnings: vi.fn(),
        clearLiveProgress: vi.fn(),
      });
    vi.spyOn(scan, "runScan").mockResolvedValue(mockScanResult());
    captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      ".",
      "--since",
      "6 months ago",
      "--format",
      "json",
    ]);

    expect(handlersSpy).toHaveBeenCalledWith(
      expect.objectContaining({ since: "6 months ago" }),
    );
  });
});

describe("deferred flushWarnings lifecycle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("executeScan returns flushWarnings and emitWarningTeaser without invoking them", async () => {
    const flushWarnings = vi.fn();
    const emitWarningTeaser = vi.fn();
    vi.spyOn(diagnostics, "createCliDiagnosticHandlers").mockReturnValue({
      onWarning: vi.fn(),
      onProgress: vi.fn(),
      emitWarningTeaser,
      flushWarnings,
      clearLiveProgress: vi.fn(),
    });
    vi.spyOn(scan, "runScan").mockResolvedValue(mockScanResult());

    const { result, flushWarnings: returnedFlush, emitWarningTeaser: returnedTeaser } =
      await scanActions.executeScan({
        repoPath: ".",
        cliOverrides: {},
      });

    expect(result.version).toBe("3.0");
    expect(returnedFlush).toBe(flushWarnings);
    expect(returnedTeaser).toBe(emitWarningTeaser);
    expect(flushWarnings).not.toHaveBeenCalled();
    expect(emitWarningTeaser).not.toHaveBeenCalled();
  });

  it("executeCompareAndRender teasers before write then flushes", async () => {
    const callOrder: string[] = [];
    const emitWarningTeaser = vi.fn(() => callOrder.push("teaser"));
    const flushWarnings = vi.fn(() => callOrder.push("flush"));
    vi.spyOn(diagnostics, "createCliDiagnosticHandlers").mockReturnValue({
      onWarning: vi.fn(),
      onProgress: vi.fn(),
      emitWarningTeaser,
      flushWarnings,
      clearLiveProgress: vi.fn(),
    });
    vi.spyOn(scan, "runScan").mockResolvedValue(mockScanResult());
    vi.spyOn(process.stdout, "write").mockImplementation(() => {
      callOrder.push("write");
      return true;
    });

    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-defer-flush-"));
    const baselinePath = join(tempDir, "baseline.json");
    await writeFile(baselinePath, JSON.stringify(mockScanResult()), "utf8");

    try {
      await scanActions.executeCompareAndRender({
        repoPath: ".",
        baselinePath,
        cliOverrides: {},
        reporterOptions: {
          format: "json",
          top: 10,
          triageHints: false,
          color: false,
        },
      });

      expect(callOrder).toEqual(["teaser", "write", "flush"]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("baseline save teasers before write then flushes", async () => {
    const callOrder: string[] = [];
    const emitWarningTeaser = vi.fn(() => callOrder.push("teaser"));
    const flushWarnings = vi.fn(() => callOrder.push("flush"));
    vi.spyOn(diagnostics, "createCliDiagnosticHandlers").mockReturnValue({
      onWarning: vi.fn(),
      onProgress: vi.fn(),
      emitWarningTeaser,
      flushWarnings,
      clearLiveProgress: vi.fn(),
    });
    vi.spyOn(scan, "runScan").mockResolvedValue(mockScanResult());
    const writeBaselineSpy = vi
      .spyOn(scanActions, "writeBaselineJson")
      .mockImplementation(async () => {
        callOrder.push("write");
      });
    captureStdout();

    try {
      await runCli(["node", "hotspot-scanner", "baseline", "save", "."]);

      expect(writeBaselineSpy).toHaveBeenCalled();
      expect(callOrder).toEqual(["teaser", "write", "flush"]);
    } finally {
      writeBaselineSpy.mockRestore();
    }
  });

  it("scan teasers before write then flushes", async () => {
    const callOrder: string[] = [];
    const emitWarningTeaser = vi.fn(() => callOrder.push("teaser"));
    const flushWarnings = vi.fn(() => callOrder.push("flush"));
    vi.spyOn(diagnostics, "createCliDiagnosticHandlers").mockReturnValue({
      onWarning: vi.fn(),
      onProgress: vi.fn(),
      emitWarningTeaser,
      flushWarnings,
      clearLiveProgress: vi.fn(),
    });
    vi.spyOn(scan, "runScan").mockResolvedValue(mockScanResult());
    const writeRenderedSpy = vi
      .spyOn(scanActions, "writeRenderedOutput")
      .mockImplementation(async () => {
        callOrder.push("write");
      });
    captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      ".",
      "--format",
      "json",
    ]);

    expect(writeRenderedSpy).toHaveBeenCalled();
    expect(callOrder).toEqual(["teaser", "write", "flush"]);
    writeRenderedSpy.mockRestore();
  });

  it("emits brief timing after flushWarnings on scan", async () => {
    const stderrOrder: string[] = [];
    const flushWarnings = vi.fn(() => {
      stderrOrder.push("flush");
    });
    vi.spyOn(diagnostics, "createCliDiagnosticHandlers").mockReturnValue({
      onWarning: vi.fn(),
      onProgress: vi.fn(),
      emitWarningTeaser: vi.fn(),
      flushWarnings,
      clearLiveProgress: vi.fn(),
    });
    vi.spyOn(scan, "runScan").mockResolvedValue({
      ...mockScanResult(),
      meta: {
        ...mockScanResult().meta,
        timings: { gitMs: 100, complexityMs: 200, totalMs: 250 },
      },
    });
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      const text = String(chunk);
      if (text.includes("timing: total")) {
        stderrOrder.push("timing");
      }
      return true;
    });
    captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      ".",
      "--format",
      "json",
    ]);

    expect(stderrOrder).toEqual(["flush", "timing"]);
  });

  it("explain runs after flushWarnings on scan", async () => {
    const stderrOrder: string[] = [];
    const flushWarnings = vi.fn(() => {
      stderrOrder.push("flush");
    });
    vi.spyOn(diagnostics, "createCliDiagnosticHandlers").mockReturnValue({
      onWarning: vi.fn(),
      onProgress: vi.fn(),
      emitWarningTeaser: vi.fn(),
      flushWarnings,
      clearLiveProgress: vi.fn(),
    });
    vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "3.0",
      hotspots: [
        {
          filePath: "src/example.ts",
          hotspotScore: 0.88,
          complexityNormalized: 0.9,
          churnNormalized: 0.85,
          ncloc: 42,
          commitCount: 15,
          linesChanged: 320,
          authorCount: 3,
        },
      ],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        warnings: [],
      },
    });
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      const text = String(chunk);
      if (text.includes("=== Explain:")) {
        stderrOrder.push("explain");
      }
      return true;
    });
    captureStdout();

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

    expect(stderrOrder).toContain("flush");
    expect(stderrOrder).toContain("explain");
    expect(stderrOrder.indexOf("flush")).toBeLessThan(
      stderrOrder.indexOf("explain"),
    );
  });
});
