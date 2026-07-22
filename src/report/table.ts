import type { ScanResult } from "../types/index.js";

const SCORE_DECIMALS = 4;

function formatScore(value: number): string {
  return value.toFixed(SCORE_DECIMALS);
}

function padEnd(value: string, width: number): string {
  return value.length >= width ? value.slice(0, width) : value.padEnd(width);
}

function padStart(value: string, width: number): string {
  return value.length >= width ? value.slice(0, width) : value.padStart(width);
}

function renderHotspotsSection(result: ScanResult): string[] {
  const lines = [
    "Top Hotspots",
    "Rank  File                      Score     Complexity  Churn",
    "----  ------------------------  --------  ----------  ----------",
  ];

  if (result.hotspots.length === 0) {
    lines.push("  (none)");
    return lines;
  }

  for (const [index, hotspot] of result.hotspots.entries()) {
    lines.push(
      [
        padStart(String(index + 1), 4),
        padEnd(hotspot.filePath, 24),
        padStart(formatScore(hotspot.hotspotScore), 8),
        padStart(formatScore(hotspot.complexityNormalized), 10),
        padStart(formatScore(hotspot.churnNormalized), 10),
      ].join("  "),
    );
  }

  return lines;
}

function renderCouplingSection(result: ScanResult): string[] {
  const lines = [
    "Top Coupling Pairs",
    "Rank  File A                    File B                    Strength  Co-changes",
    "----  ------------------------  ------------------------  --------  ----------",
  ];

  if (result.coupling.length === 0) {
    lines.push("  (none)");
    return lines;
  }

  for (const [index, pair] of result.coupling.entries()) {
    lines.push(
      [
        padStart(String(index + 1), 4),
        padEnd(pair.fileA, 24),
        padEnd(pair.fileB, 24),
        padStart(formatScore(pair.couplingStrength), 8),
        padStart(String(pair.coChangeCount), 10),
      ].join("  "),
    );
  }

  return lines;
}

export function renderTable(result: ScanResult): string {
  const header = `Scan window: ${result.meta.since} (scanned ${result.meta.scannedAt})`;
  const sections = [
    header,
    "",
    ...renderHotspotsSection(result),
    "",
    ...renderCouplingSection(result),
    "",
  ];
  return `${sections.join("\n")}`;
}
