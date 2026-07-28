import type { GrowthPattern } from "../trend/classify.js";
import type { ScanOptions, ScanWarning } from "#types";

export const ASSESS_RESULT_VERSION = "1.0" as const;
export const ASSESS_RESULT_KIND = "hotspot-assess" as const;
export const DEFAULT_MIN_HOTSPOT_SCORE = 0.7;

export type AssessOptions = Pick<
  ScanOptions,
  | "repoPath"
  | "configPath"
  | "since"
  | "include"
  | "exclude"
  | "top"
  | "concurrency"
  | "includeTests"
  | "sequential"
  | "signal"
  | "onWarning"
  | "onProgress"
  | "onSpawnArgv"
> & {
  minHotspotScore?: number;
  onAssessProgress?: (progress: {
    index: number;
    total: number;
    filePath: string;
  }) => void;
};

export type AssessCandidateStatus = "ok" | "skipped" | "error";

export type AssessCandidate = {
  filePath: string;
  hotspotScore: number;
  ncloc?: number;
  commitCount?: number;
  status: AssessCandidateStatus;
  /** Present when status === "ok" */
  growthPattern?: GrowthPattern;
  /** Compact trend meta only — never full points */
  revisionCount?: number;
  truncated?: boolean;
  message?: string;
};

export type AssessPatternCounts = {
  deteriorating: number;
  refactored: number;
  stable: number;
  inconclusive: number;
};

export type AssessResult = {
  version: typeof ASSESS_RESULT_VERSION;
  kind: typeof ASSESS_RESULT_KIND;
  meta: {
    repoPath: string;
    since: string;
    minHotspotScore: number;
    top: number;
    scannedHotspotCount: number;
    candidateCount: number;
    patternCounts: AssessPatternCounts;
    skippedCount: number;
    errorCount: number;
    scannerVersion: string;
    warnings?: ScanWarning[];
    timings?: { totalMs: number; scanMs?: number; trendMs?: number };
  };
  candidates: AssessCandidate[];
};
