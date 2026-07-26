import type { ScanResult } from "../types/index.js";

export const TRIAGE_HOTSPOT_SCORE_THRESHOLD = 0.7;
export const TRIAGE_NORMALIZED_SIGNAL_THRESHOLD = 0.5;
export const TRIAGE_MAX_HINTS_PER_RULE = 3;

export type TriageRuleId = "dual-signal-hotspot";

export interface TriageHint {
  ruleId: TriageRuleId;
  message: string;
  target: string;
  rankMetric: number;
}

/** Shared render shape for scan and compare triage hints. */
export type RenderableTriageHint = Pick<TriageHint, "message" | "target">;

const DUAL_SIGNAL_MESSAGE =
  "High dual-signal hotspot — NCLOC and churn both elevated; prioritize review.";

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

function buildDualSignalHints(result: ScanResult): TriageHint[] {
  const matches: TriageHint[] = [];

  for (const hotspot of result.hotspots) {
    if (!isDualSignalHotspot(hotspot)) {
      continue;
    }
    matches.push({
      ruleId: "dual-signal-hotspot",
      message: DUAL_SIGNAL_MESSAGE,
      target: hotspot.filePath,
      rankMetric: hotspot.hotspotScore,
    });
  }

  return takeTopByMetric(matches, (hint) => hint.rankMetric, TRIAGE_MAX_HINTS_PER_RULE);
}

export function buildTriageHints(displayed: ScanResult): TriageHint[] {
  return buildDualSignalHints(displayed);
}

export function renderTableTriageHints(hints: readonly RenderableTriageHint[]): string[] {
  if (hints.length === 0) {
    return [];
  }

  return [
    "Triage hints",
    ...hints.map((hint) => `  • ${hint.target} — ${hint.message}`),
  ];
}

export function renderMarkdownTriageHints(hints: readonly RenderableTriageHint[]): string[] {
  if (hints.length === 0) {
    return [];
  }

  return [
    "## Triage hints",
    "",
    ...hints.map((hint) => `- ${hint.target} — ${hint.message}`),
  ];
}
