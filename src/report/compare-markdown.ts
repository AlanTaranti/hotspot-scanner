import type {
  CompareResult,
  CouplingPair,
  FunctionHotspotScore,
  HotspotScore,
  RankChange,
} from "../types/index.js";

const SCORE_DECIMALS = 4;

function formatScore(value: number): string {
  return value.toFixed(SCORE_DECIMALS);
}

function formatStaticDep(value: boolean): string {
  return value ? "yes" : "no";
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

function renderHotspotTable(
  title: string,
  items: HotspotScore[],
  includeRank: boolean,
): string[] {
  const lines = [`## ${title}`, ""];

  if (items.length === 0) {
    lines.push("_No results._");
    return lines;
  }

  const rankHeader = includeRank ? "| Rank | " : "| ";
  lines.push(
    `${rankHeader}File | Score | Cpx | CpxN | Churn | ChurnN | Funcs | Authors |`,
    `${includeRank ? "| ---: | " : "| "}--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |`,
  );

  for (const [index, hotspot] of items.entries()) {
    const rankCell = includeRank ? `${index + 1} | ` : "";
    lines.push(
      `| ${rankCell}${escapeCell(hotspot.filePath)} | ${formatScore(hotspot.hotspotScore)} | ${hotspot.cyclomaticComplexity} | ${formatScore(hotspot.complexityNormalized)} | ${hotspot.commitCount} | ${formatScore(hotspot.churnNormalized)} | ${hotspot.functionCount} | ${hotspot.authorCount} |`,
    );
  }

  return lines;
}

function renderRankChangedHotspotTable(
  title: string,
  items: RankChange<HotspotScore>[],
): string[] {
  const lines = [`## ${title}`, ""];

  if (items.length === 0) {
    lines.push("_No results._");
    return lines;
  }

  lines.push(
    "| Baseline Rank | Current Rank | Δ | File | Score | Cpx | CpxN | Churn | ChurnN | Funcs | Authors |",
    "| ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  );

  for (const change of items) {
    lines.push(
      `| ${change.baselineRank} | ${change.currentRank} | ${change.rankDelta} | ${escapeCell(change.entity.filePath)} | ${formatScore(change.entity.hotspotScore)} | ${change.entity.cyclomaticComplexity} | ${formatScore(change.entity.complexityNormalized)} | ${change.entity.commitCount} | ${formatScore(change.entity.churnNormalized)} | ${change.entity.functionCount} | ${change.entity.authorCount} |`,
    );
  }

  return lines;
}

function renderFunctionTable(
  title: string,
  items: FunctionHotspotScore[],
  includeRank: boolean,
): string[] {
  const lines = [`## ${title}`, ""];

  if (items.length === 0) {
    lines.push("_No results._");
    return lines;
  }

  const rankHeader = includeRank ? "| Rank | " : "| ";
  lines.push(
    `${rankHeader}File | Function | Line | Score | Cpx | CpxN | Churn | ChurnN | Authors |`,
    `${includeRank ? "| ---: | " : "| "}--- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |`,
  );

  for (const [index, fn] of items.entries()) {
    const rankCell = includeRank ? `${index + 1} | ` : "";
    lines.push(
      `| ${rankCell}${escapeCell(fn.filePath)} | ${escapeCell(fn.functionName)} | ${fn.line} | ${formatScore(fn.hotspotScore)} | ${fn.complexity} | ${formatScore(fn.complexityNormalized)} | ${fn.commitCount} | ${formatScore(fn.churnNormalized)} | ${fn.authorCount} |`,
    );
  }

  return lines;
}

function renderRankChangedFunctionTable(
  title: string,
  items: RankChange<FunctionHotspotScore>[],
): string[] {
  const lines = [`## ${title}`, ""];

  if (items.length === 0) {
    lines.push("_No results._");
    return lines;
  }

  lines.push(
    "| Baseline Rank | Current Rank | Δ | File | Function | Line | Score | Cpx | CpxN | Churn | ChurnN | Authors |",
    "| ---: | ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  );

  for (const change of items) {
    lines.push(
      `| ${change.baselineRank} | ${change.currentRank} | ${change.rankDelta} | ${escapeCell(change.entity.filePath)} | ${escapeCell(change.entity.functionName)} | ${change.entity.line} | ${formatScore(change.entity.hotspotScore)} | ${change.entity.complexity} | ${formatScore(change.entity.complexityNormalized)} | ${change.entity.commitCount} | ${formatScore(change.entity.churnNormalized)} | ${change.entity.authorCount} |`,
    );
  }

  return lines;
}

function renderCouplingTable(
  title: string,
  items: CouplingPair[],
  includeRank: boolean,
): string[] {
  const lines = [`## ${title}`, ""];

  if (items.length === 0) {
    lines.push("_No results._");
    return lines;
  }

  const rankHeader = includeRank ? "| Rank | " : "| ";
  lines.push(
    `${rankHeader}File A | File B | Strength | Co-changes | Has static |`,
    `${includeRank ? "| ---: | " : "| "}--- | --- | ---: | ---: | :---: |`,
  );

  for (const [index, pair] of items.entries()) {
    const rankCell = includeRank ? `${index + 1} | ` : "";
    lines.push(
      `| ${rankCell}${escapeCell(pair.fileA)} | ${escapeCell(pair.fileB)} | ${formatScore(pair.couplingStrength)} | ${pair.coChangeCount} | ${formatStaticDep(pair.hasStaticDependency)} |`,
    );
  }

  return lines;
}

function renderRankChangedCouplingTable(
  title: string,
  items: RankChange<CouplingPair>[],
): string[] {
  const lines = [`## ${title}`, ""];

  if (items.length === 0) {
    lines.push("_No results._");
    return lines;
  }

  lines.push(
    "| Baseline Rank | Current Rank | Δ | File A | File B | Strength | Co-changes | Has static |",
    "| ---: | ---: | ---: | --- | --- | ---: | ---: | :---: |",
  );

  for (const change of items) {
    lines.push(
      `| ${change.baselineRank} | ${change.currentRank} | ${change.rankDelta} | ${escapeCell(change.entity.fileA)} | ${escapeCell(change.entity.fileB)} | ${formatScore(change.entity.couplingStrength)} | ${change.entity.coChangeCount} | ${formatStaticDep(change.entity.hasStaticDependency)} |`,
    );
  }

  return lines;
}

export function renderCompareMarkdown(result: CompareResult): string {
  const lines = [
    "# Hotspot Scanner — Compare Report",
    "",
    `**Baseline:** scanned at ${result.meta.baseline.scannedAt}, window ${result.meta.baseline.since}`,
    `**Current:** scanned at ${result.meta.current.scannedAt}, window ${result.meta.current.since}`,
    "",
  ];

  for (const warning of result.meta.warnings) {
    lines.push(`> ${warning}`, "");
  }

  if (result.granularity === "function") {
    lines.push(
      ...renderFunctionTable("New Functions", result.functions.new, true),
      "",
      ...renderFunctionTable("Removed Functions", result.functions.removed, false),
      "",
      ...renderRankChangedFunctionTable(
        "Rank Changed Functions",
        result.functions.rankChanged,
      ),
      "",
    );
  } else {
    lines.push(
      ...renderHotspotTable("New Hotspots", result.hotspots.new, true),
      "",
      ...renderHotspotTable("Removed Hotspots", result.hotspots.removed, false),
      "",
      ...renderRankChangedHotspotTable(
        "Rank Changed Hotspots",
        result.hotspots.rankChanged,
      ),
      "",
    );
  }

  lines.push(
    ...renderCouplingTable("New Coupling Pairs", result.coupling.new, true),
    "",
    ...renderCouplingTable("Removed Coupling Pairs", result.coupling.removed, false),
    "",
    ...renderRankChangedCouplingTable(
      "Rank Changed Coupling Pairs",
      result.coupling.rankChanged,
    ),
  );

  return lines.join("\n");
}
