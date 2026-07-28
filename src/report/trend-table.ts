import { TREND_TABLE_LEGEND } from "../trend/metric-legend.js";
import type {
  ComplexityTrendPoint,
  ComplexityTrendResult,
} from "../trend/types.js";
import { paintGrowthPattern } from "./color.js";

function formatRange(result: ComplexityTrendResult): string {
  if (result.meta.start !== undefined && result.meta.end !== undefined) {
    return `${result.meta.start}..${result.meta.end}`;
  }
  return result.meta.since ?? "all history";
}

function shouldShowIndentLinesColumn(points: ComplexityTrendPoint[]): boolean {
  return points.some((point) => point.indentLines !== point.ncloc);
}

export function renderTrendTable(
  result: ComplexityTrendResult,
  options?: { color?: boolean },
): string {
  const color = options?.color === true;
  const lines: string[] = [];
  const showIndentLines = shouldShowIndentLinesColumn(result.points);

  lines.push(`Complexity trend: ${result.filePath}`);
  lines.push(`Range: ${formatRange(result)}`);
  lines.push(TREND_TABLE_LEGEND);
  const { kind, summary } = result.meta.growthPattern;
  lines.push(`Pattern: ${paintGrowthPattern(kind, color)} — ${summary}`);
  lines.push(`indent_mean ${result.meta.sparklines.indentMean}`);
  lines.push(`ncloc       ${result.meta.sparklines.ncloc}`);
  lines.push("");

  const headerParts = ["rev".padEnd(10), "date".padEnd(26)];
  if (showIndentLines) {
    headerParts.push("indentLines".padStart(11));
  }
  headerParts.push(
    "ncloc".padStart(6),
    "indentMean".padStart(10),
    "indentSd".padStart(9),
    "indentMax".padStart(9),
    "indentTotal".padStart(11),
  );
  lines.push(headerParts.join(" "));

  for (const point of result.points) {
    const rowParts = [
      point.rev.slice(0, 10).padEnd(10),
      (point.date ?? "").slice(0, 26).padEnd(26),
    ];
    if (showIndentLines) {
      rowParts.push(String(point.indentLines).padStart(11));
    }
    rowParts.push(
      String(point.ncloc).padStart(6),
      point.indentMean.toFixed(2).padStart(10),
      point.indentSd.toFixed(2).padStart(9),
      String(point.indentMax).padStart(9),
      String(point.indentTotal).padStart(11),
    );
    lines.push(rowParts.join(" "));
  }

  return `${lines.join("\n")}\n`;
}
