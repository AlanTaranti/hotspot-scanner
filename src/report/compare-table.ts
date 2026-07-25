import type {
  CompareResult,
  CouplingPair,
  FunctionHotspotScore,
  HotspotScore,
  RankChange,
  ScanGranularity,
} from "../types/index.js";
import { paintScore, paintStaticDep } from "./color.js";
import {
  formatDirection,
  formatKinds,
  formatStaticDep,
} from "./coupling-format.js";
import { renderTableGlossary } from "./glossary.js";
import {
  ALL_REPORT_SECTIONS,
  includesSection,
  normalizeOnly,
  type ReportSection,
} from "./only.js";
import { buildCompareExecutiveSummary } from "./summary.js";
import { formatScanWarning } from "./warning-format.js";

export interface CompareRenderOptions {
  only?: readonly ReportSection[];
  color?: boolean;
  /** Full compare result before slice; defaults to displayed for summary totals. */
  full?: CompareResult;
}

export type CompareSectionVisibility = {
  hotspots: boolean;
  functions: boolean;
  coupling: boolean;
};

function isUnfiltered(onlySet: ReadonlySet<ReportSection>): boolean {
  return onlySet.size === ALL_REPORT_SECTIONS.length;
}

/** Section visibility for table/markdown/CSV (granularity-aware when unfiltered). */
export function resolveCompareRenderSections(
  onlySet: ReadonlySet<ReportSection>,
  granularity: ScanGranularity,
): CompareSectionVisibility {
  if (isUnfiltered(onlySet)) {
    return {
      hotspots: granularity === "file",
      functions: granularity === "function",
      coupling: true,
    };
  }

  return {
    hotspots: includesSection(onlySet, "hotspots"),
    functions: includesSection(onlySet, "functions"),
    coupling: includesSection(onlySet, "coupling"),
  };
}

