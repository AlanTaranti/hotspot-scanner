import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  executeAssess,
  mapAssessError,
  parseAssessFormat,
  parseMinHotspotScore,
} from "./assess-actions.js";
import { CliUsageError, ScanCancelExit } from "./scan-actions.js";

const { runAssessMock } = vi.hoisted(() => ({
  runAssessMock: vi.fn(),
}));

vi.mock("#assess", () => ({
  runAssess: runAssessMock,
}));

const assessFixturePath = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../tests/fixtures/report/sample-assess-result.json",
);

function loadAssessFixture() {
  return JSON.parse(readFileSync(assessFixturePath, "utf8"));
}

describe("parseAssessFormat", () => {
  it("accepts supported formats", () => {
    expect(parseAssessFormat("table")).toBe("table");
    expect(parseAssessFormat("json")).toBe("json");
    expect(parseAssessFormat("markdown")).toBe("markdown");
  });

  it("rejects invalid format", () => {
    expect(() => parseAssessFormat("csv")).toThrow(CliUsageError);
  });
});

describe("parseMinHotspotScore", () => {
  it("accepts hotspotScore values in [0, 1]", () => {
    expect(parseMinHotspotScore("0")).toBe(0);
    expect(parseMinHotspotScore("0.7")).toBe(0.7);
    expect(parseMinHotspotScore("1")).toBe(1);
  });

  it("rejects values outside hotspotScore range", () => {
    expect(() => parseMinHotspotScore("-0.1")).toThrow(CliUsageError);
    expect(() => parseMinHotspotScore("1.1")).toThrow(CliUsageError);
    expect(() => parseMinHotspotScore("abc")).toThrow(CliUsageError);
  });
});

describe("mapAssessError", () => {
  it("rethrows scan cancel exits after stderr note", () => {
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    expect(() => mapAssessError(new ScanCancelExit(143))).toThrow(
      ScanCancelExit,
    );
    expect(stderr.mock.calls.join("")).toContain("assess cancelled");
    stderr.mockRestore();
  });

  it("rethrows non-cancel errors unchanged", () => {
    expect(() => mapAssessError(new Error("boom"))).toThrow("boom");
  });
});

describe("executeAssess", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes table output", async () => {
    runAssessMock.mockResolvedValue(loadAssessFixture());
    const stdout = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    await executeAssess({
      repoPath: "tests/fixtures/repos/small-ts",
      cliOverrides: {},
      minHotspotScore: 1,
      top: 1,
      format: "table",
      noProgress: true,
      quiet: true,
    });

    expect(stdout.mock.calls.flat().join("")).toContain("Hotspot assess");
  });

  it("writes markdown and json output", async () => {
    runAssessMock.mockResolvedValue(loadAssessFixture());
    const stdout = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    await executeAssess({
      repoPath: "tests/fixtures/repos/small-ts",
      cliOverrides: {},
      minHotspotScore: 0.7,
      top: 1,
      format: "markdown",
      noProgress: true,
      quiet: true,
    });
    expect(stdout.mock.calls.flat().join("")).toContain("Hotspot assess");

    stdout.mockClear();
    await executeAssess({
      repoPath: "tests/fixtures/repos/small-ts",
      cliOverrides: {},
      minHotspotScore: 0.7,
      top: 1,
      format: "json",
      noProgress: true,
      quiet: true,
    });
    expect(stdout.mock.calls.flat().join("")).toContain("hotspot-assess");
  });

  it("writes output file and confirm line", async () => {
    runAssessMock.mockResolvedValue(loadAssessFixture());
    const outputPath = join(tmpdir(), `assess-out-${Date.now()}.json`);
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    await executeAssess({
      repoPath: "tests/fixtures/repos/small-ts",
      cliOverrides: {},
      minHotspotScore: 0.7,
      top: 1,
      format: "json",
      outputPath,
      noProgress: true,
    });

    const content = readFileSync(outputPath, "utf8");
    expect(content).toContain("hotspot-assess");
    expect(stderr.mock.calls.flat().join("")).toContain(`Wrote ${outputPath}`);
    await rm(outputPath, { force: true });
  });

  it("emits assess progress on stderr when enabled", async () => {
    runAssessMock.mockImplementation(async (options) => {
      options.onAssessProgress?.({
        index: 1,
        total: 2,
        filePath: "src/a.ts",
      });
      return loadAssessFixture();
    });
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await executeAssess({
      repoPath: "tests/fixtures/repos/small-ts",
      cliOverrides: {},
      minHotspotScore: 0.7,
      top: 1,
      format: "table",
    });

    expect(stderr.mock.calls.flat().join("")).toContain(
      "assess: [1/2] src/a.ts",
    );
  });
});
