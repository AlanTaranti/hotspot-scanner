import type { ScanResult } from "../types/index.js";
import { paintScore, stripAnsi } from "./color.js";
import { renderTableGlossary } from "./glossary.js";
import {
  formatFileColumn,
  formatFileColumnDashes,
  formatFileColumnHeader,
  resolveFileColumnWidth,
} from "./path-column.js";
import { buildScanExecutiveSummary } from "./summary.js";
import { buildTriageHints, renderTableTriageHints } from "./triage.js";

export interface RenderTableOptions {
  /** Full pre-slice corpus for executive summary totals. Defaults to `result`. */
  fullResult?: ScanResult;
  /** When false, omits triage section. Defaults to true. */
  triageHints?: boolean;
  /** When true, applies ANSI color to score/strength/StaticDep cells. */
  color?: boolean;
  /** Injectable stdout column count for File width; omit → process.stdout.columns. */
  stdoutColumns?: number;
}

function formatScore(value: number, color: boolean): string {
  return paintScore(value, color);
}

const SCORE_DECIMALS = 4;

function formatPlainScore(value: number): string {
  return value.toFixed(SCORE_DECIMALS);
}

function padStart(value: string, width: number): string {
  const visible = stripAnsi(value);
  if (visible.length >= width) {
    return visible.slice(0, width);
  }
  return " ".repeat(width - visible.length) + value;
}

function renderHotspotsSection(
  result: ScanResult,
  color: boolean,
  fileWidth: number,
): string[] {
  const fileHeader = formatFileColumnHeader(fileWidth);
  const fileDashes = formatFileColumnDashes(fileWidth);
  const lines = [
    "Top Hotspots",
    `Rank  ${fileHeader}  Score     NLOC  NLOCN     Churn  ChurnN  Authors`,
    `----  ${fileDashes}  --------  ----  --------  -----  ------  -------`,
  ];

  if (result.hotspots.length === 0) {
    lines.push("  (none)");
    return lines;
  }

  for (const [index, hotspot] of result.hotspots.entries()) {
    lines.push(
      [
        padStart(String(index + 1), 4),
        formatFileColumn(hotspot.filePath, fileWidth),
        padStart(formatScore(hotspot.hotspotScore, color), 8),
        padStart(String(hotspot.ncloc), 4),
        padStart(formatPlainScore(hotspot.complexityNormalized), 8),
        padStart(String(hotspot.commitCount), 5),
        padStart(formatPlainScore(hotspot.churnNormalized), 6),
        padStart(String(hotspot.authorCount), 7),
      ].join("  "),
    );
  }

  return lines;
}

export function renderTable(
  result: ScanResult,
  options?: RenderTableOptions,
): string {
  const full = options?.fullResult ?? result;
  const color = options?.color ?? false;
  const fileWidth = resolveFileColumnWidth(options?.stdoutColumns);
  const summary = buildScanExecutiveSummary(full, result);
  const sections: string[] = [...summary];

  const rankingBlocks = renderHotspotsSection(result, color, fileWidth);
  if (rankingBlocks.length > 0) {
    sections.push("", ...rankingBlocks);
  }

  if (options?.triageHints !== false) {
    const triageLines = renderTableTriageHints(buildTriageHints(result));
    if (triageLines.length > 0) {
      sections.push("", ...triageLines);
    }
  }

  sections.push("", ...renderTableGlossary());

  return sections.join("\n");
}
