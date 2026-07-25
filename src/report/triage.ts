import type {
  CouplingPair,
  FunctionHotspotScore,
  HotspotScore,
  ScanResult,
} from "../types/index.js";

export const TRIAGE_HOTSPOT_SCORE_THRESHOLD = 0.7;
export const TRIAGE_NORMALIZED_SIGNAL_THRESHOLD = 0.5;
export const TRIAGE_COUPLING_STRENGTH_THRESHOLD = 0.5;
export const TRIAGE_MAX_HINTS_PER_RULE = 3;

export type TriageRuleId =
  | "dual-signal-hotspot"
  | "coupled-with-static"
  | "coupled-without-static";

export interface TriageHint {
  ruleId: TriageRuleId;
  message: string;
  target: string;
  rankMetric: number;
}

const DUAL_SIGNAL_MESSAGE =
  "High dual-signal hotspot — complexity and churn both elevated; prioritize review.";
const COUPLED_WITH_STATIC_MESSAGE =
  "Strong temporal coupling with a static dependency — candidate boundary/split review.";
const COUPLED_WITHOUT_STATIC_MESSAGE =
  "Strong temporal coupling without a static edge — may be coincidence or unresolved import/alias; verify before refactoring.";

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

function formatCouplingTarget(pair: CouplingPair): string {
  return `${pair.fileA} ↔ ${pair.fileB}`;
}

function formatFunctionTarget(fn: FunctionHotspotScore): string {
  return `${fn.filePath}::${fn.functionName}`;
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

  for (const fn of result.functions) {
    if (!isDualSignalHotspot(fn)) {
      continue;
    }
    matches.push({
      ruleId: "dual-signal-hotspot",
      message: DUAL_SIGNAL_MESSAGE,
      target: formatFunctionTarget(fn),
      rankMetric: fn.hotspotScore,
    });
  }

  return takeTopByMetric(matches, (hint) => hint.rankMetric, TRIAGE_MAX_HINTS_PER_RULE);
}

function buildCoupledWithStaticHints(result: ScanResult): TriageHint[] {
  const matches = result.coupling
    .filter(
      (pair) =>
        pair.couplingStrength >= TRIAGE_COUPLING_STRENGTH_THRESHOLD &&
        pair.hasStaticDependency,
    )
    .map((pair) => ({
      ruleId: "coupled-with-static" as const,
      message: COUPLED_WITH_STATIC_MESSAGE,
      target: formatCouplingTarget(pair),
      rankMetric: pair.couplingStrength,
    }));

  return takeTopByMetric(matches, (hint) => hint.rankMetric, TRIAGE_MAX_HINTS_PER_RULE);
}

function buildCoupledWithoutStaticHints(result: ScanResult): TriageHint[] {
  const matches = result.coupling
    .filter(
      (pair) =>
        pair.couplingStrength >= TRIAGE_COUPLING_STRENGTH_THRESHOLD &&
        !pair.hasStaticDependency,
    )
    .map((pair) => ({
      ruleId: "coupled-without-static" as const,
      message: COUPLED_WITHOUT_STATIC_MESSAGE,
      target: formatCouplingTarget(pair),
      rankMetric: pair.couplingStrength,
    }));

  return takeTopByMetric(matches, (hint) => hint.rankMetric, TRIAGE_MAX_HINTS_PER_RULE);
}

export function buildTriageHints(displayed: ScanResult): TriageHint[] {
  return [
    ...buildDualSignalHints(displayed),
    ...buildCoupledWithStaticHints(displayed),
    ...buildCoupledWithoutStaticHints(displayed),
  ];
}

export function renderTableTriageHints(hints: readonly TriageHint[]): string[] {
  if (hints.length === 0) {
    return [];
  }

  return [
    "Triage hints",
    ...hints.map((hint) => `  • ${hint.target} — ${hint.message}`),
  ];
}

export function renderMarkdownTriageHints(hints: readonly TriageHint[]): string[] {
  if (hints.length === 0) {
    return [];
  }

  return [
    "## Triage hints",
    "",
    ...hints.map((hint) => `- ${hint.target} — ${hint.message}`),
  ];
}
