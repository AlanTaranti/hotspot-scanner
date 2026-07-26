import type { ScanResult } from "../types/index.js";
import { renderMarkdownHowToRead } from "./glossary.js";
import {
  includesSection,
  normalizeOnly,
  type ReportSection,
} from "./only.js";
import { buildScanExecutiveSummary } from "./summary.js";
import {
  buildTriageHints,
  renderMarkdownTriageHints,
} from "./triage.js";

const SCORE_DECIMALS = 4;

export interface MarkdownRenderOptions {
  /** Full pre-slice result for executive summary totals. Defaults to `result`. */
  full?: ScanResult;
  only?: readonly ReportSection[];
  /** When false, omit the triage section. Default true. */
  triageHints?: boolean;
}

function formatScore(value: number): string {
  return value.toFixed(SCORE_DECIMALS);
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

function isDefaultOnly(only?: readonly ReportSection[]): boolean {
  return only === undefined || only.length === 0;
}

function shouldIncludeRankingSection(
  section: "hotspots" | "functions",
  result: ScanResult,
  onlySet: ReadonlySet<ReportSection>,
  defaultOnly: boolean,
): boolean {
  if (!includesSection(onlySet, section)) {
    return false;
  }
  if (!defaultOnly) {
    return true;
  }
  const primary: ReportSection =
    result.meta.granularity === "function" ? "functions" : "hotspots";
  return section === primary;
}

function renderHotspotsSection(result: ScanResult): string[] {
  const lines = ["## Top Hotspots", ""];

  if (result.hotspots.length === 0) {
    lines.push("_No results._");
    return lines;
  }

  lines.push(
    "| Rank | File | Score | Cpx | CpxN | Churn | ChurnN | Funcs | Authors | Lines | ParseFail |",
    "| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :---: |",
  );

  for (const [index, hotspot] of result.hotspots.entries()) {
    lines.push(
      `| ${index + 1} | ${escapeCell(hotspot.filePath)} | ${formatScore(hotspot.hotspotScore)} | ${hotspot.cyclomaticComplexity} | ${formatScore(hotspot.complexityNormalized)} | ${hotspot.commitCount} | ${formatScore(hotspot.churnNormalized)} | ${hotspot.functionCount} | ${hotspot.authorCount} | ${hotspot.linesChanged} | ${hotspot.parseFailed ? "yes" : "no"} |`,
    );
  }

  return lines;
}

function renderFunctionsSection(result: ScanResult): string[] {
  const lines = ["## Top Functions", ""];

  if (result.functions.length === 0) {
    lines.push("_No results._");
    return lines;
  }

  lines.push(
    "| Rank | File | Function | Line | Score | Cpx | CpxN | Churn | ChurnN | Authors | Lines |",
    "| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  );

  for (const [index, fn] of result.functions.entries()) {
    lines.push(
      `| ${index + 1} | ${escapeCell(fn.filePath)} | ${escapeCell(fn.functionName)} | ${fn.line} | ${formatScore(fn.hotspotScore)} | ${fn.complexity} | ${formatScore(fn.complexityNormalized)} | ${fn.commitCount} | ${formatScore(fn.churnNormalized)} | ${fn.authorCount} | ${fn.linesChanged} |`,
    );
  }

  return lines;
}

function renderRankingSections(
  result: ScanResult,
  onlySet: ReadonlySet<ReportSection>,
  defaultOnly: boolean,
): string[] {
  const lines: string[] = [];

  if (shouldIncludeRankingSection("hotspots", result, onlySet, defaultOnly)) {
    lines.push(...renderHotspotsSection(result), "");
  }
  if (shouldIncludeRankingSection("functions", result, onlySet, defaultOnly)) {
    lines.push(...renderFunctionsSection(result), "");
  }

  return lines;
}

export function renderMarkdown(
  result: ScanResult,
  options?: MarkdownRenderOptions,
): string {
  const full = options?.full ?? result;
  const onlySet = normalizeOnly(options?.only);
  const defaultOnly = isDefaultOnly(options?.only);
  const triageEnabled = options?.triageHints !== false;

  const sections: string[] = [
    "# Hotspot Scanner Report",
    "",
    ...buildScanExecutiveSummary(full, result),
    "",
    ...renderMarkdownHowToRead(),
    "",
    ...renderRankingSections(result, onlySet, defaultOnly),
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
