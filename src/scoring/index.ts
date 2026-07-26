import type {
  ComplexityResult,
  FileChangeStats,
  HotspotScore,
} from "../types/index.js";
import { scoreHotspots } from "./hotspot-scorer.js";

export interface HotspotScorer {
  score(
    fileStats: Map<string, FileChangeStats>,
    complexity: ComplexityResult[],
  ): HotspotScore[];
}

export interface ScoringDependencies {
  scoreHotspots?: typeof scoreHotspots;
}

export function createHotspotScorer(
  deps: ScoringDependencies = {},
): HotspotScorer {
  const score = deps.scoreHotspots ?? scoreHotspots;

  return {
    score(fileStats, complexity) {
      return score(fileStats, complexity);
    },
  };
}

export { scoreHotspots } from "./hotspot-scorer.js";
export { normalizeLogMinMax } from "./normalize.js";
