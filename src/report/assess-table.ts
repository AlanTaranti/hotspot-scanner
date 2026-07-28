import type { AssessCandidate, AssessResult } from "../assess/types.js";
import {
  paintBold,
  paintGrowthPattern,
  paintScore,
  type GrowthPatternKind,
} from "./color.js";

const SCORE_DECIMALS = 4;

export function formatAssessHotspotScore(value: number): string {
  return value.toFixed(SCORE_DECIMALS);
}

function formatPatternCountsLine(
  patternCounts: AssessResult["meta"]["patternCounts"],
  color: boolean,
): string {
  const kinds: GrowthPatternKind[] = [
    "deteriorating",
    "refactored",
    "stable",
    "inconclusive",
  ];
  const parts = kinds.map(
    (kind) => `${paintGrowthPattern(kind, color)}=${patternCounts[kind]}`,
  );
  return `Pattern counts: ${parts.join("  ")}`;
}

export function buildAssessSummaryLines(
  result: AssessResult,
  options?: { color?: boolean },
): string[] {
  const color = options?.color === true;
  const { meta } = result;

  return [
    paintBold("Hotspot assess", color),
    `since=${meta.since}  minHotspotScore=${meta.minHotspotScore}  top=${meta.top}`,
    `Candidates: ${meta.candidateCount}`,
    formatPatternCountsLine(meta.patternCounts, color),
    `Skipped: ${meta.skippedCount}  Errors: ${meta.errorCount}`,
  ];
}

function isDeterioratingCandidate(candidate: AssessCandidate): boolean {
  return (
    candidate.status === "ok" &&
    candidate.growthPattern?.kind === "deteriorating"
  );
}

function formatDeterioratingDetailLine(
  candidate: AssessCandidate,
  color: boolean,
): string {
  const summary = candidate.growthPattern?.summary ?? "";
  return `${candidate.filePath}  score=${paintScore(candidate.hotspotScore, color)}  Pattern: ${paintGrowthPattern("deteriorating", color)} — ${summary}`;
}

export function renderAssessTable(
  result: AssessResult,
  options?: { color?: boolean },
): string {
  const color = options?.color === true;
  const lines = [
    ...buildAssessSummaryLines(result, { color }),
    "",
    paintBold("Deteriorating", color),
  ];
  const deteriorating = result.candidates.filter(isDeterioratingCandidate);

  if (deteriorating.length === 0) {
    lines.push("No deteriorating candidates.");
  } else {
    for (const candidate of deteriorating) {
      lines.push(formatDeterioratingDetailLine(candidate, color));
    }
  }

  return `${lines.join("\n")}\n`;
}
