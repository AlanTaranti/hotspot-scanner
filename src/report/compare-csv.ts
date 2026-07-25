import type {
  CompareResult,
  CouplingPair,
  FunctionHotspotScore,
  HotspotScore,
  RankChange,
} from "../types/index.js";
import {
  type CompareRenderOptions,
  resolveCompareRenderSections,
} from "./compare-table.js";
import {
  COUPLING_ENRICHMENT_CSV_COLUMNS,
  couplingEnrichmentCsvValues,
} from "./coupling-format.js";
import type { CsvBundle } from "./csv-bundle.js";
import { formatCsvRow } from "./csv-utils.js";
import { normalizeOnly } from "./only.js";

const SCORE_DECIMALS = 4;

function formatScore(value: number): string {
  return value.toFixed(SCORE_DECIMALS);
}

function renderCsvFile(header: string[], rows: string[][]): string {
  const lines = [formatCsvRow(header)];
  for (const row of rows) {
    lines.push(formatCsvRow(row));
  }
  return lines.join("\n");
}

function renderCompareMeta(result: CompareResult): string {
  const meta = {
    kind: "compare" as const,
    granularity: result.granularity,
    baseline_scanned_at: result.meta.baseline.scannedAt,
    baseline_since: result.meta.baseline.since,
    current_scanned_at: result.meta.current.scannedAt,
    current_since: result.meta.current.since,
    warnings: result.meta.warnings,
  };
  return `${JSON.stringify(meta, null, 2)}\n`;
}

function renderHotspotRows(
  items: HotspotScore[],
  includeRank: boolean,
): string[][] {
  return items.map((hotspot, index) => [
    includeRank ? String(index + 1) : "",
    hotspot.filePath,
    formatScore(hotspot.hotspotScore),
    String(hotspot.cyclomaticComplexity),
    formatScore(hotspot.complexityNormalized),
    String(hotspot.commitCount),
    formatScore(hotspot.churnNormalized),
    String(hotspot.functionCount),
    String(hotspot.authorCount),
  ]);
}

function renderRankChangedHotspotRows(
  items: RankChange<HotspotScore>[],
): string[][] {
  return items.map((change) => [
    String(change.baselineRank),
    String(change.currentRank),
    String(change.rankDelta),
    change.entity.filePath,
    formatScore(change.entity.hotspotScore),
    String(change.entity.cyclomaticComplexity),
    formatScore(change.entity.complexityNormalized),
    String(change.entity.commitCount),
    formatScore(change.entity.churnNormalized),
    String(change.entity.functionCount),
    String(change.entity.authorCount),
  ]);
}

function renderFunctionRows(
  items: FunctionHotspotScore[],
  includeRank: boolean,
): string[][] {
  return items.map((fn, index) => [
    includeRank ? String(index + 1) : "",
    fn.filePath,
    fn.functionName,
    String(fn.line),
    formatScore(fn.hotspotScore),
    String(fn.complexity),
    formatScore(fn.complexityNormalized),
    String(fn.commitCount),
    formatScore(fn.churnNormalized),
    String(fn.authorCount),
  ]);
}

function renderRankChangedFunctionRows(
  items: RankChange<FunctionHotspotScore>[],
): string[][] {
  return items.map((change) => [
    String(change.baselineRank),
    String(change.currentRank),
    String(change.rankDelta),
    change.entity.filePath,
    change.entity.functionName,
    String(change.entity.line),
    formatScore(change.entity.hotspotScore),
    String(change.entity.complexity),
    formatScore(change.entity.complexityNormalized),
    String(change.entity.commitCount),
    formatScore(change.entity.churnNormalized),
    String(change.entity.authorCount),
  ]);
}

function renderCouplingRows(
  items: CouplingPair[],
  includeRank: boolean,
): string[][] {
  return items.map((pair, index) => [
    includeRank ? String(index + 1) : "",
    pair.fileA,
    pair.fileB,
    formatScore(pair.couplingStrength),
    String(pair.coChangeCount),
    String(pair.hasStaticDependency),
    ...couplingEnrichmentCsvValues(pair),
  ]);
}

