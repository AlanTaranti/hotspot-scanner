import type {
  ComplexityResult,
  FileChangeStats,
  HotspotScore,
} from "../types/index.js";
import { normalizeLogMinMax } from "./normalize.js";

function compareHotspotScores(left: HotspotScore, right: HotspotScore): number {
  if (right.hotspotScore !== left.hotspotScore) {
    return right.hotspotScore - left.hotspotScore;
  }

  return left.filePath.localeCompare(right.filePath);
}

export function scoreHotspots(
  fileStats: Map<string, FileChangeStats>,
  complexity: ComplexityResult[],
): HotspotScore[] {
  if (complexity.length === 0) {
    return [];
  }

  const complexityValues = complexity.map((entry) => entry.cyclomaticComplexity);
  const churnValues = complexity.map(
    (entry) => fileStats.get(entry.filePath)?.commitCount ?? 0,
  );

  const complexityNormalized = normalizeLogMinMax(complexityValues);
  const churnNormalized = normalizeLogMinMax(churnValues);

  return complexity
    .map((entry, index) => ({
      filePath: entry.filePath,
      complexityNormalized: complexityNormalized[index]!,
      churnNormalized: churnNormalized[index]!,
      hotspotScore:
        complexityNormalized[index]! * churnNormalized[index]!,
    }))
    .sort(compareHotspotScores);
}
