import type {
  CompareResult,
  CouplingCompareSection,
  CouplingPair,
  FunctionCompareSection,
  HotspotCompareSection,
  ScanResult,
  ScanWarning,
} from "../types/index.js";

export function formatWarningSummaryLine(warnings: ScanWarning[]): string {
  if (warnings.length === 0) {
    return "Warnings: 0";
  }

  const counts = new Map<string, number>();
  let uncoded = 0;

  for (const warning of warnings) {
    if (warning.code === undefined) {
      uncoded += 1;
      continue;
    }
    counts.set(warning.code, (counts.get(warning.code) ?? 0) + 1);
  }

  const parts: string[] = [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([code, count]) => `${code}: ${count}`);

  if (uncoded > 0) {
    parts.push(`(uncoded): ${uncoded}`);
  }

  return `Warnings: ${warnings.length} total (${parts.join(", ")})`;
}

function countWithoutStaticDependency(coupling: CouplingPair[]): number {
  return coupling.filter((pair) => !pair.hasStaticDependency).length;
}

function formatShownVsTotal(
  label: string,
  shown: number,
  total: number,
): string {
  return `${label}: showing ${shown} of ${total}`;
}

function countCompareDeltas(section: {
  new: unknown[];
  removed: unknown[];
  rankChanged: unknown[];
}): number {
  return section.new.length + section.removed.length + section.rankChanged.length;
}

function formatCompareDeltaLine(
  label: string,
  full: HotspotCompareSection | FunctionCompareSection | CouplingCompareSection,
  displayed: HotspotCompareSection | FunctionCompareSection | CouplingCompareSection,
): string {
  const total = countCompareDeltas(full);
  const shown = countCompareDeltas(displayed);
  return `${label}: showing ${shown} of ${total} (new ${full.new.length}, removed ${full.removed.length}, rank changed ${full.rankChanged.length})`;
}

export function buildScanExecutiveSummary(
  full: ScanResult,
  displayed: ScanResult,
): string[] {
  const rankingLabel =
    full.meta.granularity === "function" ? "Functions" : "Hotspots";
  const fullRanking =
    full.meta.granularity === "function" ? full.functions : full.hotspots;
  const displayedRanking =
    displayed.meta.granularity === "function"
      ? displayed.functions
      : displayed.hotspots;
  const couplingWithoutStatic = countWithoutStaticDependency(full.coupling);

  return [
    `Scan window: ${full.meta.since} (scanned ${full.meta.scannedAt})`,
    `Granularity: ${full.meta.granularity}`,
    formatShownVsTotal(
      rankingLabel,
      displayedRanking.length,
      fullRanking.length,
    ),
    `Coupling pairs: ${full.coupling.length} total, ${couplingWithoutStatic} without static dependency; showing ${displayed.coupling.length} of ${full.coupling.length}`,
    formatWarningSummaryLine(full.meta.warnings ?? []),
  ];
}

export function buildCompareExecutiveSummary(
  full: CompareResult,
  displayed: CompareResult,
): string[] {
  const rankingLabel =
    full.granularity === "function" ? "Function deltas" : "Hotspot deltas";
  const fullRanking =
    full.granularity === "function" ? full.functions : full.hotspots;
  const displayedRanking =
    displayed.granularity === "function"
      ? displayed.functions
      : displayed.hotspots;

  return [
    `Baseline since: ${full.meta.baseline.since} (scanned ${full.meta.baseline.scannedAt})`,
    `Current since: ${full.meta.current.since} (scanned ${full.meta.current.scannedAt})`,
    `Granularity: ${full.granularity}`,
    formatCompareDeltaLine(rankingLabel, fullRanking, displayedRanking),
    formatCompareDeltaLine("Coupling deltas", full.coupling, displayed.coupling),
    formatWarningSummaryLine(full.meta.warnings ?? []),
  ];
}
