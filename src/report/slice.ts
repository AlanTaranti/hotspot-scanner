import type { ScanResult } from "../types/index.js";

export function sliceScanResult(result: ScanResult, top?: number): ScanResult {
  if (result.meta.granularity === "function") {
    return {
      ...result,
      functions:
        top !== undefined ? result.functions.slice(0, top) : result.functions,
      hotspots: [],
    };
  }

  if (top === undefined) {
    return {
      version: result.version,
      hotspots: [...result.hotspots],
      functions: [],
      meta: { ...result.meta },
    };
  }

  return {
    version: result.version,
    hotspots: result.hotspots.slice(0, top),
    functions: [],
    meta: { ...result.meta },
  };
}
