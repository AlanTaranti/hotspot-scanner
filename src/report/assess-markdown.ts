import type { AssessCandidate, AssessResult } from "../assess/types.js";
import {
  buildAssessSummaryLines,
  formatAssessHotspotScore,
} from "./assess-table.js";

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

export function renderAssessMarkdown(result: AssessResult): string {
  const sections = [
    ...buildAssessSummaryLines(result),
    "",
    "## Deteriorating",
    "",
  ];
  const deteriorating = result.candidates.filter(isDeterioratingCandidate);

  if (deteriorating.length === 0) {
    sections.push("_No deteriorating candidates._");
  } else {
    for (const candidate of deteriorating) {
      sections.push(formatDeterioratingDetailLine(candidate));
    }
  }

  return `${sections.join("\n")}\n`;
}
