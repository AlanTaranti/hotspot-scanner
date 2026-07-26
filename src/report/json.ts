import type { ScanResult } from "../types/index.js";

export interface RenderJsonOptions {
  only?: readonly ("hotspots")[];
}

export function renderJson(
  result: ScanResult,
  _options?: RenderJsonOptions,
): string {
  const payload: Record<string, unknown> = {
    version: result.version,
    meta: result.meta,
    hotspots: result.hotspots,
  };

  return `${JSON.stringify(payload, null, 2)}\n`;
}
