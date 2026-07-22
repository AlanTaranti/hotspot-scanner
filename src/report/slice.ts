import type { ScanResult } from "../types/index.js";

export function sliceScanResult(
  result: ScanResult,
  top?: number,
): ScanResult {
  if (top === undefined) {
    return {
      version: result.version,
      hotspots: [...result.hotspots],
      coupling: [...result.coupling],
      meta: { ...result.meta },
    };
  }

  return {
    version: result.version,
    hotspots: result.hotspots.slice(0, top),
    coupling: result.coupling.slice(0, top),
    meta: { ...result.meta },
  };
}
