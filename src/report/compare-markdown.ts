import type {
  CompareResult,
  HotspotScore,
  RankChange,
} from "../types/index.js";
import type { CompareRenderOptions } from "./compare-table.js";
import { buildCompareTriageHints } from "./compare-triage.js";
import { renderMarkdownHowToRead } from "./glossary.js";
import { buildCompareExecutiveSummary } from "./summary.js";
import { renderMarkdownTriageHints } from "./triage.js";

const SCORE_DECIMALS = 4;

function formatScore(value: number): string {
  return value.toFixed(SCORE_DECIMALS);
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

function renderHotspotTable(
  title: string,
  items: HotspotScore[],
  includeRank: boolean,
): string[] {
  const lines = [`## ${title}`, ""];

  if (items.length === 0) {
    lines.push("_No results._");
    return lines;
  }

  const rankHeader = includeRank ? "| Rank | " : "| ";
  lines.push(
    `${rankHeader}File | Score | NLOC | NLOCN | Churn | ChurnN | Authors |`,
    `${includeRank ? "| ---: | " : "| "}--- | ---: | ---: | ---: | ---: | ---: | ---: |`,
  );

  for (const [index, hotspot] of items.entries()) {
    const rankCell = includeRank ? `${index + 1} | ` : "";
    lines.push(
      `| ${rankCell}${escapeCell(hotspot.filePath)} | ${formatScore(hotspot.hotspotScore)} | ${hotspot.ncloc} | ${formatScore(hotspot.complexityNormalized)} | ${hotspot.commitCount} | ${formatScore(hotspot.churnNormalized)} | ${hotspot.authorCount} |`,
    );
  }

  return lines;
}

function renderRankChangedHotspotTable(
  title: string,
  items: RankChange<HotspotScore>[],
): string[] {
  const lines = [`## ${title}`, ""];

  if (items.length === 0) {
    lines.push("_No results._");
    return lines;
  }

  lines.push(
    "| Baseline Rank | Current Rank | Δ | ScoreΔ | NLOCΔ | CommitsΔ | File | Score | NLOC | NLOCN | Churn | ChurnN | Authors |",
    "| ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  );

  for (const change of items) {
    lines.push(
      `| ${change.baselineRank} | ${change.currentRank} | ${change.rankDelta} | ${formatScore(change.scoreDelta)} | ${change.nclocDelta} | ${change.commitCountDelta} | ${escapeCell(change.entity.filePath)} | ${formatScore(change.entity.hotspotScore)} | ${change.entity.ncloc} | ${formatScore(change.entity.complexityNormalized)} | ${change.entity.commitCount} | ${formatScore(change.entity.churnNormalized)} | ${change.entity.authorCount} |`,
    );
  }

  return lines;
}

function renderHotspotSections(result: CompareResult): string[] {
  return [
    ...renderHotspotTable("New Hotspots", result.hotspots.new, true),
    "",
    ...renderHotspotTable("Removed Hotspots", result.hotspots.removed, false),
    "",
    ...renderRankChangedHotspotTable(
      "Rank Changed Hotspots",
      result.hotspots.rankChanged,
    ),
  ];
}

export function renderCompareMarkdown(
  result: CompareResult,
  options?: CompareRenderOptions,
): string {
  const full = options?.full ?? result;

  const lines = [
    "# Hotspot Scanner — Compare Report",
    "",
    ...buildCompareExecutiveSummary(full, result),
    "",
    ...renderMarkdownHowToRead({ compare: true }),
    "",
  ];

  lines.push(...renderHotspotSections(result), "");

  if (options?.triageHints !== false) {
    const triageLines = renderMarkdownTriageHints(buildCompareTriageHints(result));
    if (triageLines.length > 0) {
      lines.push("", ...triageLines);
    }
  }

  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines.join("\n");
}
