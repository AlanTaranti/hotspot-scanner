/** Package entry — public API for programmatic use. */
export const PACKAGE_NAME = "@vitals/hotspot-scanner";

export {
  compareScanResults,
  loadBaseline,
  parseScanResult,
} from "./compare/index.js";
export { runScan } from "./scan.js";

export type {
  CompareMeta,
  CompareResult,
  CoChangeEvent,
  ComplexityResult,
  CouplingCompareSection,
  CouplingPair,
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
