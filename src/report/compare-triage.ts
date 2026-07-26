import type {
  CompareResult,
  HotspotScore,
  RankChange,
} from "../types/index.js";
import {
  TRIAGE_HOTSPOT_SCORE_THRESHOLD,
  TRIAGE_MAX_HINTS_PER_RULE,
  TRIAGE_NORMALIZED_SIGNAL_THRESHOLD,
} from "./triage.js";

export const COMPARE_TRIAGE_RANK_DELTA_THRESHOLD = 5;
export const COMPARE_TRIAGE_WORSENED_SCORE_THRESHOLD = 0.5;

export type CompareTriageRuleId = "new-dual-signal" | "rank-worsened";

export interface CompareTriageHint {
  ruleId: CompareTriageRuleId;
  message: string;
  target: string;
  rankMetric: number;
}

const NEW_DUAL_SIGNAL_MESSAGE =
  "New dual-signal hotspot vs baseline — NCLOC and churn both elevated; prioritize review.";
const RANK_WORSENED_MESSAGE =
  "Rank worsened by ≥5 vs baseline — investigate regression.";

function isDualSignalHotspot(row: {
  hotspotScore: number;
  complexityNormalized: number;
  churnNormalized: number;
}): boolean {
  return (
    row.hotspotScore >= TRIAGE_HOTSPOT_SCORE_THRESHOLD &&
    row.complexityNormalized >= TRIAGE_NORMALIZED_SIGNAL_THRESHOLD &&
    row.churnNormalized >= TRIAGE_NORMALIZED_SIGNAL_THRESHOLD
  );
}

function takeTopByMetric<T>(
  items: T[],
  metric: (item: T) => number,
  limit: number,
): T[] {
  return [...items].sort((left, right) => metric(right) - metric(left)).slice(0, limit);
}

function buildNewDualSignalHints(result: CompareResult): CompareTriageHint[] {
  const matches: CompareTriageHint[] = [];

  for (const hotspot of result.hotspots.new) {
    if (!isDualSignalHotspot(hotspot)) {
      continue;
    }
    matches.push({
      ruleId: "new-dual-signal",
      message: NEW_DUAL_SIGNAL_MESSAGE,
      target: hotspot.filePath,
      rankMetric: hotspot.hotspotScore,
    });
  }

  return takeTopByMetric(matches, (hint) => hint.rankMetric, TRIAGE_MAX_HINTS_PER_RULE);
}

function buildRankWorsenedHints(result: CompareResult): CompareTriageHint[] {
  const matches: CompareTriageHint[] = [];

  for (const change of result.hotspots.rankChanged) {
    if (
      change.rankDelta < COMPARE_TRIAGE_RANK_DELTA_THRESHOLD ||
      change.entity.hotspotScore < COMPARE_TRIAGE_WORSENED_SCORE_THRESHOLD
    ) {
      continue;
    }
    matches.push({
      ruleId: "rank-worsened",
      message: RANK_WORSENED_MESSAGE,
      target: change.entity.filePath,
      rankMetric: change.rankDelta,
    });
  }

  return takeTopByMetric(matches, (hint) => hint.rankMetric, TRIAGE_MAX_HINTS_PER_RULE);
}

export function buildCompareTriageHints(result: CompareResult): CompareTriageHint[] {
  return [...buildNewDualSignalHints(result), ...buildRankWorsenedHints(result)];
}
