import type {
  CompareResult,
  CouplingPair,
  FunctionHotspotScore,
  HotspotScore,
  RankChange,
} from "../types/index.js";
import {
  formatDirection,
  formatKinds,
  formatStaticDep,
} from "./coupling-format.js";
import {
  type CompareRenderOptions,
  resolveCompareRenderSections,
} from "./compare-table.js";
import { buildCompareTriageHints } from "./compare-triage.js";
import { renderMarkdownHowToRead } from "./glossary.js";
import { normalizeOnly } from "./only.js";
import { buildCompareExecutiveSummary } from "./summary.js";
import { renderMarkdownTriageHints } from "./triage.js";
import { formatScanWarning } from "./warning-format.js";

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
    `${rankHeader}File | Score | Cpx | CpxN | Churn | ChurnN | Funcs | Authors | ParseFail |`,
    `${includeRank ? "| ---: | " : "| "}--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :---: |`,
  );

  for (const [index, hotspot] of items.entries()) {
    const rankCell = includeRank ? `${index + 1} | ` : "";
    lines.push(
      `| ${rankCell}${escapeCell(hotspot.filePath)} | ${formatScore(hotspot.hotspotScore)} | ${hotspot.cyclomaticComplexity} | ${formatScore(hotspot.complexityNormalized)} | ${hotspot.commitCount} | ${formatScore(hotspot.churnNormalized)} | ${hotspot.functionCount} | ${hotspot.authorCount} | ${hotspot.parseFailed ? "yes" : "no"} |`,
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
    "| Baseline Rank | Current Rank | Δ | File | Score | Cpx | CpxN | Churn | ChurnN | Funcs | Authors | ParseFail |",
    "| ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :---: |",
  );

  for (const change of items) {
    lines.push(
      `| ${change.baselineRank} | ${change.currentRank} | ${change.rankDelta} | ${escapeCell(change.entity.filePath)} | ${formatScore(change.entity.hotspotScore)} | ${change.entity.cyclomaticComplexity} | ${formatScore(change.entity.complexityNormalized)} | ${change.entity.commitCount} | ${formatScore(change.entity.churnNormalized)} | ${change.entity.functionCount} | ${change.entity.authorCount} | ${change.entity.parseFailed ? "yes" : "no"} |`,
    );
  }

  return lines;
}

function renderFunctionTable(
  title: string,
  items: FunctionHotspotScore[],
  includeRank: boolean,
): string[] {
  const lines = [`## ${title}`, ""];

  if (items.length === 0) {
    lines.push("_No results._");
    return lines;
  }

  const rankHeader = includeRank ? "| Rank | " : "| ";
  lines.push(
    `${rankHeader}File | Function | Line | Score | Cpx | CpxN | Churn | ChurnN | Authors |`,
    `${includeRank ? "| ---: | " : "| "}--- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |`,
  );

  for (const [index, fn] of items.entries()) {
    const rankCell = includeRank ? `${index + 1} | ` : "";
    lines.push(
      `| ${rankCell}${escapeCell(fn.filePath)} | ${escapeCell(fn.functionName)} | ${fn.line} | ${formatScore(fn.hotspotScore)} | ${fn.complexity} | ${formatScore(fn.complexityNormalized)} | ${fn.commitCount} | ${formatScore(fn.churnNormalized)} | ${fn.authorCount} |`,
    );
  }

  return lines;
}

