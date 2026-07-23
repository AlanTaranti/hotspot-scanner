import type { CompareResult, ScanResult } from "../types/index.js";
import { renderCompareCsv } from "./compare-csv.js";
import { renderCompareJson } from "./compare-json.js";
import { renderCompareMarkdown } from "./compare-markdown.js";
import { renderCompareTable } from "./compare-table.js";
import { renderCsv } from "./csv.js";
import { renderJson } from "./json.js";
import { renderMarkdown } from "./markdown.js";
import { sliceCompareResult } from "./slice-compare.js";
import { sliceScanResult } from "./slice.js";
import { renderTable } from "./table.js";

export interface ReporterOptions {
  format: "table" | "json" | "markdown" | "csv";
  top?: number;
}

export interface Reporter {
  render(result: ScanResult, options: ReporterOptions): string;
  renderCompare(result: CompareResult, options: ReporterOptions): string;
}

export function createReporter(): Reporter {
  return {
    render(result, options) {
      if (options.format === "csv") {
        return renderCsv(result);
      }
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
    renderCompare(result, options) {
      if (options.format === "csv") {
        return renderCompareCsv(result);
      }
      const sliced = sliceCompareResult(result, options.top);
      switch (options.format) {
        case "json":
          return renderCompareJson(sliced);
        case "markdown":
          return renderCompareMarkdown(sliced);
        default:
          return renderCompareTable(sliced);
      }
    },
  };
}
