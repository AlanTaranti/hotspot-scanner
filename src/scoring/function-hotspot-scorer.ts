import type {
  FileChangeStats,
  FunctionComplexityResult,
  FunctionHotspotScore,
} from "../types/index.js";
import { normalizeLogMinMax } from "./normalize.js";

function compareFunctionHotspotScores(
  left: FunctionHotspotScore,
  right: FunctionHotspotScore,
): number {
  if (right.hotspotScore !== left.hotspotScore) {
    return right.hotspotScore - left.hotspotScore;
  }
  if (left.filePath !== right.filePath) {
    return left.filePath.localeCompare(right.filePath);
  }
  return left.line - right.line;
}

export function scoreFunctionHotspots(
  fileStats: Map<string, FileChangeStats>,
  functions: FunctionComplexityResult[],
): FunctionHotspotScore[] {
  if (functions.length === 0) {
    return [];
  }

  const complexityValues = functions.map((entry) => entry.complexity);
  const churnValues = functions.map(
    (entry) => fileStats.get(entry.filePath)?.commitCount ?? 0,
  );

  const complexityNormalized = normalizeLogMinMax(complexityValues);
  const churnNormalized = normalizeLogMinMax(churnValues);

  return functions
    .map((entry, index) => {
      const c = complexityNormalized[index]!;
      const h = churnNormalized[index]!;
      const hotspotScore = c + h === 0 ? 0 : (2 * c * h) / (c + h);
      const stats = fileStats.get(entry.filePath);

      return {
        filePath: entry.filePath,
        functionName: entry.functionName,
        line: entry.line,
        complexity: entry.complexity,
        complexityNormalized: c,
        churnNormalized: h,
        hotspotScore,
        commitCount: stats?.commitCount ?? 0,
        linesChanged: stats?.linesChanged ?? 0,
        authorCount: stats?.authors.size ?? 0,
      };
    })
    .sort(compareFunctionHotspotScores);
}
