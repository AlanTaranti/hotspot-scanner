import type { ScanResult } from "../types/index.js";
import { renderMarkdownHowToRead } from "./glossary.js";
import { buildScanExecutiveSummary } from "./summary.js";
import {
  buildTriageHints,
  renderMarkdownTriageHints,
} from "./triage.js";

const SCORE_DECIMALS = 4;

export interface MarkdownRenderOptions {
  /** Full pre-slice result for executive summary totals. Defaults to `result`. */
  full?: ScanResult;
  /** When false, omit the triage section. Default true. */
  triageHints?: boolean;
}

function formatScore(value: number): string {
  return value.toFixed(SCORE_DECIMALS);
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

function renderHotspotsSection(result: ScanResult): string[] {
  const lines = ["## Top Hotspots", ""];

  if (result.hotspots.length === 0) {
    lines.push("_No results._");
    return lines;
  }

  lines.push(
    "| Rank | File | Score | NLOC | NLOCN | Churn | ChurnN | Authors | Lines |",
    "| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  );

  for (const [index, hotspot] of result.hotspots.entries()) {
    lines.push(
      `| ${index + 1} | ${escapeCell(hotspot.filePath)} | ${formatScore(hotspot.hotspotScore)} | ${hotspot.ncloc} | ${formatScore(hotspot.complexityNormalized)} | ${hotspot.commitCount} | ${formatScore(hotspot.churnNormalized)} | ${hotspot.authorCount} | ${hotspot.linesChanged} |`,
    );
  }

  return lines;
}

export function renderMarkdown(
  result: ScanResult,
  options?: MarkdownRenderOptions,
): string {
  const full = options?.full ?? result;
  const triageEnabled = options?.triageHints !== false;

  const sections: string[] = [
    "# Hotspot Scanner Report",
    "",
    ...buildScanExecutiveSummary(full, result),
    "",
    ...renderMarkdownHowToRead(),
    "",
    ...renderHotspotsSection(result),
    "",
  ];

  if (triageEnabled) {
    const triageLines = renderMarkdownTriageHints(buildTriageHints(result));
    if (triageLines.length > 0) {
      sections.push(...triageLines, "");
    }
  }

  while (sections.length > 0 && sections[sections.length - 1] === "") {
    sections.pop();
  }

  return sections.join("\n");
}
