import type { ScanResult } from "../types/index.js";
import { renderJson } from "./json.js";
import { renderMarkdown } from "./markdown.js";
import { sliceScanResult } from "./slice.js";
import { renderTable } from "./table.js";

export interface ReporterOptions {
  format: "table" | "json" | "markdown";
  top?: number;
}

export interface Reporter {
  render(result: ScanResult, options: ReporterOptions): string;
}

export function createReporter(): Reporter {
  return {
    render(result, options) {
      const sliced = sliceScanResult(result, options.top);
      switch (options.format) {
        case "json":
          return renderJson(sliced);
        case "markdown":
          return renderMarkdown(sliced);
        default:
          return renderTable(sliced);
      }
    },
  };
}
