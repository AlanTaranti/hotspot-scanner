import { describe, expect, it } from "vitest";
import type {
  CompareResult,
  CouplingPair,
  FunctionHotspotScore,
  HotspotScore,
  RankChange,
  ScanMeta,
} from "../types/index.js";
import {
  COMPARE_TRIAGE_RANK_DELTA_THRESHOLD,
  COMPARE_TRIAGE_WORSENED_SCORE_THRESHOLD,
  buildCompareTriageHints,
} from "./compare-triage.js";
import {
  TRIAGE_COUPLING_STRENGTH_THRESHOLD,
  TRIAGE_HOTSPOT_SCORE_THRESHOLD,
  TRIAGE_MAX_HINTS_PER_RULE,
  TRIAGE_NORMALIZED_SIGNAL_THRESHOLD,
} from "./triage.js";

const BASE_META: ScanMeta = {
  since: "6 months ago",
  scannedAt: "2026-07-22T11:00:00.000Z",
  granularity: "file",
  warnings: [],
};

function makeCompareResult(
  overrides: Partial<
    Pick<CompareResult, "hotspots" | "functions" | "coupling" | "granularity">
  > = {},
): CompareResult {
  return {
    version: "1.0",
    granularity: "file",
    hotspots: { new: [], removed: [], rankChanged: [] },
    functions: { new: [], removed: [], rankChanged: [] },
    coupling: { new: [], removed: [], rankChanged: [] },
    meta: { baseline: BASE_META, current: BASE_META, warnings: [] },
    ...overrides,
  };
}

function makeHotspot(overrides: Partial<HotspotScore> = {}): HotspotScore {
  return {
    filePath: "src/hot.ts",
    complexityNormalized: 0.9,
    churnNormalized: 0.9,
    hotspotScore: 0.85,
    cyclomaticComplexity: 42,
    functionCount: 8,
    commitCount: 15,
    linesChanged: 320,
    authorCount: 3,
    parseFailed: false,
    ...overrides,
  };
}

function makeFunctionHotspot(
  overrides: Partial<FunctionHotspotScore> = {},
): FunctionHotspotScore {
  return {
    filePath: "src/hot.ts",
    functionName: "run",
    line: 10,
    complexity: 12,
    complexityNormalized: 0.8,
    churnNormalized: 0.7,
    hotspotScore: 0.75,
    commitCount: 5,
    linesChanged: 80,
    authorCount: 2,
    ...overrides,
  };
}

function makeCouplingPair(overrides: Partial<CouplingPair> = {}): CouplingPair {
  return {
    fileA: "src/a.ts",
    fileB: "src/b.ts",
    coChangeCount: 5,
    couplingStrength: 0.75,
    hasStaticDependency: true,
    staticDependencyDirection: "a-to-b",
    hasRuntimeStaticDependency: true,
    hasTypeOnlyStaticDependency: false,
    hasReExportStaticDependency: false,
    ...overrides,
  };
}

function makeRankChange<T extends HotspotScore | FunctionHotspotScore>(
  entity: T,
  overrides: Partial<RankChange<T>> = {},
): RankChange<T> {
  return {
    entity,
    baselineRank: 1,
    currentRank: 6,
    rankDelta: COMPARE_TRIAGE_RANK_DELTA_THRESHOLD,
    ...overrides,
  };
}

