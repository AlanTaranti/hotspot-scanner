import type { CompareResult } from "../types/index.js";

export function renderCompareJson(result: CompareResult): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}
