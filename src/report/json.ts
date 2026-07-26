import type { ScanResult } from "../types/index.js";
import {
  includesSection,
  normalizeOnly,
  type ReportSection,
} from "./only.js";

export interface RenderJsonOptions {
  only?: readonly ReportSection[];
}

export function renderJson(
  result: ScanResult,
  options?: RenderJsonOptions,
): string {
  const onlySet = normalizeOnly(options?.only);
  const payload: Record<string, unknown> = {
    version: result.version,
    meta: result.meta,
  };

  if (includesSection(onlySet, "hotspots")) {
    payload.hotspots = result.hotspots;
  }
  if (includesSection(onlySet, "functions")) {
    payload.functions = result.functions;
  }

  return `${JSON.stringify(payload, null, 2)}\n`;
}
