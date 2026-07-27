import type { ComplexityTrendResult } from "../trend/types.js";

function formatRange(result: ComplexityTrendResult): string {
  if (result.meta.start !== undefined && result.meta.end !== undefined) {
    return `${result.meta.start}..${result.meta.end}`;
  }
  return result.meta.since ?? "all history";
}

export function renderTrendTable(result: ComplexityTrendResult): string {
  const lines: string[] = [];
  lines.push(`Complexity trend: ${result.filePath}`);
  lines.push(`Range: ${formatRange(result)} · follow=${String(result.meta.follow)}`);
  lines.push(`mean  ${result.meta.sparklines.mean}`);
  lines.push(`ncloc ${result.meta.sparklines.ncloc}`);
  lines.push("");
  lines.push(
    [
      "rev".padEnd(10),
      "date".padEnd(26),
      "n".padStart(4),
      "ncloc".padStart(6),
      "mean".padStart(8),
      "sd".padStart(8),
      "max".padStart(5),
      "total".padStart(7),
    ].join(" "),
  );

  for (const point of result.points) {
    lines.push(
      [
        point.rev.slice(0, 10).padEnd(10),
        (point.date ?? "").slice(0, 26).padEnd(26),
        String(point.n).padStart(4),
        String(point.ncloc).padStart(6),
        point.mean.toFixed(2).padStart(8),
        point.sd.toFixed(2).padStart(8),
        String(point.max).padStart(5),
        String(point.total).padStart(7),
      ].join(" "),
    );
  }

  return `${lines.join("\n")}\n`;
}