/** Section visibility for JSON export (all keys when unfiltered). */
export function resolveCompareExportSections(
  onlySet: ReadonlySet<ReportSection>,
): CompareSectionVisibility {
  if (isUnfiltered(onlySet)) {
    return { hotspots: true, functions: true, coupling: true };
  }

  return {
    hotspots: includesSection(onlySet, "hotspots"),
    functions: includesSection(onlySet, "functions"),
    coupling: includesSection(onlySet, "coupling"),
  };
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

function formatStaticDepCell(
  hasStaticDependency: boolean,
  width: number,
  colorEnabled: boolean,
): string {
  const plain = formatStaticDep(hasStaticDependency);
  if (!colorEnabled) {
    return padVisible(plain, width, "start");
  }
  const colored = paintStaticDep(plain, true);
  const padLen = Math.max(0, width - plain.length);
  return `${" ".repeat(padLen)}${colored}`;
}

function padEnd(value: string, width: number): string {
  return value.length >= width ? value.slice(0, width) : value.padEnd(width);
}

function padStart(value: string, width: number): string {
  return value.length >= width ? value.slice(0, width) : value.padStart(width);
}

function renderHotspotRows(
  items: HotspotScore[],
  includeRank: boolean,
  colorEnabled: boolean,
): string[] {
  if (items.length === 0) {
    return ["  (none)"];
  }

  return items.map((hotspot, index) =>
    [
      includeRank ? padStart(String(index + 1), 4) : padStart("", 4),
      padEnd(hotspot.filePath, 24),
      formatScoreCell(hotspot.hotspotScore, 8, colorEnabled),
      padStart(String(hotspot.cyclomaticComplexity), 4),
      formatPlainScoreCell(hotspot.complexityNormalized, 8),
      padStart(String(hotspot.commitCount), 5),
      formatPlainScoreCell(hotspot.churnNormalized, 6),
      padStart(String(hotspot.functionCount), 5),
      padStart(String(hotspot.authorCount), 7),
    ].join("  "),
  );
}

function renderRankChangedHotspotRows(
  items: RankChange<HotspotScore>[],
  colorEnabled: boolean,
): string[] {
  if (items.length === 0) {
    return ["  (none)"];
  }

  return items.map((change) =>
    [
      padStart(String(change.baselineRank), 8),
      padStart(String(change.currentRank), 8),
      padStart(String(change.rankDelta), 5),
      padEnd(change.entity.filePath, 24),
      formatScoreCell(change.entity.hotspotScore, 8, colorEnabled),
      padStart(String(change.entity.cyclomaticComplexity), 4),
      formatPlainScoreCell(change.entity.complexityNormalized, 8),
      padStart(String(change.entity.commitCount), 5),
      formatPlainScoreCell(change.entity.churnNormalized, 6),
      padStart(String(change.entity.functionCount), 5),
      padStart(String(change.entity.authorCount), 7),
    ].join("  "),
  );
}

function renderFunctionRows(
  items: FunctionHotspotScore[],
  includeRank: boolean,
  colorEnabled: boolean,
): string[] {
  if (items.length === 0) {
    return ["  (none)"];
  }

  return items.map((fn, index) =>
    [
      includeRank ? padStart(String(index + 1), 4) : padStart("", 4),
      padEnd(fn.filePath, 24),
      padEnd(fn.functionName, 20),
      padStart(String(fn.line), 4),
      formatScoreCell(fn.hotspotScore, 8, colorEnabled),
      padStart(String(fn.complexity), 4),
      formatPlainScoreCell(fn.complexityNormalized, 8),
      padStart(String(fn.commitCount), 5),
      formatPlainScoreCell(fn.churnNormalized, 6),
      padStart(String(fn.authorCount), 7),
    ].join("  "),
  );
}

function renderRankChangedFunctionRows(
  items: RankChange<FunctionHotspotScore>[],
  colorEnabled: boolean,
): string[] {
  if (items.length === 0) {
    return ["  (none)"];
  }

  return items.map((change) =>
    [
      padStart(String(change.baselineRank), 8),
      padStart(String(change.currentRank), 8),
      padStart(String(change.rankDelta), 5),
      padEnd(change.entity.filePath, 24),
      padEnd(change.entity.functionName, 20),
      padStart(String(change.entity.line), 4),
      formatScoreCell(change.entity.hotspotScore, 8, colorEnabled),
      padStart(String(change.entity.complexity), 4),
      formatPlainScoreCell(change.entity.complexityNormalized, 8),
      padStart(String(change.entity.commitCount), 5),
      formatPlainScoreCell(change.entity.churnNormalized, 6),
      padStart(String(change.entity.authorCount), 7),
    ].join("  "),
  );
}

function renderCouplingRows(
  items: CouplingPair[],
  includeRank: boolean,
  colorEnabled: boolean,
): string[] {
  if (items.length === 0) {
    return ["  (none)"];
  }

  return items.map((pair, index) =>
    [
      includeRank ? padStart(String(index + 1), 4) : padStart("", 4),
      padEnd(pair.fileA, 24),
      padEnd(pair.fileB, 24),
      formatScoreCell(pair.couplingStrength, 8, colorEnabled),
      padStart(String(pair.coChangeCount), 10),
      formatStaticDepCell(pair.hasStaticDependency, 9, colorEnabled),
      padStart(formatDirection(pair.staticDependencyDirection), 9),
      padEnd(formatKinds(pair), 22),
    ].join("  "),
  );
}

function renderRankChangedCouplingRows(
  items: RankChange<CouplingPair>[],
  colorEnabled: boolean,
): string[] {
  if (items.length === 0) {
    return ["  (none)"];
  }

  return items.map((change) =>
    [
      padStart(String(change.baselineRank), 8),
      padStart(String(change.currentRank), 8),
      padStart(String(change.rankDelta), 5),
      padEnd(change.entity.fileA, 24),
      padEnd(change.entity.fileB, 24),
      formatScoreCell(change.entity.couplingStrength, 8, colorEnabled),
      padStart(String(change.entity.coChangeCount), 10),
      formatStaticDepCell(change.entity.hasStaticDependency, 9, colorEnabled),
      padStart(
        formatDirection(change.entity.staticDependencyDirection),
        9,
      ),
      padEnd(formatKinds(change.entity), 22),
    ].join("  "),
  );
}

function renderHotspotSections(
  result: CompareResult,
  colorEnabled: boolean,
): string[] {
  const header =
    "Rank  File                      Score     Cpx   CpxN      Churn  ChurnN  Funcs  Authors";
  const rankChangedHeader =
    "Baseline  Current  Delta  File                      Score     Cpx   CpxN      Churn  ChurnN  Funcs  Authors";

  return [
    "=== New Hotspots ===",
    header,
    ...renderHotspotRows(result.hotspots.new, true, colorEnabled),
    "",
    "=== Removed Hotspots ===",
    header,
    ...renderHotspotRows(result.hotspots.removed, false, colorEnabled),
    "",
    "=== Rank Changed Hotspots ===",
    rankChangedHeader,
    ...renderRankChangedHotspotRows(result.hotspots.rankChanged, colorEnabled),
  ];
}

function renderFunctionSections(
  result: CompareResult,
  colorEnabled: boolean,
): string[] {
  const header =
    "Rank  File                      Function              Line  Score     Cpx   CpxN      Churn  ChurnN  Authors";
  const rankChangedHeader =
    "Baseline  Current  Delta  File                      Function              Line  Score     Cpx   CpxN      Churn  ChurnN  Authors";

  return [
    "=== New Functions ===",
    header,
    ...renderFunctionRows(result.functions.new, true, colorEnabled),
    "",
    "=== Removed Functions ===",
    header,
    ...renderFunctionRows(result.functions.removed, false, colorEnabled),
    "",
    "=== Rank Changed Functions ===",
    rankChangedHeader,
    ...renderRankChangedFunctionRows(result.functions.rankChanged, colorEnabled),
  ];
}

function renderCouplingSections(
  result: CompareResult,
  colorEnabled: boolean,
): string[] {
  const header =
    "Rank  File A                    File B                    Strength  Co-changes  StaticDep  Direction  Kinds";
  const rankChangedHeader =
    "Baseline  Current  Delta  File A                    File B                    Strength  Co-changes  StaticDep  Direction  Kinds";

  return [
    "=== New Coupling Pairs ===",
    header,
    ...renderCouplingRows(result.coupling.new, true, colorEnabled),
    "",
    "=== Removed Coupling Pairs ===",
    header,
    ...renderCouplingRows(result.coupling.removed, false, colorEnabled),
    "",
    "=== Rank Changed Coupling Pairs ===",
    rankChangedHeader,
    ...renderRankChangedCouplingRows(result.coupling.rankChanged, colorEnabled),
  ];
}

export function renderCompareTable(
  result: CompareResult,
  options?: CompareRenderOptions,
): string {
  const onlySet = normalizeOnly(options?.only);
  const sections = resolveCompareRenderSections(onlySet, result.granularity);
  const full = options?.full ?? result;
  const colorEnabled = options?.color === true;

  const lines = [
    "Scan Compare Report",
    ...buildCompareExecutiveSummary(full, result),
  ];

  for (const warning of result.meta.warnings) {
    lines.push(formatScanWarning(warning));
  }

  lines.push("");

  if (sections.hotspots) {
    lines.push(...renderHotspotSections(result, colorEnabled), "");
  }

  if (sections.functions) {
    lines.push(...renderFunctionSections(result, colorEnabled), "");
  }

  if (sections.coupling) {
    lines.push(...renderCouplingSections(result, colorEnabled), "");
  }

  lines.push(...renderTableGlossary(), "");
  return lines.join("\n");
}
