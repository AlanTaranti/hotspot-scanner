/** Per-file churn aggregated from git log (IMPL §5.1). */
export interface FileChangeStats {
  filePath: string;
  commitCount: number;
  linesChanged: number;
  /** Collected in M2; not exposed in JSON output (IMPL §5.2, §6.2). */
  authors: Set<string>;
  lastModified: Date;
}

/** McCabe complexity per file (IMPL §5.1). */
export interface ComplexityResult {
  filePath: string;
  cyclomaticComplexity: number;
  functionCount: number;
}

/** Ranked hotspot entry (IMPL §5.1). */
export interface HotspotScore {
  filePath: string;
  complexityNormalized: number;
  churnNormalized: number;
  hotspotScore: number;
}

/** Co-change event from a single commit (IMPL §5.1). */
export interface CoChangeEvent {
  commitHash: string;
  filesChanged: string[];
}

/** Ranked temporal coupling pair (IMPL §4.3, §6.2). */
export interface CouplingPair {
  fileA: string;
  fileB: string;
  coChangeCount: number;
  couplingStrength: number;
}

/** Scan input — flags optional until M5. */
export interface ScanOptions {
  repoPath: string;
  since?: string;
  top?: number;
  minCochange?: number;
  format?: "table" | "json";
  include?: string[];
  exclude?: string[];
  onWarning?: (message: string) => void;
  onProgress?: (progress: { commitsProcessed: number }) => void;
}

/** Scan metadata included in every result. */
export interface ScanMeta {
  since: string;
  scannedAt: string;
}

/** Full scan output (IMPL §6.2 JSON schema). */
export interface ScanResult {
  version: "1.0";
  hotspots: HotspotScore[];
  coupling: CouplingPair[];
  meta: ScanMeta;
}