describe("buildCompareTriageHints", () => {
  it("returns an empty array when no rows match", () => {
    expect(buildCompareTriageHints(makeCompareResult())).toEqual([]);
  });

  it("matches new-dual-signal for new file hotspots at thresholds", () => {
    const hints = buildCompareTriageHints(
      makeCompareResult({
        hotspots: {
          new: [
            makeHotspot({
              filePath: "src/edge.ts",
              hotspotScore: TRIAGE_HOTSPOT_SCORE_THRESHOLD,
              complexityNormalized: TRIAGE_NORMALIZED_SIGNAL_THRESHOLD,
              churnNormalized: TRIAGE_NORMALIZED_SIGNAL_THRESHOLD,
            }),
          ],
          removed: [],
          rankChanged: [],
        },
      }),
    );

    expect(hints).toEqual([
      {
        ruleId: "new-dual-signal",
        message:
          "New dual-signal hotspot vs baseline — complexity and churn both elevated; prioritize review.",
        target: "src/edge.ts",
        rankMetric: TRIAGE_HOTSPOT_SCORE_THRESHOLD,
      },
    ]);
  });

  it("matches new-dual-signal for new function hotspots", () => {
    const hints = buildCompareTriageHints(
      makeCompareResult({
        functions: {
          new: [makeFunctionHotspot({ filePath: "src/foo.ts", functionName: "bar" })],
          removed: [],
          rankChanged: [],
        },
      }),
    );

    expect(hints).toEqual([
      {
        ruleId: "new-dual-signal",
        message:
          "New dual-signal hotspot vs baseline — complexity and churn both elevated; prioritize review.",
        target: "src/foo.ts::bar",
        rankMetric: 0.75,
      },
    ]);
  });

  it("does not match new-dual-signal when any signal is below threshold", () => {
    const lowScore = makeHotspot({ hotspotScore: TRIAGE_HOTSPOT_SCORE_THRESHOLD - 0.01 });
    const lowComplexity = makeHotspot({
      complexityNormalized: TRIAGE_NORMALIZED_SIGNAL_THRESHOLD - 0.01,
    });
    const lowChurn = makeHotspot({
      churnNormalized: TRIAGE_NORMALIZED_SIGNAL_THRESHOLD - 0.01,
    });

    expect(
      buildCompareTriageHints(
        makeCompareResult({ hotspots: { new: [lowScore], removed: [], rankChanged: [] } }),
      ),
    ).toEqual([]);
    expect(
      buildCompareTriageHints(
        makeCompareResult({
          hotspots: { new: [lowComplexity], removed: [], rankChanged: [] },
        }),
      ),
    ).toEqual([]);
    expect(
      buildCompareTriageHints(
        makeCompareResult({ hotspots: { new: [lowChurn], removed: [], rankChanged: [] } }),
      ),
    ).toEqual([]);
  });

  it("does not match new-dual-signal for removed or rank-changed hotspots", () => {
    const dualSignal = makeHotspot();

    const removedHints = buildCompareTriageHints(
      makeCompareResult({
        hotspots: { new: [], removed: [dualSignal], rankChanged: [] },
      }),
    );
    const rankChangedHints = buildCompareTriageHints(
      makeCompareResult({
        hotspots: {
          new: [],
          removed: [],
          rankChanged: [makeRankChange(dualSignal)],
        },
      }),
    );

    expect(removedHints.some((hint) => hint.ruleId === "new-dual-signal")).toBe(false);
    expect(rankChangedHints.some((hint) => hint.ruleId === "new-dual-signal")).toBe(false);
  });

  it("matches rank-worsened for rank-changed hotspots at thresholds", () => {
    const hints = buildCompareTriageHints(
      makeCompareResult({
        hotspots: {
          new: [],
          removed: [],
          rankChanged: [
            makeRankChange(
              makeHotspot({
                filePath: "src/regressed.ts",
                hotspotScore: COMPARE_TRIAGE_WORSENED_SCORE_THRESHOLD,
              }),
              { rankDelta: COMPARE_TRIAGE_RANK_DELTA_THRESHOLD },
            ),
          ],
        },
      }),
    );

    expect(hints).toEqual([
      {
        ruleId: "rank-worsened",
        message: "Rank worsened by ≥5 vs baseline — investigate regression.",
        target: "src/regressed.ts",
        rankMetric: COMPARE_TRIAGE_RANK_DELTA_THRESHOLD,
      },
    ]);
  });

  it("matches rank-worsened for rank-changed function hotspots", () => {
    const hints = buildCompareTriageHints(
      makeCompareResult({
        functions: {
          new: [],
          removed: [],
          rankChanged: [
            makeRankChange(
              makeFunctionHotspot({
                filePath: "src/foo.ts",
                functionName: "baz",
                hotspotScore: 0.6,
              }),
              { rankDelta: 7 },
            ),
          ],
        },
      }),
    );

    expect(hints).toEqual([
      {
        ruleId: "rank-worsened",
        message: "Rank worsened by ≥5 vs baseline — investigate regression.",
        target: "src/foo.ts::baz",
        rankMetric: 7,
      },
    ]);
  });

  it("does not match rank-worsened when rank delta or score is below threshold", () => {
    const lowDelta = makeRankChange(makeHotspot({ hotspotScore: 0.9 }), {
      rankDelta: COMPARE_TRIAGE_RANK_DELTA_THRESHOLD - 1,
    });
    const lowScore = makeRankChange(
      makeHotspot({ hotspotScore: COMPARE_TRIAGE_WORSENED_SCORE_THRESHOLD - 0.01 }),
      { rankDelta: 10 },
    );

    expect(
      buildCompareTriageHints(
        makeCompareResult({
          hotspots: { new: [], removed: [], rankChanged: [lowDelta] },
        }),
      ),
    ).toEqual([]);
    expect(
      buildCompareTriageHints(
        makeCompareResult({
          hotspots: { new: [], removed: [], rankChanged: [lowScore] },
        }),
      ),
    ).toEqual([]);
  });

  it("matches new-coupled-with-static for new coupling pairs at the strength threshold", () => {
    const hints = buildCompareTriageHints(
      makeCompareResult({
        coupling: {
          new: [
            makeCouplingPair({
              fileA: "src/x.ts",
              fileB: "src/y.ts",
              couplingStrength: TRIAGE_COUPLING_STRENGTH_THRESHOLD,
              hasStaticDependency: true,
            }),
          ],
          removed: [],
          rankChanged: [],
        },
      }),
    );

    expect(hints).toEqual([
      {
        ruleId: "new-coupled-with-static",
        message:
          "New strong temporal coupling with a static dependency vs baseline — candidate boundary/split review.",
        target: "src/x.ts ↔ src/y.ts",
        rankMetric: TRIAGE_COUPLING_STRENGTH_THRESHOLD,
      },
    ]);
  });

  it("does not match new-coupled-with-static when strength is low or static dep is false", () => {
    const lowStrength = makeCouplingPair({
      couplingStrength: TRIAGE_COUPLING_STRENGTH_THRESHOLD - 0.01,
      hasStaticDependency: true,
    });
    const noStatic = makeCouplingPair({
      couplingStrength: 0.9,
      hasStaticDependency: false,
    });

    expect(
      buildCompareTriageHints(
        makeCompareResult({
          coupling: { new: [lowStrength], removed: [], rankChanged: [] },
        }),
      ).some((hint) => hint.ruleId === "new-coupled-with-static"),
    ).toBe(false);
    expect(
      buildCompareTriageHints(
        makeCompareResult({
          coupling: { new: [noStatic], removed: [], rankChanged: [] },
        }),
      ).some((hint) => hint.ruleId === "new-coupled-with-static"),
    ).toBe(false);
  });

  it("does not match new-coupled-with-static for removed or rank-changed coupling", () => {
    const pair = makeCouplingPair();

    expect(
      buildCompareTriageHints(
        makeCompareResult({
          coupling: { new: [], removed: [pair], rankChanged: [] },
        }),
      ),
    ).toEqual([]);
    expect(
      buildCompareTriageHints(
        makeCompareResult({
          coupling: {
            new: [],
            removed: [],
            rankChanged: [
              {
                entity: pair,
                baselineRank: 1,
                currentRank: 6,
                rankDelta: 5,
              },
            ],
          },
        }),
      ),
    ).toEqual([]);
  });

  it("caps each rule at three matches sorted by rank metric descending", () => {
    const newHotspots = Array.from({ length: 5 }, (_, index) =>
      makeHotspot({
        filePath: `src/h${index}.ts`,
        hotspotScore: 0.71 + index * 0.01,
      }),
    );
    const rankChanges = Array.from({ length: 4 }, (_, index) =>
      makeRankChange(
        makeHotspot({
          filePath: `src/r${index}.ts`,
          hotspotScore: 0.6,
        }),
        { rankDelta: COMPARE_TRIAGE_RANK_DELTA_THRESHOLD + index },
      ),
    );
    const newPairs = Array.from({ length: 4 }, (_, index) =>
      makeCouplingPair({
        fileA: `src/sa${index}.ts`,
        fileB: `src/sb${index}.ts`,
        couplingStrength: 0.51 + index * 0.01,
        hasStaticDependency: true,
      }),
    );

    const hints = buildCompareTriageHints(
      makeCompareResult({
        hotspots: { new: newHotspots, removed: [], rankChanged: rankChanges },
        coupling: { new: newPairs, removed: [], rankChanged: [] },
      }),
    );

    const dualSignal = hints.filter((hint) => hint.ruleId === "new-dual-signal");
    const rankWorsened = hints.filter((hint) => hint.ruleId === "rank-worsened");
    const coupledStatic = hints.filter(
      (hint) => hint.ruleId === "new-coupled-with-static",
    );

    expect(dualSignal).toHaveLength(TRIAGE_MAX_HINTS_PER_RULE);
    expect(rankWorsened).toHaveLength(TRIAGE_MAX_HINTS_PER_RULE);
    expect(coupledStatic).toHaveLength(TRIAGE_MAX_HINTS_PER_RULE);

    expect(dualSignal.map((hint) => hint.target)).toEqual([
      "src/h4.ts",
      "src/h3.ts",
      "src/h2.ts",
    ]);
    expect(rankWorsened.map((hint) => hint.rankMetric)).toEqual([8, 7, 6]);
    expect(coupledStatic.map((hint) => hint.rankMetric)).toEqual([0.54, 0.53, 0.52]);
  });
});
