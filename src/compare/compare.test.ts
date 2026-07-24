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

  it("classifies coupling pairs with canonical keys", () => {
    const baseline = loadFixture("compare-baseline-file.json");
    const current = loadFixture("compare-current-file.json");
    const result = compareScanResults(baseline, current);

    expect(result.coupling.new).toHaveLength(1);
    expect(result.coupling.new[0]?.fileA).toBe("src/e.ts");
    expect(result.coupling.removed).toHaveLength(0);
    expect(result.coupling.rankChanged).toHaveLength(2);
  });

  it("treats swapped coupling pair order as same canonical key", () => {
    const baseline = loadFixture("compare-baseline-file.json");
    const current = loadFixture("compare-current-file.json");
    const swappedCurrent: ScanResult = {
      ...current,
      coupling: current.coupling.map((pair) => ({
        ...pair,
        fileA: pair.fileB,
        fileB: pair.fileA,
      })),
    };

    const result = compareScanResults(baseline, swappedCurrent);
    expect(result.coupling.new).toHaveLength(1);
    expect(result.coupling.removed).toHaveLength(0);
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
      coupling: [],
    };

    const result = compareScanResults(emptyBaseline, current);
    expect(result.hotspots.new).toHaveLength(current.hotspots.length);
    expect(result.hotspots.removed).toHaveLength(0);
    expect(result.coupling.new).toHaveLength(current.coupling.length);
  });

  it("sorts rankChanged by absolute delta then key tie-breaker", () => {
    const baseline = loadFixture("compare-baseline-file.json");
    const current = loadFixture("compare-current-file.json");
    const baselineCouplingOnly: ScanResult = {
      ...baseline,
      hotspots: baseline.hotspots.map((hotspot) => ({ ...hotspot })),
      coupling: [
        {
          fileA: "src/z.ts",
          fileB: "src/y.ts",
          coChangeCount: 2,
          couplingStrength: 0.4,
        },
        {
          fileA: "src/a.ts",
          fileB: "src/b.ts",
          coChangeCount: 5,
          couplingStrength: 0.75,
        },
      ],
    };
    const currentCouplingOnly: ScanResult = {
      ...current,
      hotspots: baseline.hotspots.map((hotspot) => ({ ...hotspot })),
      coupling: [
        {
          fileA: "src/a.ts",
          fileB: "src/b.ts",
          coChangeCount: 5,
          couplingStrength: 0.75,
        },
        {
          fileA: "src/z.ts",
          fileB: "src/y.ts",
          coChangeCount: 2,
          couplingStrength: 0.4,
        },
      ],
    };

    const result = compareScanResults(
      baselineCouplingOnly,
      currentCouplingOnly,
    );
    expect(result.coupling.rankChanged).toHaveLength(2);
    expect(Math.abs(result.coupling.rankChanged[0]!.rankDelta)).toBe(
      Math.abs(result.coupling.rankChanged[1]!.rankDelta),
    );
    expect(result.coupling.rankChanged[0]!.entity.fileA).toBe("src/a.ts");
  });
});
