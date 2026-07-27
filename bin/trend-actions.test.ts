import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { executeTrend, mapTrendError, parseTrendFormat } from "./trend-actions.js";
import { CliUsageError, ScanCancelExit } from "./scan-actions.js";
import { TrendNotTrackedError, TrendUsageError } from "#trend";

const trendIndentFixture = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../tests/fixtures/repos/trend-indent",
);

describe("parseTrendFormat", () => {
  it("accepts supported formats", () => {
    expect(parseTrendFormat("table")).toBe("table");
    expect(parseTrendFormat("json")).toBe("json");
    expect(parseTrendFormat("csv")).toBe("csv");
  });

  it("rejects invalid format", () => {
    expect(() => parseTrendFormat("markdown")).toThrow(CliUsageError);
  });
});

describe("mapTrendError", () => {
  it("maps trend usage errors to CliUsageError", () => {
    expect(() => mapTrendError(new TrendUsageError("bad"))).toThrow(CliUsageError);
  });

  it("maps not-tracked errors to CliUsageError", () => {
    expect(() =>
      mapTrendError(new TrendNotTrackedError("src/missing.ts")),
    ).toThrow(CliUsageError);
  });

  it("rethrows scan cancel exits after stderr note", () => {
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    expect(() => mapTrendError(new ScanCancelExit(130))).toThrow(ScanCancelExit);
    expect(stderr.mock.calls.join("")).toContain("trend cancelled");
    stderr.mockRestore();
  });
});

describe("executeTrend", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes truncation note and table output", async () => {
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const stdout = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    await executeTrend({
      filePath: join(trendIndentFixture, "src/trend.ts"),
      since: "10 years ago",
      maxRevisions: 2,
      format: "table",
    });

    expect(stderr.mock.calls.flat().join("")).toContain("uniform sample");
    expect(stdout.mock.calls.flat().join("")).toContain("Complexity trend");
  });

  it("writes empty-window warning to stderr", async () => {
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const stdout = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    await executeTrend({
      filePath: join(trendIndentFixture, "src/trend.ts"),
      since: "2099-01-01",
      format: "json",
    });

    expect(stderr.mock.calls.flat().join("")).toContain("warning:");
    expect(stdout.mock.calls.flat().join("")).toContain("complexity-trend");
  });
});
