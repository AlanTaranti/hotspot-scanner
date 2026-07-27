import type {
  DiagnosticSeverity,
  ScanProgress,
  ScanWarning,
} from "../types/domain.js";
import { formatWarningSummaryLine } from "../report/summary.js";
import {
  flushWarningSummary,
  flushWarningsJson,
  type WarningsMode,
} from "./warning-summary.js";

export type { WarningsMode } from "./warning-summary.js";

export const PROGRESS_LOG_INTERVAL = 1000;

/** Matches complexity `DEFAULT_BATCH_SIZE` — ~one stderr line per batch. */
export const COMPLEXITY_PROGRESS_LOG_INTERVAL = 50;

/** Fallback when stderr.columns missing/invalid */
export const PROGRESS_COLUMNS_FALLBACK = 80;
/** Clamped bar interior width (glyphs between brackets) */
export const PROGRESS_BAR_WIDTH_MIN = 10;
export const PROGRESS_BAR_WIDTH_MAX = 40;

const LIVE_CLEAR = "\x1b[2K\r";

const SEVERITY_PREFIX: Record<DiagnosticSeverity, string> = {
  info: "info",
  warning: "warning",
  error: "error",
};

export interface ProgressFormatOptions {
  /** Default: `process.stderr.isTTY === true` */
  stderrIsTTY?: boolean;
  /** Default: `process.stderr.columns` */
  stderrColumns?: number;
}

export function resolveProgressBarWidth(columns?: number): number {
  const raw = columns ?? process.stderr.columns ?? PROGRESS_COLUMNS_FALLBACK;
  const valid =
    typeof raw === "number" && Number.isFinite(raw) && raw > 0
      ? raw
      : PROGRESS_COLUMNS_FALLBACK;
  return Math.min(
    PROGRESS_BAR_WIDTH_MAX,
    Math.max(PROGRESS_BAR_WIDTH_MIN, Math.floor(valid * 0.25)),
  );
}

export function formatFillBar(
  ratio: number,
  width: number,
  tty: boolean,
): string {
  const clamped = Math.min(1, Math.max(0, ratio));
  const filled = Math.round(clamped * width);
  const filledChar = tty ? "█" : "#";
  const emptyChar = tty ? "░" : "-";
  return filledChar.repeat(filled) + emptyChar.repeat(width - filled);
}

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

function formatComplexityProgressBody(
  progress: ScanProgress,
  options: ProgressFormatOptions = {},
): string {
  const tty = options.stderrIsTTY ?? process.stderr.isTTY === true;
  const hasKnownTotal =
    progress.totalFiles !== undefined && progress.totalFiles > 0;
  const filesProcessed = progress.filesProcessed;

  const parts: string[] = ["complexity"];

  if (hasKnownTotal && filesProcessed !== undefined) {
    const barWidth = resolveProgressBarWidth(options.stderrColumns);
    const ratio = filesProcessed / progress.totalFiles!;
    parts.push(`[${formatFillBar(ratio, barWidth, tty)}]`);
  }

  if (filesProcessed !== undefined) {
    const filesLabel = hasKnownTotal
      ? `${filesProcessed.toLocaleString("en-US")}/${progress.totalFiles!.toLocaleString("en-US")} files`
      : `${filesProcessed.toLocaleString("en-US")} files`;
    parts.push(filesLabel);
  }

  if (progress.batchesProcessed !== undefined) {
    const batchLabel =
      progress.totalBatches !== undefined
        ? `batch ${progress.batchesProcessed.toLocaleString("en-US")}/${progress.totalBatches.toLocaleString("en-US")}`
        : `batch ${progress.batchesProcessed.toLocaleString("en-US")}`;
    if (parts.length > 1) {
      parts.push(`· ${batchLabel}`);
    } else {
      parts.push(batchLabel);
    }
  }

  return parts.join(" ");
}

function formatGitProgressBody(progress: ScanProgress): string {
  return `git ${progress.commitsProcessed.toLocaleString("en-US")} commits…`;
}

function formatFinalizeProgressBody(): string {
  return "Finalizing…";
}

export function formatProgressBody(
  progress: ScanProgress,
  options: ProgressFormatOptions = {},
): string {
  if (progress.phase === "complexity") {
    return formatComplexityProgressBody(progress, options);
  }
  if (progress.phase === "finalize") {
    return formatFinalizeProgressBody();
  }
  return formatGitProgressBody(progress);
}

export function logProgress(
  progress: ScanProgress,
  options: ProgressFormatOptions = {},
): void {
  process.stderr.write(`${formatProgressBody(progress, options)}\n`);
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

export function shouldEmitProgress(
  progress: ScanProgress,
  interval?: number,
): boolean {
  if (progress.phase === "finalize") {
    return true;
  }

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
  options: ProgressFormatOptions = {},
): boolean {
  if (!shouldEmitProgress(progress, interval)) {
    return false;
  }
  logProgress(progress, options);
  return true;
}

interface LiveProgressContext {
  stderrIsTTY: boolean;
  stderrColumns?: number;
  liveLineOpen: boolean;
  lastPhase?: ScanProgress["phase"];
  /** Effective scan window — prefixed on first emitted progress line only (M62). */
  since?: string;
  hasEmittedProgress: boolean;
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

  let body = formatProgressBody(progress, {
    stderrIsTTY: ctx.stderrIsTTY,
    stderrColumns: ctx.stderrColumns,
  });
  if (!ctx.hasEmittedProgress && ctx.since) {
    body = `since=${ctx.since} · ${body}`;
  }
  ctx.hasEmittedProgress = true;
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
  /** Default: `process.stderr.columns` — injectable for tests */
  stderrColumns?: number;
  /** Effective scan window for first progress line only. */
  since?: string;
}

export function createCliDiagnosticHandlers(
  options: CliDiagnosticOptions = {},
): {
  onProgress: (progress: ScanProgress) => void;
  onWarning: (warning: ScanWarning) => void;
  emitWarningTeaser: () => void;
  flushWarnings: () => void;
  clearLiveProgress: () => void;
} {
  const {
    quiet = false,
    noProgress = false,
    warningsMode = "summary",
    stderrIsTTY = process.stderr.isTTY === true,
    stderrColumns,
    since,
  } = options;
  const suppressProgress = quiet || noProgress;
  const buffer: ScanWarning[] = [];

  const liveCtx: LiveProgressContext = {
    stderrIsTTY,
    stderrColumns,
    liveLineOpen: false,
    since,
    hasEmittedProgress: false,
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

  const emitWarningTeaser = () => {
    clearLive();
    if (warningsMode !== "summary" || buffer.length === 0) {
      return;
    }
    process.stderr.write(`${formatWarningSummaryLine(buffer)}\n`);
  };

  const flushWarnings = () => {
    clearLive();
    if (warningsMode === "json") {
      flushWarningsJson(buffer);
      buffer.length = 0;
    } else if (warningsMode === "summary") {
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
    emitWarningTeaser,
    flushWarnings,
    clearLiveProgress: clearLive,
  };
}
