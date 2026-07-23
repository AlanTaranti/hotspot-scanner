import type {
  CompareResult,
  CouplingCompareSection,
  FunctionCompareSection,
  HotspotCompareSection,
  RankChange,
} from "../types/index.js";

function sliceSection<T>(
  section: { new: T[]; removed: T[]; rankChanged: RankChange<T>[] },
  top?: number,
): { new: T[]; removed: T[]; rankChanged: RankChange<T>[] } {
  if (top === undefined) {
    return {
      new: [...section.new],
      removed: [...section.removed],
      rankChanged: [...section.rankChanged],
    };
  }

  return {
    new: section.new.slice(0, top),
    removed: section.removed.slice(0, top),
    rankChanged: section.rankChanged.slice(0, top),
  };
}

export function sliceCompareResult(
  result: CompareResult,
  top?: number,
): CompareResult {
  return {
    version: result.version,
    granularity: result.granularity,
    hotspots: sliceSection(result.hotspots, top) as HotspotCompareSection,
    functions: sliceSection(result.functions, top) as FunctionCompareSection,
    coupling: sliceSection(result.coupling, top) as CouplingCompareSection,
    meta: {
      baseline: { ...result.meta.baseline },
      current: { ...result.meta.current },
      warnings: [...result.meta.warnings],
    },
  };
}
