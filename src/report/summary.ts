import type {
  CompareResult,
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
  full: HotspotCompareSection,
  displayed: HotspotCompareSection,
): string {
  const total = countCompareDeltas(full);
  const shown = countCompareDeltas(displayed);
  return `${label}: showing ${shown} of ${total} (new ${full.new.length}, removed ${full.removed.length}, rank changed ${full.rankChanged.length})`;
}

export function buildScanExecutiveSummary(
  full: ScanResult,
  displayed: ScanResult,
): string[] {
  return [
    `Scan window: ${full.meta.since} (scanned ${full.meta.scannedAt})`,
    formatShownVsTotal(
      "Hotspots",
      displayed.hotspots.length,
      full.hotspots.length,
    ),
    formatWarningSummaryLine(full.meta.warnings ?? []),
  ];
}

export function buildCompareExecutiveSummary(
  full: CompareResult,
  displayed: CompareResult,
): string[] {
  return [
    `Baseline since: ${full.meta.baseline.since} (scanned ${full.meta.baseline.scannedAt})`,
    `Current since: ${full.meta.current.since} (scanned ${full.meta.current.scannedAt})`,
    formatCompareDeltaLine("Hotspot deltas", full.hotspots, displayed.hotspots),
    formatWarningSummaryLine(full.meta.warnings ?? []),
  ];
}
