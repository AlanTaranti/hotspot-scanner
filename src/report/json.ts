import type { ScanResult } from "../types/index.js";
import { SCAN_RESULT_SCHEMA_URL } from "./schema-urls.js";

export interface RenderJsonOptions {
  only?: readonly ("hotspots")[];
}

export function renderJson(
  result: ScanResult,
  _options?: RenderJsonOptions,
): string {
  const payload: Record<string, unknown> = {
    $schema: SCAN_RESULT_SCHEMA_URL,
    version: result.version,
    meta: result.meta,
    hotspots: result.hotspots,
  };

  return `${JSON.stringify(payload, null, 2)}\n`;
}
