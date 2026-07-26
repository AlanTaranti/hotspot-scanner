import type {
  DiagnosticSeverity,
  ScanProgress,
  ScanWarning,
} from "../types/domain.js";
import {
  flushWarningSummary,
  type WarningsMode,
} from "./warning-summary.js";

export type { WarningsMode } from "./warning-summary.js";

export const PROGRESS_LOG_INTERVAL = 1000;

/** Matches complexity `DEFAULT_BATCH_SIZE` — ~one stderr line per batch. */
export const COMPLEXITY_PROGRESS_LOG_INTERVAL = 50;

const LIVE_CLEAR = "\x1b[2K\r";

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

function formatComplexityProgressBody(progress: ScanProgress): string {
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

  return `${parts.join(" ")}...`;
}

function formatGitProgressBody(progress: ScanProgress): string {
  return `Processing ${progress.phase} commit ${progress.commitsProcessed.toLocaleString("en-US")}...`;
}

function formatProgressBody(progress: ScanProgress): string {
  if (progress.phase === "complexity") {
    return formatComplexityProgressBody(progress);
  }
  return formatGitProgressBody(progress);
}

export function logProgress(progress: ScanProgress): void {
  process.stderr.write(`${formatProgressBody(progress)}\n`);
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

function shouldEmitProgress(
  progress: ScanProgress,
  interval?: number,
): boolean {
  if (progress.phase === "complexity") {
    const throttleInterval = interval ?? COMPLEXITY_PROGRESS_LOG_INTERVAL;
    return shouldLogComplexityProgress(progress, throttleInterval);
  }

  const throttleInterval = interval ?? PROGRESS_LOG_INTERVAL;
  return (
    progress.commitsProcessed > 0 &&
    progress.commitsProcessed % throttleInterval === 0
  );
}

/** Returns true when a progress line was emitted (passed throttle). */
export function maybeLogProgress(
  progress: ScanProgress,
  interval?: number,
): boolean {
  if (!shouldEmitProgress(progress, interval)) {
    return false;
  }
  logProgress(progress);
  return true;
}

interface LiveProgressContext {
  stderrIsTTY: boolean;
  liveLineOpen: boolean;
  lastPhase?: ScanProgress["phase"];
}

function clearLiveProgress(ctx: LiveProgressContext): void {
  if (!ctx.liveLineOpen) {
    return;
  }
  process.stderr.write(LIVE_CLEAR);
  ctx.liveLineOpen = false;
}

function writeProgressLine(
  progress: ScanProgress,
  ctx: LiveProgressContext,
): void {
  if (
    ctx.lastPhase !== undefined &&
    ctx.lastPhase !== progress.phase &&
    ctx.liveLineOpen
  ) {
    clearLiveProgress(ctx);
  }
  ctx.lastPhase = progress.phase;

  const body = formatProgressBody(progress);
  if (ctx.stderrIsTTY) {
    process.stderr.write(`${LIVE_CLEAR}${body}`);
    ctx.liveLineOpen = true;
  } else {
    process.stderr.write(`${body}\n`);
  }
}

export interface CliDiagnosticOptions {
  quiet?: boolean;
  noProgress?: boolean;
  /** Default `"summary"` — buffers warning/error for aggregated flush. */
  warningsMode?: WarningsMode;
  /** Default: `process.stderr.isTTY === true` */
  stderrIsTTY?: boolean;
}

export function createCliDiagnosticHandlers(
  options: CliDiagnosticOptions = {},
): {
  onProgress: (progress: ScanProgress) => void;
  onWarning: (warning: ScanWarning) => void;
  flushWarnings: () => void;
  clearLiveProgress: () => void;
} {
  const {
    quiet = false,
    noProgress = false,
    warningsMode = "summary",
    stderrIsTTY = process.stderr.isTTY === true,
  } = options;
  const suppressProgress = quiet || noProgress;
  const buffer: ScanWarning[] = [];

  const liveCtx: LiveProgressContext = {
    stderrIsTTY,
    liveLineOpen: false,
  };

  const clearLive = () => clearLiveProgress(liveCtx);

  const logWarningWithClear = (warning: ScanWarning) => {
    clearLive();
    logWarning(warning);
  };

  const onWarning =
    warningsMode === "full"
      ? quiet
        ? (warning: ScanWarning) => {
            if (warning.severity !== "info") {
              logWarningWithClear(warning);
            }
          }
        : logWarningWithClear
      : (warning: ScanWarning) => {
          if (quiet && warning.severity === "info") {
            return;
          }
          buffer.push(warning);
        };

  const flushWarnings = () => {
    clearLive();
    if (warningsMode !== "full") {
      flushWarningSummary(buffer);
      buffer.length = 0;
    }
  };

  return {
    onProgress: suppressProgress
      ? () => {}
      : (progress) => {
          if (!shouldEmitProgress(progress)) {
            return;
          }
          writeProgressLine(progress, liveCtx);
        },
    onWarning,
    flushWarnings,
    clearLiveProgress: clearLive,
  };
}
