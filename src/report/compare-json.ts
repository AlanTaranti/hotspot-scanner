import type { CompareResult } from "../types/index.js";
import {
  type CompareRenderOptions,
  resolveCompareExportSections,
} from "./compare-table.js";
import { normalizeOnly } from "./only.js";

export function renderCompareJson(
  result: CompareResult,
  options?: CompareRenderOptions,
): string {
  const onlySet = normalizeOnly(options?.only);
  const sections = resolveCompareExportSections(onlySet);

  const payload: Record<string, unknown> = {
    version: result.version,
    granularity: result.granularity,
    meta: result.meta,
  };

  if (sections.hotspots) {
    payload.hotspots = result.hotspots;
  }
  if (sections.functions) {
    payload.functions = result.functions;
  }
  if (sections.coupling) {
    payload.coupling = result.coupling;
  }

  return `${JSON.stringify(payload, null, 2)}\n`;
}
