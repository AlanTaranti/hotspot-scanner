import type { ScanResult } from "../types/index.js";

const SCORE_DECIMALS = 4;

function formatScore(value: number): string {
  return value.toFixed(SCORE_DECIMALS);
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

function renderHotspotsSection(result: ScanResult): string[] {
  const lines = ["## Top Hotspots", ""];

  if (result.hotspots.length === 0) {
    lines.push("_No results._");
    return lines;
  }

  lines.push(
    "| Rank | File | Score | Cpx | CpxN | Churn | ChurnN | Funcs | Authors | Lines |",
    "| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  );

  for (const [index, hotspot] of result.hotspots.entries()) {
    lines.push(
      `| ${index + 1} | ${escapeCell(hotspot.filePath)} | ${formatScore(hotspot.hotspotScore)} | ${hotspot.cyclomaticComplexity} | ${formatScore(hotspot.complexityNormalized)} | ${hotspot.commitCount} | ${formatScore(hotspot.churnNormalized)} | ${hotspot.functionCount} | ${hotspot.authorCount} | ${hotspot.linesChanged} |`,
    );
  }

  return lines;
}

function renderCouplingSection(result: ScanResult): string[] {
  const lines = ["## Top Coupling Pairs", ""];

  if (result.coupling.length === 0) {
    lines.push("_No results._");
    return lines;
  }

  lines.push(
    "| Rank | File A | File B | Strength | Co-changes |",
    "| ---: | --- | --- | ---: | ---: |",
  );

  for (const [index, pair] of result.coupling.entries()) {
    lines.push(
      `| ${index + 1} | ${escapeCell(pair.fileA)} | ${escapeCell(pair.fileB)} | ${formatScore(pair.couplingStrength)} | ${pair.coChangeCount} |`,
    );
  }

  return lines;
}

export function renderMarkdown(result: ScanResult): string {
  const sections = [
    "# Hotspot Scanner Report",
    "",
    `**Scan window:** ${result.meta.since}`,
    `**Scanned at:** ${result.meta.scannedAt}`,
    "",
    ...renderHotspotsSection(result),
    "",
    ...renderCouplingSection(result),
  ];
  return sections.join("\n");
}
