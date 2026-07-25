import type { ScanResult } from "../types/index.js";
import {
  COUPLING_ENRICHMENT_CSV_COLUMNS,
  couplingEnrichmentCsvValues,
} from "./coupling-format.js";
import type { CsvBundle } from "./csv-bundle.js";
import { formatCsvRow } from "./csv-utils.js";
import { includesSection, normalizeOnly, type ReportSection } from "./only.js";

const SCORE_DECIMALS = 4;

export interface RenderCsvOptions {
  only?: readonly ReportSection[];
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
    granularity:
      result.meta.granularity === "function"
        ? ("function" as const)
        : ("file" as const),
  };
  return `${JSON.stringify(meta, null, 2)}\n`;
}

function renderHotspotsCsv(result: ScanResult): string {
  const header = [
    "rank",
    "file",
    "score",
    "cpx",
    "cpxN",
    "churn",
    "churnN",
    "funcs",
    "authors",
    "lines",
  ];
  const rows = result.hotspots.map((hotspot, index) => [
    String(index + 1),
    hotspot.filePath,
    formatScore(hotspot.hotspotScore),
    String(hotspot.cyclomaticComplexity),
    formatScore(hotspot.complexityNormalized),
    String(hotspot.commitCount),
    formatScore(hotspot.churnNormalized),
    String(hotspot.functionCount),
    String(hotspot.authorCount),
    String(hotspot.linesChanged),
  ]);

  return renderCsvFile(header, rows);
}

function renderFunctionsCsv(result: ScanResult): string {
  const header = [
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
    "lines",
  ];
  const rows = result.functions.map((fn, index) => [
    String(index + 1),
    fn.filePath,
    fn.functionName,
    String(fn.line),
    formatScore(fn.hotspotScore),
    String(fn.complexity),
    formatScore(fn.complexityNormalized),
    String(fn.commitCount),
    formatScore(fn.churnNormalized),
    String(fn.authorCount),
    String(fn.linesChanged),
  ]);

  return renderCsvFile(header, rows);
}

function renderCouplingCsv(result: ScanResult): string {
  const header = [
    "rank",
    "fileA",
    "fileB",
    "strength",
    "coChanges",
    "hasStaticDependency",
    ...COUPLING_ENRICHMENT_CSV_COLUMNS,
  ];
  const rows = result.coupling.map((pair, index) => [
    String(index + 1),
    pair.fileA,
    pair.fileB,
    formatScore(pair.couplingStrength),
    String(pair.coChangeCount),
    String(pair.hasStaticDependency),
    ...couplingEnrichmentCsvValues(pair),
  ]);

  return renderCsvFile(header, rows);
}

export function renderCsv(
  result: ScanResult,
  options?: RenderCsvOptions,
): CsvBundle {
  const onlySet = normalizeOnly(options?.only);
  const unfilteredOnly =
    options?.only === undefined || options.only.length === 0;

  const bundle: Record<string, string> = {
    "meta.json": renderScanMeta(result),
  };

  if (unfilteredOnly) {
    if (result.meta.granularity === "function") {
      bundle["functions.csv"] = renderFunctionsCsv(result);
    } else {
      bundle["hotspots.csv"] = renderHotspotsCsv(result);
    }
    bundle["coupling.csv"] = renderCouplingCsv(result);
    return bundle;
  }

  if (includesSection(onlySet, "hotspots")) {
    bundle["hotspots.csv"] = renderHotspotsCsv(result);
  }
  if (includesSection(onlySet, "functions")) {
    bundle["functions.csv"] = renderFunctionsCsv(result);
  }
  if (includesSection(onlySet, "coupling")) {
    bundle["coupling.csv"] = renderCouplingCsv(result);
  }

  return bundle;
}
