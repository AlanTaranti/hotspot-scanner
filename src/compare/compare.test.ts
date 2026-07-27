import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getPackageVersion } from "../package-meta.js";
import type { ScanResult } from "../types/index.js";
import { compareScanResults } from "./compare.js";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures/report",
);

function loadFixture(name: string): ScanResult {
  return JSON.parse(
    readFileSync(join(fixturesDir, name), "utf8"),
  ) as ScanResult;
}

function hotspot(
  filePath: string,
  hotspotScore: number,
  overrides: Partial<ScanResult["hotspots"][number]> = {},
): ScanResult["hotspots"][number] {
  return {
    filePath,
    complexityNormalized: 0.5,
    churnNormalized: 0.5,
    hotspotScore,
    ncloc: 10,
    commitCount: 5,
    linesChanged: 50,
    authorCount: 1,
    ...overrides,
  };
}

function scanResult(
  hotspots: ScanResult["hotspots"],
  metaOverrides: Partial<ScanResult["meta"]> = {},
): ScanResult {
  return {
    version: "3.0",
    hotspots,
    meta: {
      since: "6 months ago",
      scannedAt: "2026-01-01T00:00:00.000Z",
      warnings: [],
      ...metaOverrides,
    },
  };
}

describe("compareScanResults", () => {
  it("returns version 3.0 without functions or granularity", () => {
    const baseline = loadFixture("compare-baseline-file.json");
    const current = loadFixture("compare-current-file.json");
    const result = compareScanResults(baseline, current);

    expect(result.version).toBe("3.0");
    expect(result).not.toHaveProperty("coupling");
    expect(result).not.toHaveProperty("functions");
    expect(result).not.toHaveProperty("granularity");
  });

  it("classifies hotspots: new, removed, rankChanged", () => {
    const baseline = loadFixture("compare-baseline-file.json");
    const current = loadFixture("compare-current-file.json");
    const result = compareScanResults(baseline, current);

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
    expect(result.hotspots.rankChanged[0]?.scoreDelta).toBe(0);
    expect(result.hotspots.rankChanged[0]?.nclocDelta).toBe(0);
    expect(result.hotspots.rankChanged[0]?.commitCountDelta).toBe(0);
  });

  it("sets meta.scannerVersion from package.json", () => {
    const baseline = loadFixture("compare-baseline-file.json");
    const current = loadFixture("compare-current-file.json");
    const result = compareScanResults(baseline, current);

    expect(result.meta.scannerVersion).toBe(getPackageVersion());
    expect(result.meta.scannerVersion).toBe("1.0.0");
  });

  it("computes exact metric deltas as current minus baseline", () => {
    const baseline = scanResult([
      hotspot("src/a.ts", 0.8, { ncloc: 100, commitCount: 20 }),
      hotspot("src/b.ts", 0.5, { ncloc: 50, commitCount: 10 }),
    ]);
    const current = scanResult([
      hotspot("src/b.ts", 0.9, { ncloc: 80, commitCount: 15 }),
      hotspot("src/a.ts", 0.7, { ncloc: 120, commitCount: 25 }),
    ], { scannedAt: "2026-02-01T00:00:00.000Z" });

    const result = compareScanResults(baseline, current);
    const changedA = result.hotspots.rankChanged.find(
      (item) => item.entity.filePath === "src/a.ts",
    );
    const changedB = result.hotspots.rankChanged.find(
      (item) => item.entity.filePath === "src/b.ts",
    );

    expect(changedA).toMatchObject({
      entity: baseline.hotspots[0],
      baselineRank: 1,
      currentRank: 2,
      rankDelta: 1,
      nclocDelta: 20,
      commitCountDelta: 5,
    });
    expect(changedA?.scoreDelta).toBeCloseTo(-0.1);
    expect(changedB).toMatchObject({
      entity: baseline.hotspots[1],
      baselineRank: 2,
      currentRank: 1,
      rankDelta: -1,
      nclocDelta: 30,
      commitCountDelta: 5,
    });
    expect(changedB?.scoreDelta).toBeCloseTo(0.4);
  });

  it("computes negative metric deltas when current metrics decrease", () => {
    const baseline = scanResult([
      hotspot("src/a.ts", 0.9, { ncloc: 200, commitCount: 30 }),
      hotspot("src/b.ts", 0.4, { ncloc: 40, commitCount: 8 }),
    ]);
    const current = scanResult([
      hotspot("src/b.ts", 0.5, { ncloc: 35, commitCount: 6 }),
      hotspot("src/a.ts", 0.6, { ncloc: 150, commitCount: 20 }),
    ], { scannedAt: "2026-02-01T00:00:00.000Z" });

    const result = compareScanResults(baseline, current);
    const changedA = result.hotspots.rankChanged.find(
      (item) => item.entity.filePath === "src/a.ts",
    );

    expect(changedA?.scoreDelta).toBeCloseTo(-0.3);
    expect(changedA?.nclocDelta).toBe(-50);
    expect(changedA?.commitCountDelta).toBe(-10);
  });

  it("omits unchanged-rank hotspots from rankChanged", () => {
    const baseline = scanResult([
      hotspot("src/a.ts", 0.9, { ncloc: 100, commitCount: 10 }),
      hotspot("src/b.ts", 0.5, { ncloc: 50, commitCount: 5 }),
    ]);
    const current = scanResult([
      hotspot("src/a.ts", 0.95, { ncloc: 110, commitCount: 12 }),
      hotspot("src/b.ts", 0.45, { ncloc: 45, commitCount: 4 }),
    ], { scannedAt: "2026-02-01T00:00:00.000Z" });

    const result = compareScanResults(baseline, current);

    expect(result.hotspots.rankChanged).toHaveLength(0);
    expect(result.hotspots.new).toHaveLength(0);
    expect(result.hotspots.removed).toHaveLength(0);
  });

  it("does not add delta fields to new or removed hotspots", () => {
    const baseline = loadFixture("compare-baseline-file.json");
    const current = loadFixture("compare-current-file.json");
    const result = compareScanResults(baseline, current);

    for (const item of result.hotspots.new) {
      expect(item).not.toHaveProperty("scoreDelta");
      expect(item).not.toHaveProperty("nclocDelta");
      expect(item).not.toHaveProperty("commitCountDelta");
    }
    for (const item of result.hotspots.removed) {
      expect(item).not.toHaveProperty("scoreDelta");
      expect(item).not.toHaveProperty("nclocDelta");
      expect(item).not.toHaveProperty("commitCountDelta");
    }
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
    const baseline = scanResult([
      hotspot("src/z.ts", 0.9),
      hotspot("src/a.ts", 0.8),
    ]);
    const current = scanResult(
      [hotspot("src/a.ts", 0.9), hotspot("src/z.ts", 0.8)],
      { scannedAt: "2026-02-01T00:00:00.000Z" },
    );

    const result = compareScanResults(baseline, current);

    expect(result.hotspots.rankChanged).toHaveLength(2);
    expect(result.hotspots.rankChanged.map((c) => c.entity.filePath)).toEqual([
      "src/a.ts",
      "src/z.ts",
    ]);
  });

  it("sorts multiple removed hotspots by baseline rank", () => {
    const baseline = scanResult([
      hotspot("src/a.ts", 0.9),
      hotspot("src/b.ts", 0.8),
      hotspot("src/c.ts", 0.7),
    ]);
    const current = scanResult([hotspot("src/a.ts", 0.9)], {
      scannedAt: "2026-02-01T00:00:00.000Z",
    });

    const result = compareScanResults(baseline, current);

    expect(result.hotspots.removed.map((item) => item.filePath)).toEqual([
      "src/b.ts",
      "src/c.ts",
    ]);
  });

  it("sorts multiple new hotspots by current rank", () => {
    const baseline = scanResult([hotspot("src/a.ts", 0.9)]);
    const current = scanResult(
      [
        hotspot("src/z.ts", 0.95),
        hotspot("src/a.ts", 0.9),
        hotspot("src/m.ts", 0.85),
      ],
      { scannedAt: "2026-02-01T00:00:00.000Z" },
    );

    const result = compareScanResults(baseline, current);

    expect(result.hotspots.new.map((item) => item.filePath)).toEqual([
      "src/z.ts",
      "src/m.ts",
    ]);
  });
});
