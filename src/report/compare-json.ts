import type { CompareResult } from "../types/index.js";
import type { CompareRenderOptions } from "./compare-table.js";

export function renderCompareJson(
  result: CompareResult,
  _options?: CompareRenderOptions,
): string {
  const payload: Record<string, unknown> = {
    version: result.version,
    hotspots: result.hotspots,
    meta: result.meta,
  };

  return `${JSON.stringify(payload, null, 2)}\n`;
}
