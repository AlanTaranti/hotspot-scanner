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

function padEnd(value: string, width: number): string {
  return value.length >= width ? value.slice(0, width) : value.padEnd(width);
}

function padStart(value: string, width: number): string {
  return value.length >= width ? value.slice(0, width) : value.padStart(width);
}

function renderHotspotRows(
  items: HotspotScore[],
  includeRank: boolean,
): string[] {
  if (items.length === 0) {
    return ["  (none)"];
  }

  return items.map((hotspot, index) =>
    [
      includeRank ? padStart(String(index + 1), 4) : padStart("", 4),
      padEnd(hotspot.filePath, 24),
      padStart(formatScore(hotspot.hotspotScore), 8),
      padStart(String(hotspot.cyclomaticComplexity), 4),
      padStart(formatScore(hotspot.complexityNormalized), 8),
      padStart(String(hotspot.commitCount), 5),
      padStart(formatScore(hotspot.churnNormalized), 6),
      padStart(String(hotspot.functionCount), 5),
      padStart(String(hotspot.authorCount), 7),
    ].join("  "),
  );
}

function renderRankChangedHotspotRows(
  items: RankChange<HotspotScore>[],
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
      padStart(formatScore(change.entity.hotspotScore), 8),
      padStart(String(change.entity.cyclomaticComplexity), 4),
      padStart(formatScore(change.entity.complexityNormalized), 8),
      padStart(String(change.entity.commitCount), 5),
      padStart(formatScore(change.entity.churnNormalized), 6),
      padStart(String(change.entity.functionCount), 5),
      padStart(String(change.entity.authorCount), 7),
    ].join("  "),
  );
}

function renderFunctionRows(
  items: FunctionHotspotScore[],
  includeRank: boolean,
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
      padStart(formatScore(fn.hotspotScore), 8),
      padStart(String(fn.complexity), 4),
      padStart(formatScore(fn.complexityNormalized), 8),
      padStart(String(fn.commitCount), 5),
      padStart(formatScore(fn.churnNormalized), 6),
      padStart(String(fn.authorCount), 7),
    ].join("  "),
  );
}

function renderRankChangedFunctionRows(
  items: RankChange<FunctionHotspotScore>[],
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
      padStart(formatScore(change.entity.hotspotScore), 8),
      padStart(String(change.entity.complexity), 4),
      padStart(formatScore(change.entity.complexityNormalized), 8),
      padStart(String(change.entity.commitCount), 5),
      padStart(formatScore(change.entity.churnNormalized), 6),
      padStart(String(change.entity.authorCount), 7),
    ].join("  "),
  );
}

function renderCouplingRows(
  items: CouplingPair[],
  includeRank: boolean,
): string[] {
  if (items.length === 0) {
    return ["  (none)"];
  }

  return items.map((pair, index) =>
    [
      includeRank ? padStart(String(index + 1), 4) : padStart("", 4),
      padEnd(pair.fileA, 24),
      padEnd(pair.fileB, 24),
      padStart(formatScore(pair.couplingStrength), 8),
      padStart(String(pair.coChangeCount), 10),
      padStart(formatStaticDep(pair.hasStaticDependency), 9),
    ].join("  "),
  );
}

function renderRankChangedCouplingRows(
  items: RankChange<CouplingPair>[],
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
      padStart(formatScore(change.entity.couplingStrength), 8),
      padStart(String(change.entity.coChangeCount), 10),
      padStart(formatStaticDep(change.entity.hasStaticDependency), 9),
    ].join("  "),
  );
}

function renderHotspotSections(result: CompareResult): string[] {
  const header =
    "Rank  File                      Score     Cpx   CpxN      Churn  ChurnN  Funcs  Authors";
  const rankChangedHeader =
    "Baseline  Current  Delta  File                      Score     Cpx   CpxN      Churn  ChurnN  Funcs  Authors";

  return [
    "=== New Hotspots ===",
    header,
    ...renderHotspotRows(result.hotspots.new, true),
    "",
    "=== Removed Hotspots ===",
    header,
    ...renderHotspotRows(result.hotspots.removed, false),
    "",
    "=== Rank Changed Hotspots ===",
    rankChangedHeader,
    ...renderRankChangedHotspotRows(result.hotspots.rankChanged),
  ];
}

function renderFunctionSections(result: CompareResult): string[] {
  const header =
    "Rank  File                      Function              Line  Score     Cpx   CpxN      Churn  ChurnN  Authors";
  const rankChangedHeader =
    "Baseline  Current  Delta  File                      Function              Line  Score     Cpx   CpxN      Churn  ChurnN  Authors";

  return [
    "=== New Functions ===",
    header,
    ...renderFunctionRows(result.functions.new, true),
    "",
    "=== Removed Functions ===",
    header,
    ...renderFunctionRows(result.functions.removed, false),
    "",
    "=== Rank Changed Functions ===",
    rankChangedHeader,
    ...renderRankChangedFunctionRows(result.functions.rankChanged),
  ];
}

function renderCouplingSections(result: CompareResult): string[] {
  const header =
    "Rank  File A                    File B                    Strength  Co-changes  StaticDep";
  const rankChangedHeader =
    "Baseline  Current  Delta  File A                    File B                    Strength  Co-changes  StaticDep";

  return [
    "=== New Coupling Pairs ===",
    header,
    ...renderCouplingRows(result.coupling.new, true),
    "",
    "=== Removed Coupling Pairs ===",
    header,
    ...renderCouplingRows(result.coupling.removed, false),
    "",
    "=== Rank Changed Coupling Pairs ===",
    rankChangedHeader,
    ...renderRankChangedCouplingRows(result.coupling.rankChanged),
  ];
}

export function renderCompareTable(result: CompareResult): string {
  const lines = [
    "Scan Compare Report",
    `Baseline scanned: ${result.meta.baseline.scannedAt}  Since: ${result.meta.baseline.since}`,
    `Current scanned:  ${result.meta.current.scannedAt}  Since: ${result.meta.current.since}`,
  ];

  for (const warning of result.meta.warnings) {
    lines.push(warning);
  }

  lines.push("");

  if (result.granularity === "function") {
    lines.push(...renderFunctionSections(result));
  } else {
    lines.push(...renderHotspotSections(result));
  }

  lines.push("", ...renderCouplingSections(result), "");
  return lines.join("\n");
}
