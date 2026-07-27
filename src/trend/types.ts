import type { TrendMetricLegend } from "./metric-legend.js";

export type ComplexityTrendPoint = {
  rev: string;
  date?: string;
  indentLines: number;
  indentTotal: number;
  indentMean: number;
  indentSd: number;
  indentMax: number;
  ncloc: number;
};

export type ComplexityTrendWarning = {
  code: string;
  message: string;
};

export type ComplexityTrendResult = {
  version: "2.0";
  kind: "complexity-trend";
  filePath: string;
  points: ComplexityTrendPoint[];
  meta: {
    since?: string;
    start?: string;
    end?: string;
    revisionCount: number;
    truncated: boolean;
    maxRevisions: number | null;
    sparklines: { indentMean: string; ncloc: string };
    metricLegend: TrendMetricLegend;
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
