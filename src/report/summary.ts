import type {
  ScanResult,
  ScanStageTimings,
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

function formatTimingDuration(ms: number): string {
  if (ms >= 1000) {
    const text = (ms / 1000).toFixed(1);
    return `${text.endsWith(".0") ? text.slice(0, -2) : text}s`;
  }
  return `${ms}ms`;
}

export function formatTimingSummaryLine(timings: ScanStageTimings): string {
  const stages = `git ${formatTimingDuration(timings.gitMs)}, complexity ${formatTimingDuration(timings.complexityMs)}`;
  const overlap =
    timings.gitMs + timings.complexityMs > timings.totalMs
      ? "; stages may run concurrently"
      : "";
  return `Timing: total ${formatTimingDuration(timings.totalMs)} (${stages}${overlap})`;
}

export function buildScanExecutiveSummary(
  full: ScanResult,
  displayed: ScanResult,
): string[] {
  const lines = [
    `Scan window: ${full.meta.since} (scanned ${full.meta.scannedAt})`,
    formatShownVsTotal(
      "Hotspots",
      displayed.hotspots.length,
      full.hotspots.length,
    ),
    formatWarningSummaryLine(full.meta.warnings ?? []),
  ];
  if (full.meta.timings !== undefined) {
    lines.push(formatTimingSummaryLine(full.meta.timings));
  }
  return lines;
}
