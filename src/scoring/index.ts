import type {
  CoChangeEvent,
  ComplexityResult,
  CouplingPair,
  FileChangeStats,
  HotspotScore,
} from "../types/index.js";
import { scoreCoupling } from "./coupling-scorer.js";
import { scoreHotspots } from "./hotspot-scorer.js";

export const DEFAULT_MIN_COCHANGE = 3;

export interface HotspotScorer {
  score(
    fileStats: Map<string, FileChangeStats>,
    complexity: ComplexityResult[],
  ): HotspotScore[];
}

export interface TemporalCouplingScorer {
  score(
    coChangeEvents: CoChangeEvent[],
    fileStats: Map<string, FileChangeStats>,
    minCochange: number,
  ): CouplingPair[];
}

export interface ScoringDependencies {
  scoreHotspots?: typeof scoreHotspots;
  scoreCoupling?: typeof scoreCoupling;
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

export function createTemporalCouplingScorer(
  deps: ScoringDependencies = {},
): TemporalCouplingScorer {
  const score = deps.scoreCoupling ?? scoreCoupling;

  return {
    score(coChangeEvents, fileStats, minCochange) {
      return score(coChangeEvents, fileStats, minCochange);
    },
  };
}

export { scoreCoupling } from "./coupling-scorer.js";
export { scoreHotspots } from "./hotspot-scorer.js";
export { normalizeLogMinMax } from "./normalize.js";
