import type {
  CoChangeEvent,
  CouplingPair,
  FileChangeStats,
} from "../types/index.js";

function canonicalPair(fileA: string, fileB: string): [string, string] {
  return fileA < fileB ? [fileA, fileB] : [fileB, fileA];
}

function pairKey(fileA: string, fileB: string): string {
  return `${fileA}|${fileB}`;
}

function compareCouplingPairs(left: CouplingPair, right: CouplingPair): number {
  if (right.couplingStrength !== left.couplingStrength) {
    return right.couplingStrength - left.couplingStrength;
  }

  return left.fileA.localeCompare(right.fileA);
}

function aggregateCoChangeCounts(
  coChangeEvents: CoChangeEvent[],
): Map<string, { fileA: string; fileB: string; coChangeCount: number }> {
  const pairCounts = new Map<
    string,
    { fileA: string; fileB: string; coChangeCount: number }
  >();

  for (const event of coChangeEvents) {
    const uniquePaths = [...new Set(event.filesChanged)];

    for (let index = 0; index < uniquePaths.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < uniquePaths.length; otherIndex += 1) {
        const [fileA, fileB] = canonicalPair(
          uniquePaths[index]!,
          uniquePaths[otherIndex]!,
        );
        const key = pairKey(fileA, fileB);
        const existing = pairCounts.get(key);

        if (existing) {
          existing.coChangeCount += 1;
        } else {
          pairCounts.set(key, { fileA, fileB, coChangeCount: 1 });
        }
      }
    }
  }

  return pairCounts;
}

export function scoreCoupling(
  coChangeEvents: CoChangeEvent[],
  fileStats: Map<string, FileChangeStats>,
  minCochange: number,
): CouplingPair[] {
  if (coChangeEvents.length === 0) {
    return [];
  }

  const pairCounts = aggregateCoChangeCounts(coChangeEvents);
  const results: CouplingPair[] = [];

  for (const pair of pairCounts.values()) {
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
    });
  }

  return results.sort(compareCouplingPairs);
}