function renderRankChangedFunctionTable(
  title: string,
  items: RankChange<FunctionHotspotScore>[],
): string[] {
  const lines = [`## ${title}`, ""];

  if (items.length === 0) {
    lines.push("_No results._");
    return lines;
  }

  lines.push(
    "| Baseline Rank | Current Rank | Δ | File | Function | Line | Score | Cpx | CpxN | Churn | ChurnN | Authors |",
    "| ---: | ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  );

  for (const change of items) {
    lines.push(
      `| ${change.baselineRank} | ${change.currentRank} | ${change.rankDelta} | ${escapeCell(change.entity.filePath)} | ${escapeCell(change.entity.functionName)} | ${change.entity.line} | ${formatScore(change.entity.hotspotScore)} | ${change.entity.complexity} | ${formatScore(change.entity.complexityNormalized)} | ${change.entity.commitCount} | ${formatScore(change.entity.churnNormalized)} | ${change.entity.authorCount} |`,
    );
  }

  return lines;
}

function renderCouplingTable(
  title: string,
  items: CouplingPair[],
  includeRank: boolean,
): string[] {
  const lines = [`## ${title}`, ""];

  if (items.length === 0) {
    lines.push("_No results._");
    return lines;
  }

  const rankHeader = includeRank ? "| Rank | " : "| ";
  lines.push(
    `${rankHeader}File A | File B | Strength | Co-changes | Has static | Direction | Kinds |`,
    `${includeRank ? "| ---: | " : "| "}--- | --- | ---: | ---: | :---: | :---: | --- |`,
  );

  for (const [index, pair] of items.entries()) {
    const rankCell = includeRank ? `${index + 1} | ` : "";
    lines.push(
      `| ${rankCell}${escapeCell(pair.fileA)} | ${escapeCell(pair.fileB)} | ${formatScore(pair.couplingStrength)} | ${pair.coChangeCount} | ${formatStaticDep(pair.hasStaticDependency)} | ${formatDirection(pair.staticDependencyDirection)} | ${formatKinds(pair)} |`,
    );
  }

  return lines;
}

function renderRankChangedCouplingTable(
  title: string,
  items: RankChange<CouplingPair>[],
): string[] {
  const lines = [`## ${title}`, ""];

  if (items.length === 0) {
    lines.push("_No results._");
    return lines;
  }

  lines.push(
    "| Baseline Rank | Current Rank | Δ | File A | File B | Strength | Co-changes | Has static | Direction | Kinds |",
    "| ---: | ---: | ---: | --- | --- | ---: | ---: | :---: | :---: | --- |",
  );

  for (const change of items) {
    lines.push(
      `| ${change.baselineRank} | ${change.currentRank} | ${change.rankDelta} | ${escapeCell(change.entity.fileA)} | ${escapeCell(change.entity.fileB)} | ${formatScore(change.entity.couplingStrength)} | ${change.entity.coChangeCount} | ${formatStaticDep(change.entity.hasStaticDependency)} | ${formatDirection(change.entity.staticDependencyDirection)} | ${formatKinds(change.entity)} |`,
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

function renderFunctionSections(result: CompareResult): string[] {
  return [
    ...renderFunctionTable("New Functions", result.functions.new, true),
    "",
    ...renderFunctionTable("Removed Functions", result.functions.removed, false),
    "",
    ...renderRankChangedFunctionTable(
      "Rank Changed Functions",
      result.functions.rankChanged,
    ),
  ];
}

function renderCouplingSections(result: CompareResult): string[] {
  return [
    ...renderCouplingTable("New Coupling Pairs", result.coupling.new, true),
    "",
    ...renderCouplingTable(
      "Removed Coupling Pairs",
      result.coupling.removed,
      false,
    ),
    "",
    ...renderRankChangedCouplingTable(
      "Rank Changed Coupling Pairs",
      result.coupling.rankChanged,
    ),
  ];
}

export function renderCompareMarkdown(
  result: CompareResult,
  options?: CompareRenderOptions,
): string {
  const onlySet = normalizeOnly(options?.only);
  const sections = resolveCompareRenderSections(onlySet, result.granularity);
  const full = options?.full ?? result;

  const lines = [
    "# Hotspot Scanner — Compare Report",
    "",
    ...buildCompareExecutiveSummary(full, result),
    "",
    ...renderMarkdownHowToRead({ compare: true }),
    "",
  ];

  for (const warning of result.meta.warnings) {
    lines.push(`> ${formatScanWarning(warning)}`, "");
  }

  if (sections.hotspots) {
    lines.push(...renderHotspotSections(result), "");
  }

  if (sections.functions) {
    lines.push(...renderFunctionSections(result), "");
  }

  if (sections.coupling) {
    lines.push(...renderCouplingSections(result));
  }

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
