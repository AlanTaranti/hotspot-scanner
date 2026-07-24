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
  complexity: number;
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

/** Ranked temporal coupling pair. */
export interface CouplingPair {
  fileA: string;
  fileB: string;
  coChangeCount: number;
  couplingStrength: number;
  hasStaticDependency: boolean;
}

/** Scan granularity for ranking output. */
export type ScanGranularity = "file" | "function";

/** Scan input — flags optional until M5. */
export interface ScanOptions {
  repoPath: string;
  since?: string;
  top?: number;
  minCochange?: number;
  format?: "table" | "json" | "markdown" | "csv";
  granularity?: ScanGranularity;
  include?: string[];
  exclude?: string[];
  onWarning?: (message: string) => void;
  onProgress?: (progress: { commitsProcessed: number }) => void;
}

/** Scan metadata included in every result. */
export interface ScanMeta {
  since: string;
  scannedAt: string;
  granularity: ScanGranularity;
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
  warnings: string[];
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
