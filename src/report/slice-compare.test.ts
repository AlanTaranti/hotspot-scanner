import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compareScanResults } from "../compare/compare.js";
import type { CompareResult, ScanResult } from "../types/index.js";
import { sliceCompareResult } from "./slice-compare.js";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures/report",
);

function loadScanFixture(name: string): ScanResult {
  return JSON.parse(
    readFileSync(join(fixturesDir, name), "utf8"),
  ) as ScanResult;
}

function loadCompareFixture(): CompareResult {
  const baseline = loadScanFixture("compare-baseline-file.json");
  const current = loadScanFixture("compare-current-file.json");
  return compareScanResults(baseline, current);
}

describe("sliceCompareResult", () => {
  it("slices all delta arrays when top is provided", () => {
    const result = loadCompareFixture();
    const sliced = sliceCompareResult(result, 1);

    expect(sliced.hotspots.new.length).toBeLessThanOrEqual(1);
    expect(sliced.hotspots.removed.length).toBeLessThanOrEqual(1);
    expect(sliced.hotspots.rankChanged.length).toBeLessThanOrEqual(1);
    expect(sliced.coupling.new.length).toBeLessThanOrEqual(1);
  });

  it("returns full arrays when top is undefined", () => {
    const result = loadCompareFixture();
    const sliced = sliceCompareResult(result);

    expect(sliced.hotspots.new).toEqual(result.hotspots.new);
    expect(sliced.coupling.rankChanged).toEqual(result.coupling.rankChanged);
  });
});
