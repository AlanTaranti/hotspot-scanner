import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ScanResult } from "../types/index.js";
import { CompareError, compareScanResults } from "./compare.js";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures/report",
);

function loadFixture(name: string): ScanResult {
  return JSON.parse(
    readFileSync(join(fixturesDir, name), "utf8"),
  ) as ScanResult;
}

describe("compareScanResults", () => {
  it("returns version 2.0 without a coupling section", () => {
    const baseline = loadFixture("compare-baseline-file.json");
    const current = loadFixture("compare-current-file.json");
    const result = compareScanResults(baseline, current);

    expect(result.version).toBe("2.0");
    expect(result).not.toHaveProperty("coupling");
  });

  it("classifies file mode hotspots: new, removed, rankChanged", () => {
    const baseline = loadFixture("compare-baseline-file.json");
    const current = loadFixture("compare-current-file.json");
    const result = compareScanResults(baseline, current);

    expect(result.granularity).toBe("file");
    expect(result.hotspots.new.map((item) => item.filePath)).toEqual([
      "src/new.ts",
    ]);
    expect(result.hotspots.removed.map((item) => item.filePath)).toEqual([
      "src/medium.ts",
    ]);
    expect(result.hotspots.rankChanged).toHaveLength(1);
    expect(result.hotspots.rankChanged[0]?.entity.filePath).toBe("src/hot.ts");
    expect(result.hotspots.rankChanged[0]?.baselineRank).toBe(1);
    expect(result.hotspots.rankChanged[0]?.currentRank).toBe(2);
    expect(result.hotspots.rankChanged[0]?.rankDelta).toBe(1);
    expect(result.functions).toEqual({
      new: [],
      removed: [],
      rankChanged: [],
    });
  });

  it("classifies function mode deltas", () => {
    const baseline = loadFixture("compare-baseline-function.json");
    const current = loadFixture("compare-current-function.json");
    const result = compareScanResults(baseline, current);

    expect(result.granularity).toBe("function");
    expect(result.hotspots).toEqual({
      new: [],
      removed: [],
      rankChanged: [],
    });
    expect(result.functions.new).toHaveLength(1);
    expect(result.functions.new[0]?.functionName).toBe("newHandler");
    expect(result.functions.removed).toHaveLength(1);
    expect(result.functions.removed[0]?.functionName).toBe("handle");
    expect(result.functions.rankChanged).toHaveLength(1);
    expect(result.functions.rankChanged[0]?.entity.functionName).toBe(
      "processOrder",
    );
  });

  it("throws on granularity mismatch", () => {
    const baseline = loadFixture("compare-baseline-file.json");
    const current = loadFixture("compare-current-function.json");

    expect(() => compareScanResults(baseline, current)).toThrow(CompareError);
    expect(() => compareScanResults(baseline, current)).toThrow(
      /Granularity mismatch/,
    );
  });

  it("adds warning on since mismatch without throwing", () => {
    const baseline = loadFixture("compare-baseline-file.json");
    const current = loadFixture("compare-current-file.json");
    const currentDifferentSince: ScanResult = {
      ...current,
      meta: { ...current.meta, since: "12 months ago" },
    };

    const result = compareScanResults(baseline, currentDifferentSince);
    expect(result.meta.warnings).toHaveLength(1);
    expect(result.meta.warnings[0]).toEqual({
      severity: "warning",
      code: "COMPARE_SINCE_MISMATCH",
      message: expect.stringMatching(/different --since windows/),
    });
  });

  it("treats empty baseline as all new entities", () => {
    const baseline = loadFixture("compare-baseline-file.json");
    const current = loadFixture("compare-current-file.json");
    const emptyBaseline: ScanResult = {
      ...baseline,
      hotspots: [],
    };

    const result = compareScanResults(emptyBaseline, current);
    expect(result.hotspots.new).toHaveLength(current.hotspots.length);
    expect(result.hotspots.removed).toHaveLength(0);
  });

  it("sorts rankChanged ties by entity key when rank delta magnitude matches", () => {
    const hotspot = (
      filePath: string,
      hotspotScore: number,
    ): ScanResult["hotspots"][number] => ({
      filePath,
      complexityNormalized: 0.5,
      churnNormalized: 0.5,
      hotspotScore,
      cyclomaticComplexity: 10,
      functionCount: 1,
      commitCount: 5,
      linesChanged: 50,
      authorCount: 1,
      parseFailed: false,
    });

    const baseline: ScanResult = {
      version: "2.0",
      hotspots: [hotspot("src/z.ts", 0.9), hotspot("src/a.ts", 0.8)],
      functions: [],
      meta: {
        since: "6 months ago",
        scannedAt: "2026-01-01T00:00:00.000Z",
        granularity: "file",
        warnings: [],
      },
    };
    const current: ScanResult = {
      ...baseline,
      hotspots: [hotspot("src/a.ts", 0.9), hotspot("src/z.ts", 0.8)],
      meta: { ...baseline.meta, scannedAt: "2026-02-01T00:00:00.000Z" },
    };

    const result = compareScanResults(baseline, current);

    expect(result.hotspots.rankChanged).toHaveLength(2);
    expect(result.hotspots.rankChanged.map((c) => c.entity.filePath)).toEqual([
      "src/a.ts",
      "src/z.ts",
    ]);
  });
});
