import type { ScanResult } from "../types/index.js";
export type { ExplainTarget } from "./explain.js";
export { CliUsageError } from "./explain.js";
export {
  explainTargetFound,
  formatExplainBlock,
  normalizeExplainPath,
  parseExplainTarget,
} from "./explain.js";
import type { CsvBundle } from "./csv-bundle.js";
import { renderCsv } from "./csv.js";
import { renderJson } from "./json.js";
import { renderMarkdown } from "./markdown.js";
import type { ReportSection } from "./only.js";
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
  };
}
