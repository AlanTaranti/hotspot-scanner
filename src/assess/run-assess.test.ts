import { describe, expect, it, vi } from "vitest";
import type { HotspotScore, ScanResult } from "#types";
import type { ComplexityTrendResult } from "../trend/types.js";
import { TrendNotTrackedError } from "../trend/types.js";
import { runAssess } from "./run-assess.js";
import {
  ASSESS_RESULT_KIND,
  ASSESS_RESULT_VERSION,
  DEFAULT_MIN_HOTSPOT_SCORE,
} from "./types.js";

function makeHotspot(overrides: Partial<HotspotScore> = {}): HotspotScore {
  return {
    filePath: "src/hot.ts",
    complexityNormalized: 0.9,
    churnNormalized: 0.9,
    hotspotScore: 0.85,
    ncloc: 42,
    commitCount: 15,
    linesChanged: 320,
    authorCount: 3,
    ...overrides,
  };
}

function makeScanResult(hotspots: HotspotScore[]): ScanResult {
  return {
    version: "3.0",
    hotspots,
    meta: {
      since: "12 months ago",
      scannedAt: "2026-01-01T00:00:00.000Z",
      warnings: [],
      timings: { gitMs: 10, complexityMs: 20, totalMs: 30 },
      scannerVersion: "9.9.9",
    },
  };
}

function makeTrendResult(
  filePath: string,
  growthPattern: ComplexityTrendResult["meta"]["growthPattern"],
  overrides: Partial<ComplexityTrendResult> = {},
): ComplexityTrendResult {
  return {
    version: "3.0",
    kind: "complexity-trend",
    filePath,
    points: [
      {
        rev: "abc",
        indentLines: 10,
        indentTotal: 20,
        indentMean: 2,
        indentSd: 0.5,
        indentMax: 4,
        ncloc: 100,
      },
      {
        rev: "def",
        indentLines: 12,
        indentTotal: 30,
        indentMean: 2.5,
        indentSd: 0.6,
        indentMax: 5,
        ncloc: 110,
      },
    ],
    meta: {
      since: "12 months ago",
      revisionCount: 2,
      truncated: false,
      maxRevisions: 100,
      sparklines: { indentMean: "▁█", ncloc: "▁█" },
      metricLegend: {
        indentMean: "mean indent depth",
        ncloc: "non-comment lines",
      },
      growthPattern,
      warnings: [],
    },
    ...overrides,
  };
}

