/** Package entry — public API for programmatic use. */
export const PACKAGE_NAME = "@vitals/hotspot-scanner";

export {
  compareScanResults,
  loadBaseline,
  parseScanResult,
} from "./compare/index.js";
export { runDoctor } from "./doctor/index.js";
export { previewScanScope } from "./scan-preview.js";
export { runScan } from "./scan.js";

export type {
  DoctorFinding,
  DoctorFindingId,
  DoctorFindingStatus,
  DoctorResult,
  RunDoctorOptions,
} from "./doctor/index.js";
export type { ScanScopePreview } from "./scan-preview.js";
export type {
  CompareMeta,
  CompareResult,
  ComplexityResult,
  FileChangeStats,
  FunctionCompareSection,
  FunctionHotspotScore,
  HotspotCompareSection,
  HotspotScore,
  RankChange,
  ScanMeta,
  ScanOptions,
  ScanResult,
} from "./types/index.js";
