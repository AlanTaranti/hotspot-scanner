import type {
  DiagnosticSeverity,
  ScanProgress,
  ScanWarning,
} from "../types/domain.js";

export const PROGRESS_LOG_INTERVAL = 1000;

/** Matches complexity `DEFAULT_BATCH_SIZE` — ~one stderr line per batch. */
export const COMPLEXITY_PROGRESS_LOG_INTERVAL = 50;

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

function formatComplexityProgressLine(progress: ScanProgress): string {
  const parts: string[] = ["Processing complexity"];

  if (progress.batchesProcessed !== undefined) {
    const batchLabel = progress.totalBatches !== undefined
      ? `batch ${progress.batchesProcessed.toLocaleString("en-US")}/${progress.totalBatches.toLocaleString("en-US")}`
      : `batch ${progress.batchesProcessed.toLocaleString("en-US")}`;
    parts.push(batchLabel);
  }

  if (progress.filesProcessed !== undefined) {
    const filesLabel = progress.totalFiles !== undefined
      ? `(${progress.filesProcessed.toLocaleString("en-US")}/${progress.totalFiles.toLocaleString("en-US")} files)`
      : `(${progress.filesProcessed.toLocaleString("en-US")} files)`;
    parts.push(filesLabel);
  }

  return `${parts.join(" ")}...\n`;
}

export function logProgress(progress: ScanProgress): void {
  if (progress.phase === "complexity") {
    process.stderr.write(formatComplexityProgressLine(progress));
    return;
  }

  process.stderr.write(
    `Processing ${progress.phase} commit ${progress.commitsProcessed.toLocaleString("en-US")}...\n`,
  );
}

function shouldLogComplexityProgress(
  progress: ScanProgress,
  interval: number,
): boolean {
  const filesProcessed = progress.filesProcessed ?? 0;
  if (filesProcessed <= 0) {
    return false;
  }
  if (filesProcessed % interval === 0) {
    return true;
  }
  return (
    progress.totalFiles !== undefined && filesProcessed === progress.totalFiles
  );
}

/** Returns true when a progress line was emitted (passed throttle). */
export function maybeLogProgress(
  progress: ScanProgress,
  interval?: number,
): boolean {
  if (progress.phase === "complexity") {
    const throttleInterval = interval ?? COMPLEXITY_PROGRESS_LOG_INTERVAL;
    if (!shouldLogComplexityProgress(progress, throttleInterval)) {
      return false;
    }
    logProgress(progress);
    return true;
  }

  const throttleInterval = interval ?? PROGRESS_LOG_INTERVAL;
  if (
    progress.commitsProcessed <= 0 ||
    progress.commitsProcessed % throttleInterval !== 0
  ) {
    return false;
  }
  logProgress(progress);
  return true;
}

export interface CliDiagnosticOptions {
  quiet?: boolean;
  noProgress?: boolean;
}

export function createCliDiagnosticHandlers(
  options: CliDiagnosticOptions = {},
): {
  onProgress: (progress: ScanProgress) => void;
  onWarning: (warning: ScanWarning) => void;
} {
  const { quiet = false, noProgress = false } = options;
  const suppressProgress = quiet || noProgress;

  return {
    onProgress: suppressProgress
      ? () => {}
      : (progress) => maybeLogProgress(progress),
    onWarning: quiet
      ? (warning) => {
          if (warning.severity !== "info") {
            logWarning(warning);
          }
        }
      : logWarning,
  };
}
