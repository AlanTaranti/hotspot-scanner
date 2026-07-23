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

function renderFunctionsSection(result: ScanResult): string[] {
  const lines = ["## Top Functions", ""];

  if (result.functions.length === 0) {
    lines.push("_No results._");
    return lines;
  }

  lines.push(
    "| Rank | File | Function | Line | Score | Cpx | CpxN | Churn | ChurnN | Authors | Lines |",
    "| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  );

  for (const [index, fn] of result.functions.entries()) {
    lines.push(
      `| ${index + 1} | ${escapeCell(fn.filePath)} | ${escapeCell(fn.functionName)} | ${fn.line} | ${formatScore(fn.hotspotScore)} | ${fn.complexity} | ${formatScore(fn.complexityNormalized)} | ${fn.commitCount} | ${formatScore(fn.churnNormalized)} | ${fn.authorCount} | ${fn.linesChanged} |`,
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
  const metadata = [
    "# Hotspot Scanner Report",
    "",
    `**Scan window:** ${result.meta.since}`,
    `**Scanned at:** ${result.meta.scannedAt}`,
  ];

  if (result.meta.granularity === "function") {
    metadata.push(`**Granularity:** function`);
  }

  const rankingSection =
    result.meta.granularity === "function"
      ? renderFunctionsSection(result)
      : renderHotspotsSection(result);

  const sections = [
    ...metadata,
    "",
    ...rankingSection,
    "",
    ...renderCouplingSection(result),
  ];
  return sections.join("\n");
}
