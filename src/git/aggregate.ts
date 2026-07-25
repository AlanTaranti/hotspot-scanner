import type { CoChangePairCount, FileChangeStats } from "../types/index.js";
import type { ParsedCommit, ParsedFileChange } from "./parse.js";
import type { PathAliasMap } from "./rename.js";

export const MEGA_COMMIT_UNIQUE_FILE_THRESHOLD = 100;

export interface MegaCommitSkip {
  hash: string;
  uniqueFileCount: number;
}

export interface AggregateResult {
  fileStats: Map<string, FileChangeStats>;
  pairCounts: Map<string, CoChangePairCount>;
  megaCommitSkips: MegaCommitSkip[];
}

export interface AggregateAccumulators {
  fileStats: Map<string, FileChangeStats>;
  pairCounts: Map<string, CoChangePairCount>;
  megaCommitSkips: MegaCommitSkip[];
}

export interface AggregateOneCommitOptions {
  isPathInScope?: (path: string) => boolean;
  megaCommitThreshold?: number;
}

export function createAggregateAccumulators(): AggregateAccumulators {
  return {
    fileStats: new Map(),
    pairCounts: new Map(),
    megaCommitSkips: [],
  };
}

function canonicalPair(fileA: string, fileB: string): [string, string] {
  return fileA < fileB ? [fileA, fileB] : [fileB, fileA];
}

function pairKey(fileA: string, fileB: string): string {
  return `${fileA}|${fileB}`;
}

function linesChangedForFile(file: ParsedFileChange): number {
  if (file.additions === null || file.deletions === null) {
    return 0;
  }
  return file.additions + file.deletions;
}

function getOrCreateStats(
  fileStats: Map<string, FileChangeStats>,
  filePath: string,
): FileChangeStats {
  let stats = fileStats.get(filePath);
  if (!stats) {
    stats = {
      filePath,
      commitCount: 0,
      linesChanged: 0,
      authors: new Set<string>(),
      lastModified: new Date(0),
    };
    fileStats.set(filePath, stats);
  }
  return stats;
}

function incrementPairCounts(
  pairCounts: Map<string, CoChangePairCount>,
  paths: string[],
): void {
  for (let index = 0; index < paths.length; index += 1) {
    for (
      let otherIndex = index + 1;
      otherIndex < paths.length;
      otherIndex += 1
    ) {
      const [fileA, fileB] = canonicalPair(
        paths[index]!,
        paths[otherIndex]!,
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

export function aggregateOneCommit(
  commit: ParsedCommit,
  aliasMap: PathAliasMap,
  accumulators: AggregateAccumulators,
  options?: AggregateOneCommitOptions,
): void {
  const canonicalPaths = new Set<string>();

  for (const file of commit.files) {
    if (file.renameFrom !== undefined) {
      aliasMap.link(file.renameFrom, file.path);
    }
    canonicalPaths.add(aliasMap.canonical(file.path));
  }

  if (canonicalPaths.size === 0) {
    return;
  }

  const isPathInScope = options?.isPathInScope;
  const megaCommitThreshold =
    options?.megaCommitThreshold ?? MEGA_COMMIT_UNIQUE_FILE_THRESHOLD;
  const inScopePaths =
    isPathInScope === undefined
      ? [...canonicalPaths]
      : [...canonicalPaths].filter((path) => isPathInScope(path));

  if (inScopePaths.length > megaCommitThreshold) {
    accumulators.megaCommitSkips.push({
      hash: commit.hash,
      uniqueFileCount: inScopePaths.length,
    });
  } else if (inScopePaths.length >= 2) {
    incrementPairCounts(accumulators.pairCounts, inScopePaths);
  }

  const seenInCommit = new Set<string>();

  for (const file of commit.files) {
    const canonicalPath = aliasMap.canonical(file.path);

    if (isPathInScope !== undefined && !isPathInScope(canonicalPath)) {
      continue;
    }

    const stats = getOrCreateStats(accumulators.fileStats, canonicalPath);

    if (!seenInCommit.has(canonicalPath)) {
      seenInCommit.add(canonicalPath);
      stats.commitCount += 1;
    }

    stats.linesChanged += linesChangedForFile(file);
    stats.authors.add(commit.author);
    if (commit.date > stats.lastModified) {
      stats.lastModified = commit.date;
    }
  }
}

export function aggregateCommits(
  commits: Iterable<ParsedCommit>,
  aliasMap: PathAliasMap,
  options?: AggregateOneCommitOptions,
): AggregateResult {
  const accumulators = createAggregateAccumulators();
  for (const commit of commits) {
    aggregateOneCommit(commit, aliasMap, accumulators, options);
  }
  return accumulators;
}
