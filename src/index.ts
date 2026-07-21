/** Package entry — public API for programmatic use. */
export const PACKAGE_NAME = "@vitals/hotspot-scanner";

export { runScan } from "./scan.js";

export type {
  CoChangeEvent,
  ComplexityResult,
  CouplingPair,
  FileChangeStats,
  HotspotScore,
  ScanMeta,
  ScanOptions,
  ScanResult,
} from "./types/index.js";
