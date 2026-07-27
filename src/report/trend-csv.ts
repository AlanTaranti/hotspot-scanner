import type { ComplexityTrendResult } from "../trend/types.js";
import { formatCsvRow } from "./csv-utils.js";

const METRIC_DECIMALS = 4;

function formatMetric(value: number): string {
  return value.toFixed(METRIC_DECIMALS);
}

export function renderTrendCsv(result: ComplexityTrendResult): string {
  const header = [
    "rev",
    "date",
    "indentLines",
    "indentTotal",
    "indentMean",
    "indentSd",
    "indentMax",
    "ncloc",
  ];
  const lines = [formatCsvRow(header)];

  for (const point of result.points) {
    lines.push(
      formatCsvRow([
        point.rev,
        point.date ?? "",
        String(point.indentLines),
        formatMetric(point.indentTotal),
        formatMetric(point.indentMean),
        formatMetric(point.indentSd),
        formatMetric(point.indentMax),
        String(point.ncloc),
      ]),
    );
  }

  return `${lines.join("\n")}\n`;
}
