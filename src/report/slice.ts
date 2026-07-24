import type { ScanResult } from "../types/index.js";

export function sliceScanResult(result: ScanResult, top?: number): ScanResult {
  const slicedCoupling =
    top !== undefined ? result.coupling.slice(0, top) : result.coupling;

  if (result.meta.granularity === "function") {
    return {
      ...result,
      functions:
        top !== undefined ? result.functions.slice(0, top) : result.functions,
      hotspots: [],
      coupling: slicedCoupling,
    };
  }

  if (top === undefined) {
    return {
      version: result.version,
      hotspots: [...result.hotspots],
      functions: [],
      coupling: [...result.coupling],
      meta: { ...result.meta },
    };
  }

  return {
    version: result.version,
    hotspots: result.hotspots.slice(0, top),
    functions: [],
    coupling: slicedCoupling,
    meta: { ...result.meta },
  };
}
