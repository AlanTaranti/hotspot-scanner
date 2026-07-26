import type { ScanResult } from "../types/index.js";
import type { CsvBundle } from "./csv-bundle.js";
import { formatCsvRow } from "./csv-utils.js";

const SCORE_DECIMALS = 4;

export interface RenderCsvOptions {
  only?: readonly ("hotspots")[];
}

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

function renderScanMeta(result: ScanResult): string {
  const meta = {
    kind: "scan" as const,
    scan_window: result.meta.since,
    scanned_at: result.meta.scannedAt,
  };
  return `${JSON.stringify(meta, null, 2)}\n`;
}

function renderHotspotsCsv(result: ScanResult): string {
  const header = [
    "rank",
    "file",
    "score",
    "ncloc",
    "nclocN",
    "churn",
    "churnN",
    "authors",
    "lines",
  ];
  const rows = result.hotspots.map((hotspot, index) => [
    String(index + 1),
    hotspot.filePath,
    formatScore(hotspot.hotspotScore),
    String(hotspot.ncloc),
    formatScore(hotspot.complexityNormalized),
    String(hotspot.commitCount),
    formatScore(hotspot.churnNormalized),
    String(hotspot.authorCount),
    String(hotspot.linesChanged),
  ]);

  return renderCsvFile(header, rows);
}

export function renderCsv(
  result: ScanResult,
  _options?: RenderCsvOptions,
): CsvBundle {
  return {
    "meta.json": renderScanMeta(result),
    "hotspots.csv": renderHotspotsCsv(result),
  };
}
