import type {
  CoChangePairCount,
  CouplingPair,
  FileChangeStats,
} from "../types/index.js";

function compareCouplingPairs(left: CouplingPair, right: CouplingPair): number {
  if (right.couplingStrength !== left.couplingStrength) {
    return right.couplingStrength - left.couplingStrength;
  }

  return left.fileA.localeCompare(right.fileA);
}

function iteratePairCounts(
  pairCounts: Map<string, CoChangePairCount> | Iterable<CoChangePairCount>,
): Iterable<CoChangePairCount> {
  if (pairCounts instanceof Map) {
    return pairCounts.values();
  }

  return pairCounts;
}

export function scoreCoupling(
  pairCounts: Map<string, CoChangePairCount> | Iterable<CoChangePairCount>,
  fileStats: Map<string, FileChangeStats>,
  minCochange: number,
): CouplingPair[] {
  const results: CouplingPair[] = [];

  for (const pair of iteratePairCounts(pairCounts)) {
    if (pair.coChangeCount < minCochange) {
      continue;
    }

    const commitsA = fileStats.get(pair.fileA)?.commitCount ?? 0;
    const commitsB = fileStats.get(pair.fileB)?.commitCount ?? 0;
    const denominator = Math.min(commitsA, commitsB);

    if (denominator === 0) {
      continue;
    }

    results.push({
      fileA: pair.fileA,
      fileB: pair.fileB,
      coChangeCount: pair.coChangeCount,
      couplingStrength: pair.coChangeCount / denominator,
      hasStaticDependency: false,
      staticDependencyDirection: "none",
      hasRuntimeStaticDependency: false,
      hasTypeOnlyStaticDependency: false,
      hasReExportStaticDependency: false,
    });
  }

  return results.sort(compareCouplingPairs);
}
