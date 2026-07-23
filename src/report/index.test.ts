import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compareScanResults } from "../compare/compare.js";
import type { CompareResult, ScanResult } from "../types/index.js";
import { createReporter } from "./index.js";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures/report/sample-result.json",
);
const functionFixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures/report/sample-result-functions.json",
);
const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures/report",
);

function loadFixture(): ScanResult {
  return JSON.parse(readFileSync(fixturePath, "utf8")) as ScanResult;
}

function loadFunctionFixture(): ScanResult {
  return JSON.parse(readFileSync(functionFixturePath, "utf8")) as ScanResult;
}

function loadCompareResult(): CompareResult {
  const baseline = JSON.parse(
    readFileSync(join(fixturesDir, "compare-baseline-file.json"), "utf8"),
  ) as ScanResult;
  const current = JSON.parse(
    readFileSync(join(fixturesDir, "compare-current-file.json"), "utf8"),
  ) as ScanResult;
  return compareScanResults(baseline, current);
}

function loadFunctionCompareResult(): CompareResult {
  const baseline = JSON.parse(
    readFileSync(join(fixturesDir, "compare-baseline-function.json"), "utf8"),
  ) as ScanResult;
  const current = JSON.parse(
    readFileSync(join(fixturesDir, "compare-current-function.json"), "utf8"),
  ) as ScanResult;
  return compareScanResults(baseline, current);
}

describe("createReporter", () => {
  it("renders JSON output", () => {
    const output = createReporter().render(loadFixture(), {
      format: "json",
      top: 2,
    });
    const parsed = JSON.parse(output) as ScanResult;

    expect(parsed.hotspots).toHaveLength(2);
    expect(parsed.coupling).toHaveLength(2);
  });

  it("renders table output", () => {
    const output = createReporter().render(loadFixture(), {
      format: "table",
      top: 2,
    });

    expect(output).toContain("Top Hotspots");
    expect(output).toContain("Top Coupling Pairs");
    expect(output).toContain("Scan window: 6 months ago");
  });

  it("renders markdown output", () => {
    const output = createReporter().render(loadFixture(), {
      format: "markdown",
      top: 2,
    });

    expect(output).toContain("# Hotspot Scanner Report");
    expect(output).toContain("## Top Hotspots");
    expect(output).toContain("## Top Coupling Pairs");
    expect(output).toContain("**Scan window:** 6 months ago");
  });

  it("renders function mode table output", () => {
    const output = createReporter().render(loadFunctionFixture(), {
      format: "table",
      top: 2,
    });

    expect(output).toContain("Top Functions");
    expect(output).toContain("processOrder");
    expect(output).not.toContain("Top Hotspots");
  });

  it("renders function mode markdown output", () => {
    const output = createReporter().render(loadFunctionFixture(), {
      format: "markdown",
      top: 2,
    });

    expect(output).toContain("## Top Functions");
    expect(output).toContain("**Granularity:** function");
    expect(output).toContain("processOrder");
  });

  it("renders function mode markdown output", () => {
    const output = createReporter().renderCompare(loadFunctionCompareResult(), {
      format: "markdown",
      top: 2,
    });

    expect(output).toContain("## New Functions");
    expect(output).toContain("## Rank Changed Functions");
  });

  it("renders compare JSON output", () => {
    const output = createReporter().renderCompare(loadCompareResult(), {
      format: "json",
      top: 2,
    });
    const parsed = JSON.parse(output);

    expect(parsed.version).toBe("1.0");
    expect(parsed.hotspots.new).toHaveLength(1);
  });

  it("renders compare table output", () => {
    const output = createReporter().renderCompare(loadCompareResult(), {
      format: "table",
      top: 2,
    });

    expect(output).toContain("Scan Compare Report");
    expect(output).toContain("=== New Hotspots ===");
  });

  it("does not throw", () => {
    expect(() =>
      createReporter().render(
        {
          version: "1.0",
          hotspots: [],
          functions: [],
          coupling: [],
          meta: {
            since: "12 months ago",
            scannedAt: "2026-07-22T12:00:00.000Z",
            granularity: "file",
          },
        },
        { format: "table" },
      ),
    ).not.toThrow();
  });
});
