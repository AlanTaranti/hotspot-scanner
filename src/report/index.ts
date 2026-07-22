import type { ScanResult } from "../types/index.js";
import { renderJson } from "./json.js";
import { sliceScanResult } from "./slice.js";
import { renderTable } from "./table.js";

export interface ReporterOptions {
  format: "table" | "json";
  top?: number;
}

export interface Reporter {
  render(result: ScanResult, options: ReporterOptions): string;
}

export function createReporter(): Reporter {
  return {
    render(result, options) {
      const sliced = sliceScanResult(result, options.top);
      return options.format === "json"
        ? renderJson(sliced)
        : renderTable(sliced);
    },
  };
}
