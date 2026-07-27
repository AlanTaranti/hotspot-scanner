import type { IndentationMetrics } from "../complexity/indentation.js";

export type ComplexityTrendPoint = IndentationMetrics & {
  rev: string;
  date?: string;
  ncloc: number;
};

export type ComplexityTrendWarning = {
  code: string;
  message: string;
};

export type ComplexityTrendResult = {
  version: "1.0";
  kind: "complexity-trend";
  filePath: string;
  points: ComplexityTrendPoint[];
  meta: {
    since?: string;
    start?: string;
    end?: string;
    follow: boolean;
    revisionCount: number;
    truncated: boolean;
    maxRevisions: number | null;
    sparklines: { mean: string; ncloc: string };
    scannerVersion?: string;
    warnings: ComplexityTrendWarning[];
  };
};

export type ComplexityTrendOptions = {
  filePath: string;
  repoPath?: string;
  since?: string;
  start?: string;
  end?: string;
  maxRevisions?: number;
  all?: boolean;
  follow?: boolean;
  signal?: AbortSignal;
  onProgress?: (progress: {
    revisionsProcessed: number;
    total: number;
  }) => void;
  includeScannerVersion?: boolean;
};

export const DEFAULT_MAX_REVISIONS = 100;

export const TREND_WARNING_CODES = {
  EMPTY_HISTORY: "EMPTY_HISTORY",
  SHOW_FAILED: "SHOW_FAILED",
} as const;

export class TrendUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrendUsageError";
  }
}

export class TrendNotTrackedError extends Error {
  readonly filePath: string;

  constructor(filePath: string) {
    super(`File has no history in the selected range: ${filePath}`);
    this.name = "TrendNotTrackedError";
    this.filePath = filePath;
  }
}
