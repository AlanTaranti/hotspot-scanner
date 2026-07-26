import type { CompareResult, ScanResult } from "../types/index.js";
import { renderCompareCsv } from "./compare-csv.js";
export type { ExplainTarget } from "./explain.js";
export { CliUsageError } from "./explain.js";
export {
  formatExplainBlock,
  normalizeExplainPath,
  parseExplainTarget,
} from "./explain.js";
export type {
  CompareExplainClassification,
  CompareExplainMatch,
} from "./explain-compare.js";
export {
  findCompareExplainMatches,
  formatCompareExplain,
} from "./explain-compare.js";
import { renderCompareJson } from "./compare-json.js";
import { renderCompareMarkdown } from "./compare-markdown.js";
import { renderCompareTable } from "./compare-table.js";
import type { CsvBundle } from "./csv-bundle.js";
import { renderCsv } from "./csv.js";
import { renderJson } from "./json.js";
import { renderMarkdown } from "./markdown.js";
import type { ReportSection } from "./only.js";
import { sliceCompareResult } from "./slice-compare.js";
import { sliceScanResult } from "./slice.js";
import { renderTable } from "./table.js";

export type { CsvBundle } from "./csv-bundle.js";
export type { ReportSection } from "./only.js";

export interface ReporterOptions {
  format: "table" | "json" | "markdown" | "csv";
  top?: number;
  only?: readonly ReportSection[];
  /** When false, omits triage on scan table/markdown. Defaults to true. */
  triageHints?: boolean;
  /** Table format only; defaults to false. */
  color?: boolean;
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
      const { triageHints, color } = options;

      if (options.format === "csv") {
        return renderCsv(result, { only: options.only });
      }
      if (options.format === "json") {
        return renderJson(result, { only: options.only });
      }

      const sliced = sliceScanResult(result, options.top);

      if (options.format === "markdown") {
        return renderMarkdown(sliced, {
          full: result,
          triageHints,
        });
      }

      return renderTable(sliced, {
        fullResult: result,
        triageHints,
        color,
      });
    },
    renderCompare(result, options) {
      const { triageHints, color } = options;

      if (options.format === "csv") {
        return renderCompareCsv(result, { only: options.only });
      }
      if (options.format === "json") {
        return renderCompareJson(result, { only: options.only });
      }

      const sliced = sliceCompareResult(result, options.top);
      const compareRenderOptions = { only: options.only, full: result, triageHints };

      if (options.format === "markdown") {
        return renderCompareMarkdown(sliced, compareRenderOptions);
      }

      return renderCompareTable(sliced, {
        ...compareRenderOptions,
        color,
      });
    },
  };
}
