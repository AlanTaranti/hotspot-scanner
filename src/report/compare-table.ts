import type {
  CompareResult,
  HotspotScore,
  RankChange,
} from "../types/index.js";
import { paintScore } from "./color.js";
import { buildCompareTriageHints } from "./compare-triage.js";
import { renderTableGlossary } from "./glossary.js";
import {
  formatFileColumn,
  formatFileColumnDashes,
  formatFileColumnHeader,
  resolveFileColumnWidth,
} from "./path-column.js";
import type { ReportSection } from "./only.js";
import { buildCompareExecutiveSummary } from "./summary.js";
import { renderTableTriageHints } from "./triage.js";

export interface CompareRenderOptions {
  only?: readonly ReportSection[];
  color?: boolean;
  /** When false, omits triage section. Defaults to true. */
  triageHints?: boolean;
  /** Full compare result before slice; defaults to displayed for summary totals. */
  full?: CompareResult;
  /** Injectable stdout column count for File width; omit → process.stdout.columns. */
  stdoutColumns?: number;
}

const SCORE_DECIMALS = 4;

function padVisible(value: string, width: number, align: "start" | "end"): string {
  if (value.length >= width) {
    return value.slice(0, width);
  }
  return align === "start" ? value.padStart(width) : value.padEnd(width);
}

function formatPlainScoreCell(value: number, width: number): string {
  return padVisible(value.toFixed(SCORE_DECIMALS), width, "start");
}

function formatScoreCell(
  value: number,
  width: number,
  colorEnabled: boolean,
): string {
  const plain = value.toFixed(SCORE_DECIMALS);
  if (!colorEnabled) {
    return padVisible(plain, width, "start");
  }
  const colored = paintScore(value, true);
  const padLen = Math.max(0, width - plain.length);
  return `${" ".repeat(padLen)}${colored}`;
}

function padStart(value: string, width: number): string {
  return value.length >= width ? value.slice(0, width) : value.padStart(width);
}

function renderHotspotRows(
  items: HotspotScore[],
  includeRank: boolean,
  colorEnabled: boolean,
  fileWidth: number,
): string[] {
  if (items.length === 0) {
    return ["  (none)"];
  }

  return items.map((hotspot, index) =>
    [
      includeRank ? padStart(String(index + 1), 4) : padStart("", 4),
      formatFileColumn(hotspot.filePath, fileWidth),
      formatScoreCell(hotspot.hotspotScore, 8, colorEnabled),
      padStart(String(hotspot.ncloc), 4),
      formatPlainScoreCell(hotspot.complexityNormalized, 8),
      padStart(String(hotspot.commitCount), 5),
      formatPlainScoreCell(hotspot.churnNormalized, 6),
      padStart(String(hotspot.authorCount), 7),
    ].join("  "),
  );
}

function renderRankChangedHotspotRows(
  items: RankChange<HotspotScore>[],
  colorEnabled: boolean,
  fileWidth: number,
): string[] {
  if (items.length === 0) {
    return ["  (none)"];
  }

  return items.map((change) =>
    [
      padStart(String(change.baselineRank), 8),
      padStart(String(change.currentRank), 8),
      padStart(String(change.rankDelta), 5),
      formatPlainScoreCell(change.scoreDelta, 8),
      padStart(String(change.nclocDelta), 5),
      padStart(String(change.commitCountDelta), 7),
      formatFileColumn(change.entity.filePath, fileWidth),
      formatScoreCell(change.entity.hotspotScore, 8, colorEnabled),
      padStart(String(change.entity.ncloc), 4),
      formatPlainScoreCell(change.entity.complexityNormalized, 8),
      padStart(String(change.entity.commitCount), 5),
      formatPlainScoreCell(change.entity.churnNormalized, 6),
      padStart(String(change.entity.authorCount), 7),
    ].join("  "),
  );
}

function renderHotspotSections(
  result: CompareResult,
  colorEnabled: boolean,
  fileWidth: number,
): string[] {
  const fileHeader = formatFileColumnHeader(fileWidth);
  const header = `Rank  ${fileHeader}  Score     NLOC  NLOCN     Churn  ChurnN  Authors`;
  const rankChangedHeader = `Baseline  Current  Delta  ScoreΔ    NLOCΔ  CommitsΔ  ${fileHeader}  Score     NLOC  NLOCN     Churn  ChurnN  Authors`;

  return [
    "=== New Hotspots ===",
    header,
    ...renderHotspotRows(result.hotspots.new, true, colorEnabled, fileWidth),
    "",
    "=== Removed Hotspots ===",
    header,
    ...renderHotspotRows(result.hotspots.removed, false, colorEnabled, fileWidth),
    "",
    "=== Rank Changed Hotspots ===",
    rankChangedHeader,
    ...renderRankChangedHotspotRows(
      result.hotspots.rankChanged,
      colorEnabled,
      fileWidth,
    ),
  ];
}

export function renderCompareTable(
  result: CompareResult,
  options?: CompareRenderOptions,
): string {
  const full = options?.full ?? result;
  const colorEnabled = options?.color === true;
  const fileWidth = resolveFileColumnWidth(options?.stdoutColumns);

  const lines = [
    "Scan Compare Report",
    ...buildCompareExecutiveSummary(full, result),
  ];

  lines.push("", ...renderHotspotSections(result, colorEnabled, fileWidth), "");

  if (options?.triageHints !== false) {
    const triageLines = renderTableTriageHints(buildCompareTriageHints(result));
    if (triageLines.length > 0) {
      lines.push(...triageLines, "");
    }
  }

  lines.push(...renderTableGlossary(), "");
  return lines.join("\n");
}
