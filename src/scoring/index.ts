import type {
  CoChangeEvent,
  ComplexityResult,
  CouplingPair,
  FileChangeStats,
  HotspotScore,
} from "../types/index.js";

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

export function createHotspotScorer(): HotspotScorer {
  throw new Error("HotspotScorer not implemented — see Milestone 4");
}

export function createTemporalCouplingScorer(): TemporalCouplingScorer {
  throw new Error("TemporalCouplingScorer not implemented — see Milestone 4");
}