describe("runAssess", () => {
  it("filters and tops candidates, copying growthPattern without points", async () => {
    const hotspots = [
      makeHotspot({ filePath: "src/low.ts", hotspotScore: 0.5 }),
      makeHotspot({ filePath: "src/top.ts", hotspotScore: 0.95, ncloc: 200 }),
      makeHotspot({ filePath: "src/mid.ts", hotspotScore: 0.8, ncloc: 120 }),
      makeHotspot({ filePath: "src/edge.ts", hotspotScore: 0.7, ncloc: 80 }),
      makeHotspot({ filePath: "src/extra.ts", hotspotScore: 0.75, ncloc: 60 }),
    ];

    const runScan = vi.fn().mockResolvedValue(makeScanResult(hotspots));
    const runComplexityTrend = vi
      .fn()
      .mockImplementation(async ({ filePath }: { filePath: string }) => {
        const relativePath = filePath.replace(/^\/repo\//, "");
        if (relativePath === "src/top.ts") {
          return makeTrendResult(relativePath, {
            kind: "deteriorating",
            summary: "indentMean +22% over history",
            indentMeanDeltaRel: 0.22,
          });
        }
        return makeTrendResult(relativePath, {
          kind: "stable",
          summary: "indentMean within ±8%",
        });
      });

    const result = await runAssess(
      {
        repoPath: "/repo",
        minHotspotScore: 0.7,
        top: 2,
      },
      { runScan, runComplexityTrend, getPackageVersion: () => "1.2.3" },
    );

    expect(result.version).toBe(ASSESS_RESULT_VERSION);
    expect(result.kind).toBe(ASSESS_RESULT_KIND);
    expect(result.meta).toMatchObject({
      repoPath: "/repo",
      since: "12 months ago",
      minHotspotScore: 0.7,
      top: 2,
      scannedHotspotCount: 5,
      candidateCount: 2,
      patternCounts: {
        deteriorating: 1,
        refactored: 0,
        stable: 1,
        inconclusive: 0,
      },
      skippedCount: 0,
      errorCount: 0,
      scannerVersion: "1.2.3",
    });

    expect(result.candidates.map((row) => row.filePath)).toEqual([
      "src/top.ts",
      "src/mid.ts",
    ]);
    expect(result.candidates[0]).toMatchObject({
      status: "ok",
      hotspotScore: 0.95,
      ncloc: 200,
      growthPattern: {
        kind: "deteriorating",
        summary: "indentMean +22% over history",
        indentMeanDeltaRel: 0.22,
      },
      revisionCount: 2,
      truncated: false,
    });
    expect(result.candidates[0]).not.toHaveProperty("points");
    expect(JSON.stringify(result.candidates[0])).not.toContain('"points"');
  });

  it("soft-continues after a mid-batch trend failure and still runs remaining trends", async () => {
    const hotspots = [
      makeHotspot({ filePath: "src/one.ts", hotspotScore: 0.9 }),
      makeHotspot({ filePath: "src/two.ts", hotspotScore: 0.85 }),
      makeHotspot({ filePath: "src/three.ts", hotspotScore: 0.8 }),
    ];

    const runScan = vi.fn().mockResolvedValue(makeScanResult(hotspots));
    const runComplexityTrend = vi
      .fn()
      .mockImplementation(async ({ filePath }: { filePath: string }) => {
        const relativePath = filePath.replace(/^\/repo\//, "");
        if (relativePath === "src/two.ts") {
          throw new Error("git show failed");
        }
        if (relativePath === "src/three.ts") {
          throw new TrendNotTrackedError(relativePath);
        }
        return makeTrendResult(relativePath, {
          kind: "stable",
          summary: "indentMean within ±8%",
        });
      });

    const result = await runAssess(
      { repoPath: "/repo", minHotspotScore: DEFAULT_MIN_HOTSPOT_SCORE, top: 3 },
      { runScan, runComplexityTrend },
    );

    expect(runComplexityTrend).toHaveBeenCalledTimes(3);
    expect(result.candidates).toEqual([
      expect.objectContaining({
        filePath: "src/one.ts",
        status: "ok",
        growthPattern: expect.objectContaining({ kind: "stable" }),
      }),
      expect.objectContaining({
        filePath: "src/two.ts",
        status: "error",
        message: "git show failed",
      }),
      expect.objectContaining({
        filePath: "src/three.ts",
        status: "skipped",
        message: expect.stringContaining("src/three.ts"),
      }),
    ]);
    expect(result.meta.errorCount).toBe(1);
    expect(result.meta.skippedCount).toBe(1);
    expect(result.meta.patternCounts).toEqual({
      deteriorating: 0,
      refactored: 0,
      stable: 1,
      inconclusive: 0,
    });
  });

  it("invokes onAssessProgress once per candidate in order", async () => {
    const hotspots = [
      makeHotspot({ filePath: "src/a.ts", hotspotScore: 0.9 }),
      makeHotspot({ filePath: "src/b.ts", hotspotScore: 0.85 }),
      makeHotspot({ filePath: "src/c.ts", hotspotScore: 0.8 }),
    ];

    const runScan = vi.fn().mockResolvedValue(makeScanResult(hotspots));
    const runComplexityTrend = vi
      .fn()
      .mockImplementation(async ({ filePath }: { filePath: string }) =>
        makeTrendResult(filePath.replace(/^\/repo\//, ""), {
          kind: "inconclusive",
          summary: "insufficient history",
        }),
      );
    const onAssessProgress = vi.fn();

    await runAssess(
      { repoPath: "/repo", onAssessProgress },
      { runScan, runComplexityTrend },
    );

    expect(onAssessProgress).toHaveBeenCalledTimes(3);
    expect(onAssessProgress.mock.calls).toEqual([
      [{ index: 1, total: 3, filePath: "src/a.ts" }],
      [{ index: 2, total: 3, filePath: "src/b.ts" }],
      [{ index: 3, total: 3, filePath: "src/c.ts" }],
    ]);
  });

  it("forwards AbortSignal to scan and each trend call", async () => {
    const controller = new AbortController();
    const hotspots = [
      makeHotspot({ filePath: "src/a.ts", hotspotScore: 0.9 }),
      makeHotspot({ filePath: "src/b.ts", hotspotScore: 0.85 }),
    ];

    const runScan = vi.fn().mockResolvedValue(makeScanResult(hotspots));
    const runComplexityTrend = vi
      .fn()
      .mockImplementation(async ({ filePath }: { filePath: string }) =>
        makeTrendResult(filePath.replace(/^\/repo\//, ""), {
          kind: "stable",
          summary: "stable",
        }),
      );

    await runAssess(
      { repoPath: "/repo", signal: controller.signal },
      { runScan, runComplexityTrend },
    );

    expect(runScan).toHaveBeenCalledWith(
      expect.objectContaining({ signal: controller.signal }),
    );
    for (const call of runComplexityTrend.mock.calls) {
      expect(call[0]).toMatchObject({ signal: controller.signal });
    }
  });

  it("does not invoke onAssessProgress or trend when no candidates match", async () => {
    const runScan = vi
      .fn()
      .mockResolvedValue(
        makeScanResult([
          makeHotspot({ filePath: "src/low.ts", hotspotScore: 0.2 }),
        ]),
      );
    const runComplexityTrend = vi.fn();
    const onAssessProgress = vi.fn();

    const result = await runAssess(
      {
        repoPath: "/repo",
        minHotspotScore: 0.7,
        onAssessProgress,
      },
      { runScan, runComplexityTrend },
    );

    expect(result.candidates).toEqual([]);
    expect(result.meta.candidateCount).toBe(0);
    expect(onAssessProgress).not.toHaveBeenCalled();
    expect(runComplexityTrend).not.toHaveBeenCalled();
  });
});
