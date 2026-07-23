import type { ScanResult } from "../types/index.js";
import { formatCsvRow } from "./csv-utils.js";

const SCORE_DECIMALS = 4;

function formatScore(value: number): string {
  return value.toFixed(SCORE_DECIMALS);
}

function renderSection(
  title: string,
  header: string[],
  rows: string[][],
): string[] {
  const lines = [formatCsvRow([title]), formatCsvRow(header)];
  for (const row of rows) {
    lines.push(formatCsvRow(row));
  }
  return lines;
}

function renderMetadataSection(result: ScanResult): string[] {
  const rows: string[][] = [
    ["scan_window", result.meta.since],
    ["scanned_at", result.meta.scannedAt],
  ];

  if (result.meta.granularity === "function") {
    rows.push(["granularity", "function"]);
  }

  return renderSection("Metadata", ["key", "value"], rows);
}

function renderHotspotsSection(result: ScanResult): string[] {
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

  return renderSection("Top Hotspots", header, rows);
}

function renderFunctionsSection(result: ScanResult): string[] {
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

  return renderSection("Top Functions", header, rows);
}

function renderCouplingSection(result: ScanResult): string[] {
  const header = ["rank", "fileA", "fileB", "strength", "coChanges"];
  const rows = result.coupling.map((pair, index) => [
    String(index + 1),
    pair.fileA,
    pair.fileB,
    formatScore(pair.couplingStrength),
    String(pair.coChangeCount),
  ]);

  return renderSection("Top Coupling Pairs", header, rows);
}

export function renderCsv(result: ScanResult): string {
  const sections = [renderMetadataSection(result)];

  if (result.meta.granularity === "function") {
    sections.push(renderFunctionsSection(result));
  } else {
    sections.push(renderHotspotsSection(result));
  }

  sections.push(renderCouplingSection(result));

  return sections.map((section) => section.join("\n")).join("\n\n");
}
