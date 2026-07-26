/** Per-file churn aggregated from git log. */
export interface FileChangeStats {
  filePath: string;
  commitCount: number;
  linesChanged: number;
  /** Collected in M2; exposed as authorCount in hotspot output. */
  authors: Set<string>;
  lastModified: Date;
}

/** File-level NCLOC from size analysis. */
export interface ComplexityResult {
  filePath: string;
  ncloc: number;
}

/** Co-change event from a single commit. */
export interface CoChangeEvent {
  commitHash: string;
  filesChanged: string[];
}

/** Unordered co-change pair tally (git miner internal). */
export interface CoChangePairCount {
  fileA: string;
  fileB: string;
  coChangeCount: number;
}

/** Aggregate static edge direction between fileA and fileB (coupling enrich internal). */
export type StaticDependencyDirection =
  | "none"
  | "a-to-b"
  | "b-to-a"
  | "both";

/** Ranked temporal coupling pair (coupling scorer internal; removed from JSON 2.0). */
export interface CouplingPair {
  fileA: string;
  fileB: string;
  coChangeCount: number;
  couplingStrength: number;
  hasStaticDependency: boolean;
  staticDependencyDirection: StaticDependencyDirection;
  hasRuntimeStaticDependency: boolean;
  hasTypeOnlyStaticDependency: boolean;
  hasReExportStaticDependency: boolean;
}

/** Diagnostic severity for warnings and stderr prefixes. */
export type DiagnosticSeverity = "info" | "warning" | "error";

/** Progress phase for git mining and size analysis. */
export type ScanProgressPhase = "git" | "complexity";

/** Phase-aware progress from git miners and size analysis. */
export interface ScanProgress {
  phase: ScanProgressPhase;
  /** Git commit counter; use 0 for complexity phase. */
  commitsProcessed: number;
  /** Files analyzed so far (complexity phase). */
  filesProcessed?: number;
  /** Batches completed so far (complexity phase). */
  batchesProcessed?: number;
  /** Total files to analyze (complexity phase). */
  totalFiles?: number;
  /** Total batch count (complexity phase). */
  totalBatches?: number;
}

/** Structured scan warning with optional stable code. */
export interface ScanWarning {
  severity: DiagnosticSeverity;
  message: string;
  code?: string;
}

/** Wall-clock stage timings in milliseconds (successful scans). */
export interface ScanStageTimings {
  gitMs: number;
  complexityMs: number;
  totalMs: number;
}

/** Scan input — flags optional until M5. */
export interface ScanOptions {
  repoPath: string;
  /** Explicit config file path; skips parent walk when set. */
  configPath?: string;
  since?: string;
  top?: number;
  format?: "table" | "json" | "markdown" | "csv";
  include?: string[];
  exclude?: string[];
  /** When true, include test/spec files and `__tests__/` (CLI: `--include-tests`). Not config-backed. */
  includeTests?: boolean;
  concurrency?: number;
  /**
   * When true, runs git mine then size analysis sequentially
   * (disables M34 overlap). CLI: --sequential / --no-overlap. Not a config key.
   */
  sequential?: boolean;
  onWarning?: (warning: ScanWarning) => void;
  onProgress?: (progress: ScanProgress) => void;
  /** External cancel (e.g. CLI SIGINT); linked to orchestrator AbortController */
  signal?: AbortSignal;
  /** Invoked with git spawn argv before each numstat child (verbose trace) */
  onSpawnArgv?: (argv: string[]) => void;
}

/** Ranked hotspot entry. */
export interface HotspotScore {
  filePath: string;
  complexityNormalized: number;
  churnNormalized: number;
  hotspotScore: number;
  ncloc: number;
  commitCount: number;
  linesChanged: number;
  authorCount: number;
}

/** Scan metadata included in every result. */
export interface ScanMeta {
  since: string;
  scannedAt: string;
  warnings: ScanWarning[];
  /** Present on successful scans; omitted in baseline-era documents */
  timings?: ScanStageTimings;
}

/** Full scan output (JSON schema). */
export interface ScanResult {
  version: "3.0";
  hotspots: HotspotScore[];
  meta: ScanMeta;
}

/** Rank change between baseline and current scan. */
export interface RankChange<T> {
  entity: T;
  baselineRank: number;
  currentRank: number;
  /** currentRank - baselineRank; positive = moved down in ranking */
  rankDelta: number;
}

/** Hotspot delta section for compare output. */
export interface HotspotCompareSection {
  new: HotspotScore[];
  removed: HotspotScore[];
  rankChanged: RankChange<HotspotScore>[];
}

/** Compare report metadata. */
export interface CompareMeta {
  baseline: ScanMeta;
  current: ScanMeta;
  warnings: ScanWarning[];
}

/** Full compare output (JSON schema). */
export interface CompareResult {
  version: "3.0";
  hotspots: HotspotCompareSection;
  meta: CompareMeta;
}
