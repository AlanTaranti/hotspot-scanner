import type {
  DiagnosticSeverity,
  ScanProgressPhase,
  ScanWarning,
} from "../types/domain.js";

export const PROGRESS_LOG_INTERVAL = 1000;

const SEVERITY_PREFIX: Record<DiagnosticSeverity, string> = {
  info: "info",
  warning: "warning",
  error: "error",
};

export function createScanWarning(
  code: string,
  message: string,
  severity: DiagnosticSeverity = "warning",
): ScanWarning {
  return { code, message, severity };
}

export function logWarning(warning: ScanWarning): void {
  const prefix = SEVERITY_PREFIX[warning.severity];
  process.stderr.write(`${prefix}: ${warning.message}\n`);
}

export function logProgress(
  phase: ScanProgressPhase,
  commitsProcessed: number,
): void {
  process.stderr.write(
    `Processing ${phase} commit ${commitsProcessed.toLocaleString("en-US")}...\n`,
  );
}

/** Returns true when a progress line was emitted (passed throttle). */
export function maybeLogProgress(
  phase: ScanProgressPhase,
  commitsProcessed: number,
  interval: number = PROGRESS_LOG_INTERVAL,
): boolean {
  if (commitsProcessed <= 0 || commitsProcessed % interval !== 0) {
    return false;
  }
  logProgress(phase, commitsProcessed);
  return true;
}
