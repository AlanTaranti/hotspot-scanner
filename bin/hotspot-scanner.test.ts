import { afterEach, describe, expect, it, vi } from "vitest";
import * as diagnostics from "#diagnostics";
import * as report from "#report";
import * as scan from "#scan";
import {
  CliUsageError,
  createCliProgram,
  parseFormat,
  parsePositiveInteger,
  runCli,
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
  it("parseFormat accepts table and json", () => {
    expect(parseFormat("table")).toBe("table");
    expect(parseFormat("json")).toBe("json");
  });

  it("parseFormat rejects invalid values", () => {
    expect(() => parseFormat("xml")).toThrow(CliUsageError);
    expect(() => parseFormat("xml")).toThrow(/Invalid --format/);
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
        "--top",
        "--min-cochange",
      ]),
    );
  });
});

describe("runCli", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints table on successful scan", async () => {
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
});
