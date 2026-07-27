import type {
  CompareResult,
  HotspotScore,
  RankChange,
} from "../types/index.js";
import type { CompareRenderOptions } from "./compare-table.js";
import type { CsvBundle } from "./csv-bundle.js";
import { formatCsvRow } from "./csv-utils.js";

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
    String(hotspot.ncloc),
    formatScore(hotspot.complexityNormalized),
    String(hotspot.commitCount),
    formatScore(hotspot.churnNormalized),
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
    formatScore(change.scoreDelta),
    String(change.nclocDelta),
    String(change.commitCountDelta),
    change.entity.filePath,
    formatScore(change.entity.hotspotScore),
    String(change.entity.ncloc),
    formatScore(change.entity.complexityNormalized),
    String(change.entity.commitCount),
    formatScore(change.entity.churnNormalized),
    String(change.entity.authorCount),
  ]);
}

const HOTSPOT_HEADER = [
  "rank",
  "file",
  "score",
  "ncloc",
  "nclocN",
  "churn",
  "churnN",
  "authors",
];

const RANK_CHANGED_HOTSPOT_HEADER = [
  "baselineRank",
  "currentRank",
  "rankDelta",
  "scoreDelta",
  "nclocDelta",
  "commitCountDelta",
  "file",
  "score",
  "ncloc",
  "nclocN",
  "churn",
  "churnN",
  "authors",
];

export function renderCompareCsv(
  result: CompareResult,
  _options?: CompareRenderOptions,
): CsvBundle {
  const bundle: Record<string, string> = {
    "meta.json": renderCompareMeta(result),
    "hotspots.new.csv": renderCsvFile(
      HOTSPOT_HEADER,
      renderHotspotRows(result.hotspots.new, true),
    ),
    "hotspots.removed.csv": renderCsvFile(
      HOTSPOT_HEADER,
      renderHotspotRows(result.hotspots.removed, false),
    ),
    "hotspots.rank-changed.csv": renderCsvFile(
      RANK_CHANGED_HOTSPOT_HEADER,
      renderRankChangedHotspotRows(result.hotspots.rankChanged),
    ),
  };

  return bundle;
}
