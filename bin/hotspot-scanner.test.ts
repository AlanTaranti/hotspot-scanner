import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as diagnostics from "#diagnostics";
import * as report from "#report";
import * as scan from "#scan";
import {
  CliUsageError,
  collectGlob,
  createCliProgram,
  parseFormat,
  parsePositiveInteger,
  runCli,
  validateOutputPath,
  validateScopePatterns,
} from "./hotspot-scanner.js";

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
  it("parseFormat accepts table, json, and markdown", () => {
    expect(parseFormat("table")).toBe("table");
    expect(parseFormat("json")).toBe("json");
    expect(parseFormat("markdown")).toBe("markdown");
  });

  it("parseFormat rejects invalid values", () => {
    expect(() => parseFormat("xml")).toThrow(CliUsageError);
    expect(() => parseFormat("xml")).toThrow(/Invalid --format/);
    expect(() => parseFormat("xml")).toThrow(/table, json, or markdown/);
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
    expect(() => validateScopePatterns([""], "--include")).toThrow(CliUsageError);
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
      coupling: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
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
    ]);

    const output = chunks.join("");
    expect(output).toContain("Scan window:");
    expect(output).toContain("Top Hotspots");
    expect(output).toContain("Top Coupling Pairs");
  });

  it("prints JSON on successful scan", async () => {
    vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "1.0",
      hotspots: [],
      coupling: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
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
    ]);

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
        coupling: [],
        meta: {
          since: "12 months ago",
          scannedAt: "2026-01-01T00:00:00.000Z",
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
    ]);

    expect(progressSpy).toHaveBeenCalledWith(1000);
  });

  it("appends newline when reporter output omits trailing newline", async () => {
    vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "1.0",
      hotspots: [],
      coupling: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    vi.spyOn(report, "createReporter").mockReturnValue({
      render: () => "table-without-newline",
    });
    const { chunks } = captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      ".",
      "--format",
      "table",
    ]);

    expect(chunks.join("")).toBe("table-without-newline\n");
  });

  it("writes report to file when --output is set", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-test-"));
    const outputPath = join(tempDir, "report.json");
    vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "1.0",
      hotspots: [],
      coupling: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
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
      coupling: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
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
    const warningSpy = vi.spyOn(diagnostics, "logWarning").mockImplementation(() => {});
    vi.spyOn(scan, "runScan").mockImplementation(async (options) => {
      options.onWarning?.("test warning");
      return {
        version: "1.0",
        hotspots: [],
        coupling: [],
        meta: {
          since: "12 months ago",
          scannedAt: "2026-01-01T00:00:00.000Z",
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
      runCli([
        "node",
        "hotspot-scanner",
        "scan",
        ".",
        "--format",
        "xml",
      ]),
    ).rejects.toThrow(CliUsageError);
  });

  it("throws CliUsageError for non-positive --top", async () => {
    await expect(
      runCli(["node", "hotspot-scanner", "scan", ".", "--top", "0"]),
    ).rejects.toThrow(CliUsageError);
  });

  it("throws CliUsageError for non-positive --min-cochange", async () => {
    await expect(
      runCli([
        "node",
        "hotspot-scanner",
        "scan",
        ".",
        "--min-cochange",
        "-1",
      ]),
    ).rejects.toThrow(CliUsageError);
  });

  it("forwards include and exclude patterns to runScan", async () => {
    const runScanSpy = vi.spyOn(scan, "runScan").mockResolvedValue({
      version: "1.0",
      hotspots: [],
      coupling: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
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

  it("throws CliUsageError for empty --include", async () => {
    await expect(
      runCli([
        "node",
        "hotspot-scanner",
        "scan",
        ".",
        "--include",
        "",
      ]),
    ).rejects.toThrow(CliUsageError);
  });
});
