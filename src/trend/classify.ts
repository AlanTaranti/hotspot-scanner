import type { ComplexityTrendPoint } from "./types.js";

export type GrowthPatternKind =
  | "deteriorating"
  | "refactored"
  | "stable"
  | "inconclusive";

export type GrowthPattern = {
  kind: GrowthPatternKind;
  summary: string;
  /** Relative indentMean change first→last (end-start)/max(start, floor) */
  indentMeanDeltaRel?: number;
  /** Relative ncloc change first→last */
  nclocDeltaRel?: number;
  peakRev?: string;
};

export const MIN_POINTS = 5;
export const STABLE_REL_RANGE = 0.08;
export const STABLE_FLOOR = 0.01;
export const REFACTOR_DROP = 0.18;
export const DETERIORATE_RISE = 0.1;

type TrendPoint = Pick<ComplexityTrendPoint, "rev" | "indentMean" | "ncloc">;

function relDelta(start: number, end: number): number {
  return (end - start) / Math.max(start, STABLE_FLOOR);
}

function formatPct(delta: number): string {
  const pct = Math.round(delta * 100);
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct}%`;
}

function findPeakIndex(values: number[]): number {
  let peakIndex = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[peakIndex]) {
      peakIndex = i;
    }
  }
  return peakIndex;
}

export function classifyGrowthPattern(
  points: ReadonlyArray<TrendPoint>,
): GrowthPattern {
  if (points.length < MIN_POINTS) {
    return {
      kind: "inconclusive",
      summary: `insufficient history (${points.length} points, need ${MIN_POINTS})`,
    };
  }

  const indentMeans = points.map((point) => point.indentMean);
  const firstMean = indentMeans[0];
  const lastMean = indentMeans[indentMeans.length - 1];
  const maxMean = Math.max(...indentMeans);
  const minMean = Math.min(...indentMeans);
  const relRange = (maxMean - minMean) / Math.max(maxMean, STABLE_FLOOR);

  const firstNcloc = points[0].ncloc;
  const lastNcloc = points[points.length - 1].ncloc;
  const indentMeanDeltaRel = relDelta(firstMean, lastMean);
  const nclocDeltaRel = relDelta(firstNcloc, lastNcloc);
  const deltas = { indentMeanDeltaRel, nclocDeltaRel };

  const peakIndex = findPeakIndex(indentMeans);
  const peakMean = indentMeans[peakIndex];
  const peakRev = points[peakIndex].rev;

  if (peakIndex < indentMeans.length - 1) {
    const dropFromPeak =
      (peakMean - lastMean) / Math.max(peakMean, STABLE_FLOOR);
    if (dropFromPeak >= REFACTOR_DROP) {
      return {
        kind: "refactored",
        summary: `indentMean peaked at ${peakRev}, then dropped ${formatPct(-dropFromPeak)}`,
        peakRev,
        ...deltas,
      };
    }
  }

  if (indentMeanDeltaRel >= DETERIORATE_RISE) {
    const meanRoseFaster = indentMeanDeltaRel > nclocDeltaRel;
    const comparison = `indentMean ${formatPct(indentMeanDeltaRel)} vs ncloc ${formatPct(nclocDeltaRel)}`;
    const summary = meanRoseFaster
      ? `${comparison} (complexity outpaced size)`
      : comparison;

    return {
      kind: "deteriorating",
      summary,
      ...deltas,
    };
  }

  if (relRange <= STABLE_REL_RANGE) {
    return {
      kind: "stable",
      summary: `indentMean stable within ${formatPct(relRange)} range`,
      ...deltas,
    };
  }

  return {
    kind: "inconclusive",
    summary: "no clear growth pattern",
    ...deltas,
  };
}
