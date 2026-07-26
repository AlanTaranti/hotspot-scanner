import type {
  ComplexityResult,
  FileChangeStats,
  FunctionChangeStats,
  FunctionComplexityResult,
  FunctionHotspotScore,
  HotspotScore,
} from "../types/index.js";
import { scoreFunctionHotspots } from "./function-hotspot-scorer.js";
import { scoreHotspots } from "./hotspot-scorer.js";

export interface HotspotScorer {
  score(
    fileStats: Map<string, FileChangeStats>,
    complexity: ComplexityResult[],
  ): HotspotScore[];
}

export interface FunctionHotspotScorer {
  score(
    functionStats: Map<string, FunctionChangeStats>,
    functions: FunctionComplexityResult[],
  ): FunctionHotspotScore[];
}

export interface ScoringDependencies {
  scoreHotspots?: typeof scoreHotspots;
  scoreFunctionHotspots?: typeof scoreFunctionHotspots;
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

export function createFunctionHotspotScorer(
  deps: ScoringDependencies = {},
): FunctionHotspotScorer {
  const score = deps.scoreFunctionHotspots ?? scoreFunctionHotspots;

  return {
    score(functionStats, functions) {
      return score(functionStats, functions);
    },
  };
}

export { scoreFunctionHotspots } from "./function-hotspot-scorer.js";
export { scoreHotspots } from "./hotspot-scorer.js";
export { normalizeLogMinMax } from "./normalize.js";
