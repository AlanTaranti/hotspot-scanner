import type { CoChangePairCount, FileChangeStats } from "../types/index.js";
import type { PathAliasMap } from "./rename.js";

function mergeFileStats(
  target: FileChangeStats,
  source: FileChangeStats,
): void {
  target.commitCount += source.commitCount;
  target.linesChanged += source.linesChanged;
  for (const author of source.authors) {
    target.authors.add(author);
  }
  if (source.lastModified > target.lastModified) {
    target.lastModified = source.lastModified;
  }
}

function canonicalPair(fileA: string, fileB: string): [string, string] {
  return fileA < fileB ? [fileA, fileB] : [fileB, fileA];
}

function pairKey(fileA: string, fileB: string): string {
  return `${fileA}|${fileB}`;
}

export function canonicalizeFileStats(
  fileStats: Map<string, FileChangeStats>,
  aliasMap: PathAliasMap,
): Map<string, FileChangeStats> {
  const result = new Map<string, FileChangeStats>();

  for (const [, stats] of fileStats) {
    const canonicalPath = aliasMap.canonical(stats.filePath);
    const existing = result.get(canonicalPath);
    if (existing) {
      mergeFileStats(existing, stats);
      continue;
    }

    result.set(canonicalPath, {
      ...stats,
      filePath: canonicalPath,
      authors: new Set(stats.authors),
    });
  }

  return result;
}

export function canonicalizePairCounts(
  pairCounts: Map<string, CoChangePairCount>,
  aliasMap: PathAliasMap,
): Map<string, CoChangePairCount> {
  const result = new Map<string, CoChangePairCount>();

  for (const entry of pairCounts.values()) {
    const fileA = aliasMap.canonical(entry.fileA);
    const fileB = aliasMap.canonical(entry.fileB);

    if (fileA === fileB) {
      continue;
    }

    const [orderedA, orderedB] = canonicalPair(fileA, fileB);
    const key = pairKey(orderedA, orderedB);
    const existing = result.get(key);

    if (existing) {
      existing.coChangeCount += entry.coChangeCount;
    } else {
      result.set(key, {
        fileA: orderedA,
        fileB: orderedB,
        coChangeCount: entry.coChangeCount,
      });
    }
  }

  return result;
}
