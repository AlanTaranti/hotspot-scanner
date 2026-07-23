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

/** Full scan output (JSON schema). */
export interface ScanResult {
  version: "1.0";
  hotspots: HotspotScore[];
  coupling: CouplingPair[];
  meta: ScanMeta;
}
