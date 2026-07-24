/** Per-file churn aggregated from git log. */
export interface FileChangeStats {
  filePath: string;
  commitCount: number;
  linesChanged: number;
  /** Collected in M2; exposed as authorCount in hotspot output. */
  authors: Set<string>;
  lastModified: Date;
}

/** McCabe complexity per file. */
export interface ComplexityResult {
  filePath: string;
  cyclomaticComplexity: number;
  functionCount: number;
}

/** McCabe complexity per function. */
export interface FunctionComplexityResult {
  filePath: string;
  functionName: string;
  line: number;
  endLine: number;
  complexity: number;
}

/** Per-function churn from hunk-overlap attribution (function mode only). */
export interface FunctionChangeStats {
  filePath: string;
  functionName: string;
  line: number;
  commitCount: number;
  linesChanged: number;
  authors: Set<string>;
}

/** Per-file complexity analysis with per-function breakdown. */
export interface FileComplexityResult {
  file: ComplexityResult;
  functions: FunctionComplexityResult[];
}

/** Ranked hotspot entry. */
export interface HotspotScore {
  filePath: string;
  complexityNormalized: number;
  churnNormalized: number;
  hotspotScore: number;
  cyclomaticComplexity: number;
  functionCount: number;
  commitCount: number;
  linesChanged: number;
  authorCount: number;
}

/** Ranked function hotspot entry. */
export interface FunctionHotspotScore {
  filePath: string;
  functionName: string;
  line: number;
  complexity: number;
  complexityNormalized: number;
  churnNormalized: number;
  hotspotScore: number;
  commitCount: number;
  linesChanged: number;
  authorCount: number;
}

/** Co-change event from a single commit. */
export interface CoChangeEvent {
  commitHash: string;
  filesChanged: string[];
}

/** Aggregate static edge direction between fileA and fileB. */
export type StaticDependencyDirection =
  | "none"
  | "a-to-b"
  | "b-to-a"
  | "both";

/** Ranked temporal coupling pair. */
export interface CouplingPair {
  fileA: string;
  fileB: string;
  coChangeCount: number;
  couplingStrength: number;
  /** True iff any static edge exists (runtime and/or type-only). */
  hasStaticDependency: boolean;
  /** Aggregate edge direction between fileA and fileB. */
  staticDependencyDirection: StaticDependencyDirection;
  /** At least one non-type-only static edge (value import / require / value re-export). */
  hasRuntimeStaticDependency: boolean;
  /** At least one `import type` / `export type … from` edge. */
  hasTypeOnlyStaticDependency: boolean;
  /** At least one `export … from` / `export * from` / `export type … from` re-export edge. */
  hasReExportStaticDependency: boolean;
}

/** Scan granularity for ranking output. */
export type ScanGranularity = "file" | "function";

/** Diagnostic severity for warnings and stderr prefixes. */
export type DiagnosticSeverity = "info" | "warning" | "error";

/** Progress phase for git streaming miners. */
export type ScanProgressPhase = "git" | "function-churn";

/** Phase-aware progress from git / function-churn miners. */
export interface ScanProgress {
  phase: ScanProgressPhase;
  commitsProcessed: number;
}

/** Structured scan warning with optional stable code. */
export interface ScanWarning {
  severity: DiagnosticSeverity;
  message: string;
  code?: string;
}

/** Scan input — flags optional until M5. */
export interface ScanOptions {
  repoPath: string;
  /** Explicit config file path; skips parent walk when set. */
  configPath?: string;
  since?: string;
  top?: number;
  minCochange?: number;
  format?: "table" | "json" | "markdown" | "csv";
  granularity?: ScanGranularity;
  include?: string[];
  exclude?: string[];
  concurrency?: number;
  onWarning?: (warning: ScanWarning) => void;
  onProgress?: (progress: ScanProgress) => void;
}

/** Scan metadata included in every result. */
export interface ScanMeta {
  since: string;
  scannedAt: string;
  granularity: ScanGranularity;
  warnings: ScanWarning[];
}

/** Full scan output (JSON schema). */
export interface ScanResult {
  version: "1.0";
  hotspots: HotspotScore[];
  functions: FunctionHotspotScore[];
  coupling: CouplingPair[];
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

/** Function hotspot delta section for compare output. */
export interface FunctionCompareSection {
  new: FunctionHotspotScore[];
  removed: FunctionHotspotScore[];
  rankChanged: RankChange<FunctionHotspotScore>[];
}

/** Coupling pair delta section for compare output. */
export interface CouplingCompareSection {
  new: CouplingPair[];
  removed: CouplingPair[];
  rankChanged: RankChange<CouplingPair>[];
}

/** Compare report metadata. */
export interface CompareMeta {
  baseline: ScanMeta;
  current: ScanMeta;
  warnings: ScanWarning[];
}

/** Full compare output (JSON schema). */
export interface CompareResult {
  version: "1.0";
  granularity: ScanGranularity;
  hotspots: HotspotCompareSection;
  functions: FunctionCompareSection;
  coupling: CouplingCompareSection;
  meta: CompareMeta;
}
