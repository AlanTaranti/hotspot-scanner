import type { ComplexityTrendResult } from "../trend/types.js";
import { formatCsvRow } from "./csv-utils.js";

const METRIC_DECIMALS = 4;

function formatMetric(value: number): string {
  return value.toFixed(METRIC_DECIMALS);
}

export function renderTrendCsv(result: ComplexityTrendResult): string {
  const header = ["rev", "date", "n", "total", "mean", "sd", "max", "ncloc"];
  const lines = [formatCsvRow(header)];

  for (const point of result.points) {
    lines.push(
      formatCsvRow([
        point.rev,
        point.date ?? "",
        String(point.n),
        formatMetric(point.total),
        formatMetric(point.mean),
        formatMetric(point.sd),
        formatMetric(point.max),
        String(point.ncloc),
      ]),
    );
  }

  return `${lines.join("\n")}\n`;
}
