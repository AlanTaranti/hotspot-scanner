import type { CompareResult, ScanResult } from "../types/index.js";
import { renderCompareCsv } from "./compare-csv.js";
import { renderCompareJson } from "./compare-json.js";
import { renderCompareMarkdown } from "./compare-markdown.js";
import { renderCompareTable } from "./compare-table.js";
import type { CsvBundle } from "./csv-bundle.js";
import { renderCsv } from "./csv.js";
import { renderJson } from "./json.js";
import { renderMarkdown } from "./markdown.js";
import { sliceCompareResult } from "./slice-compare.js";
import { sliceScanResult } from "./slice.js";
import { renderTable } from "./table.js";

export type { CsvBundle } from "./csv-bundle.js";

export interface ReporterOptions {
  format: "table" | "json" | "markdown" | "csv";
  top?: number;
}

export type ReporterRenderResult = string | CsvBundle;

export interface Reporter {
  render(result: ScanResult, options: ReporterOptions): ReporterRenderResult;
  renderCompare(
    result: CompareResult,
    options: ReporterOptions,
  ): ReporterRenderResult;
}

export function createReporter(): Reporter {
  return {
    render(result, options) {
      if (options.format === "csv") {
        return renderCsv(result);
      }
      if (options.format === "json") {
        return renderJson(result);
      }
      const sliced = sliceScanResult(result, options.top);
      switch (options.format) {
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
      if (options.format === "json") {
        return renderCompareJson(result);
      }
      const sliced = sliceCompareResult(result, options.top);
      switch (options.format) {
        case "markdown":
          return renderCompareMarkdown(sliced);
        default:
          return renderCompareTable(sliced);
      }
    },
  };
}
