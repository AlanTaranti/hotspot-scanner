import type { CompareResult, ScanResult } from "../types/index.js";
import { renderCompareCsv } from "./compare-csv.js";
export type { ExplainTarget } from "./explain.js";
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
import { includesSection, normalizeOnly, type ReportSection } from "./only.js";
import { sliceCompareResult } from "./slice-compare.js";
import { sliceScanResult } from "./slice.js";
import { renderTable } from "./table.js";

export type { CsvBundle } from "./csv-bundle.js";
export type { ReportSection } from "./only.js";

const EMPTY_COMPARE_SECTION = {
  new: [],
  removed: [],
  rankChanged: [],
};

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

function filterScanResultForOnly(
  result: ScanResult,
  only?: readonly ReportSection[],
): ScanResult {
  if (only === undefined || only.length === 0) {
    return result;
  }

  const onlySet = normalizeOnly(only);
  return {
    ...result,
    hotspots: includesSection(onlySet, "hotspots") ? result.hotspots : [],
    functions: includesSection(onlySet, "functions") ? result.functions : [],
  };
}

function filterCompareResultForOnly(
  result: CompareResult,
  only?: readonly ReportSection[],
): CompareResult {
  if (only === undefined || only.length === 0) {
    return result;
  }

  const onlySet = normalizeOnly(only);
  return {
    ...result,
    hotspots: includesSection(onlySet, "hotspots")
      ? result.hotspots
      : { ...EMPTY_COMPARE_SECTION },
    functions: includesSection(onlySet, "functions")
      ? result.functions
      : { ...EMPTY_COMPARE_SECTION },
  };
}

export function createReporter(): Reporter {
  return {
    render(result, options) {
      const { only, triageHints, color } = options;

      if (options.format === "csv") {
        return renderCsv(result, { only });
      }
      if (options.format === "json") {
        return renderJson(result, { only });
      }

      const filtered = filterScanResultForOnly(result, only);
      const sliced = sliceScanResult(filtered, options.top);

      if (options.format === "markdown") {
        return renderMarkdown(sliced, {
          full: result,
          only,
          triageHints,
        });
      }

      return renderTable(sliced, {
        fullResult: result,
        only,
        triageHints,
        color,
      });
    },
    renderCompare(result, options) {
      const { only, triageHints, color } = options;

      if (options.format === "csv") {
        return renderCompareCsv(result, { only });
      }
      if (options.format === "json") {
        return renderCompareJson(result, { only });
      }

      const filtered = filterCompareResultForOnly(result, only);
      const sliced = sliceCompareResult(filtered, options.top);
      const compareRenderOptions = { only, full: result, triageHints };

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
