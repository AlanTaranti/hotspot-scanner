import type { AssessCandidate, AssessResult } from "../assess/types.js";

const SCORE_DECIMALS = 4;

export function formatAssessHotspotScore(value: number): string {
  return value.toFixed(SCORE_DECIMALS);
}

export function buildAssessSummaryLines(result: AssessResult): string[] {
  const { meta } = result;
  const { patternCounts } = meta;

  return [
    "Hotspot assess",
    `since=${meta.since}  minHotspotScore=${meta.minHotspotScore}  top=${meta.top}`,
    `Candidates: ${meta.candidateCount}`,
    `Pattern counts: deteriorating=${patternCounts.deteriorating}  refactored=${patternCounts.refactored}  stable=${patternCounts.stable}  inconclusive=${patternCounts.inconclusive}`,
    `Skipped: ${meta.skippedCount}  Errors: ${meta.errorCount}`,
  ];
}

function isDeterioratingCandidate(candidate: AssessCandidate): boolean {
  return (
    candidate.status === "ok" &&
    candidate.growthPattern?.kind === "deteriorating"
  );
}

function formatDeterioratingDetailLine(candidate: AssessCandidate): string {
  const summary = candidate.growthPattern?.summary ?? "";
  return `${candidate.filePath}  score=${formatAssessHotspotScore(candidate.hotspotScore)}  Pattern: deteriorating — ${summary}`;
}

export function renderAssessTable(result: AssessResult): string {
  const lines = [...buildAssessSummaryLines(result), "", "Deteriorating"];
  const deteriorating = result.candidates.filter(isDeterioratingCandidate);

  if (deteriorating.length === 0) {
    lines.push("No deteriorating candidates.");
  } else {
    for (const candidate of deteriorating) {
      lines.push(formatDeterioratingDetailLine(candidate));
    }
  }

  return `${lines.join("\n")}\n`;
}
