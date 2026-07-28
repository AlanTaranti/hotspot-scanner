/** Package entry — public API for programmatic use. */
export const PACKAGE_NAME = "@taranti/hotspot-scanner";

export {
  parseScanResult,
  ScanResultParseError,
} from "./scan-result/index.js";
export { runDoctor } from "./doctor/index.js";
export {
  runComplexityTrend,
  formatTruncationNote,
  TrendNotTrackedError,
  TrendUsageError,
} from "./trend/index.js";
export { previewScanScope } from "./scan-preview.js";
export { runScan } from "./scan.js";
export { runAssess } from "./assess/index.js";

export type {
  DoctorFinding,
  DoctorFindingId,
  DoctorFindingStatus,
  DoctorResult,
  RunDoctorOptions,
} from "./doctor/index.js";
export type {
  ComplexityTrendOptions,
  ComplexityTrendPoint,
  ComplexityTrendResult,
  ComplexityTrendWarning,
} from "./trend/index.js";
export type { ScanScopePreview } from "./scan-preview.js";
export type {
  AssessCandidate,
  AssessCandidateStatus,
  AssessOptions,
  AssessPatternCounts,
  AssessResult,
} from "./assess/index.js";
export type {
  FileChangeStats,
  HotspotScore,
  ScanMeta,
  ScanOptions,
  ScanResult,
} from "./types/index.js";
