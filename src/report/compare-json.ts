import type { CompareResult } from "../types/index.js";
import type { CompareRenderOptions } from "./compare-table.js";
import { COMPARE_RESULT_SCHEMA_URL } from "./schema-urls.js";

export function renderCompareJson(
  result: CompareResult,
  _options?: CompareRenderOptions,
): string {
  const payload: Record<string, unknown> = {
    $schema: COMPARE_RESULT_SCHEMA_URL,
    version: result.version,
    hotspots: result.hotspots,
    meta: result.meta,
  };

  return `${JSON.stringify(payload, null, 2)}\n`;
}
