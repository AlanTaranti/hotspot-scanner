/** Human-readable descriptions for complexity-trend metrics (JSON meta + CLI copy). */
export const TREND_METRIC_LEGEND = {
  indentLines: "Non-blank lines used for indentation analysis",
  indentMean:
    "Average indent depth per analyzed line (4 spaces or 1 tab = 1 level)",
  indentSd: "Spread of indent depths across analyzed lines",
  indentMax: "Deepest indent level in the file",
  indentTotal: "Sum of indent levels across analyzed lines",
  ncloc: "Non-comment lines of code (file size)",
} as const;

export type TrendMetricLegend = typeof TREND_METRIC_LEGEND;

/** One-line table legend: indentation proxy vs file size. */
export const TREND_TABLE_LEGEND =
  "Indent: mean/sd/max/total = depth levels (Tornhill whitespace proxy, not AST) · Size: ncloc";

/** CLI help blurb for the trend subcommand. */
export const TREND_CLI_METRICS_HELP =
  "Indentation complexity is a Tornhill-style whitespace proxy (indent depth stats); ncloc is file size. JSON includes meta.metricLegend.";