function renderRankChangedCouplingRows(
  items: RankChange<CouplingPair>[],
): string[][] {
  return items.map((change) => [
    String(change.baselineRank),
    String(change.currentRank),
    String(change.rankDelta),
    change.entity.fileA,
    change.entity.fileB,
    formatScore(change.entity.couplingStrength),
    String(change.entity.coChangeCount),
    String(change.entity.hasStaticDependency),
    ...couplingEnrichmentCsvValues(change.entity),
  ]);
}

const HOTSPOT_HEADER = [
  "rank",
  "file",
  "score",
  "cpx",
  "cpxN",
  "churn",
  "churnN",
  "funcs",
  "authors",
];

const RANK_CHANGED_HOTSPOT_HEADER = [
  "baselineRank",
  "currentRank",
  "rankDelta",
  "file",
  "score",
  "cpx",
  "cpxN",
  "churn",
  "churnN",
  "funcs",
  "authors",
];

const FUNCTION_HEADER = [
  "rank",
  "file",
  "function",
  "line",
  "score",
  "cpx",
  "cpxN",
  "churn",
  "churnN",
  "authors",
];

const RANK_CHANGED_FUNCTION_HEADER = [
  "baselineRank",
  "currentRank",
  "rankDelta",
  "file",
  "function",
  "line",
  "score",
  "cpx",
  "cpxN",
  "churn",
  "churnN",
  "authors",
];

const COUPLING_HEADER = [
  "rank",
  "fileA",
  "fileB",
  "strength",
  "coChanges",
  "hasStaticDependency",
  ...COUPLING_ENRICHMENT_CSV_COLUMNS,
];

const RANK_CHANGED_COUPLING_HEADER = [
  "baselineRank",
  "currentRank",
  "rankDelta",
  "fileA",
  "fileB",
  "strength",
  "coChanges",
  "hasStaticDependency",
  ...COUPLING_ENRICHMENT_CSV_COLUMNS,
];

export function renderCompareCsv(
  result: CompareResult,
  options?: CompareRenderOptions,
): CsvBundle {
  const onlySet = normalizeOnly(options?.only);
  const sections = resolveCompareRenderSections(onlySet, result.granularity);
  const bundle: Record<string, string> = {
    "meta.json": renderCompareMeta(result),
  };

  if (sections.coupling) {
    bundle["coupling.new.csv"] = renderCsvFile(
      COUPLING_HEADER,
      renderCouplingRows(result.coupling.new, true),
    );
    bundle["coupling.removed.csv"] = renderCsvFile(
      COUPLING_HEADER,
      renderCouplingRows(result.coupling.removed, false),
    );
    bundle["coupling.rank-changed.csv"] = renderCsvFile(
      RANK_CHANGED_COUPLING_HEADER,
      renderRankChangedCouplingRows(result.coupling.rankChanged),
    );
  }

  if (sections.hotspots) {
    bundle["hotspots.new.csv"] = renderCsvFile(
      HOTSPOT_HEADER,
      renderHotspotRows(result.hotspots.new, true),
    );
    bundle["hotspots.removed.csv"] = renderCsvFile(
      HOTSPOT_HEADER,
      renderHotspotRows(result.hotspots.removed, false),
    );
    bundle["hotspots.rank-changed.csv"] = renderCsvFile(
      RANK_CHANGED_HOTSPOT_HEADER,
      renderRankChangedHotspotRows(result.hotspots.rankChanged),
    );
  }

  if (sections.functions) {
    bundle["functions.new.csv"] = renderCsvFile(
      FUNCTION_HEADER,
      renderFunctionRows(result.functions.new, true),
    );
    bundle["functions.removed.csv"] = renderCsvFile(
      FUNCTION_HEADER,
      renderFunctionRows(result.functions.removed, false),
    );
    bundle["functions.rank-changed.csv"] = renderCsvFile(
      RANK_CHANGED_FUNCTION_HEADER,
      renderRankChangedFunctionRows(result.functions.rankChanged),
    );
  }

  return bundle;
}
