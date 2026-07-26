import type { FileChangeStats } from "../types/index.js";
import type { ParsedCommit, ParsedFileChange } from "./parse.js";
import type { PathAliasMap } from "./rename.js";

export interface AggregateResult {
  fileStats: Map<string, FileChangeStats>;
}

export interface AggregateAccumulators {
  fileStats: Map<string, FileChangeStats>;
}

export interface AggregateOneCommitOptions {
  isPathInScope?: (path: string) => boolean;
}

export function createAggregateAccumulators(): AggregateAccumulators {
  return {
    fileStats: new Map(),
  };
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

export function aggregateOneCommit(
  commit: ParsedCommit,
  aliasMap: PathAliasMap,
  accumulators: AggregateAccumulators,
  options?: AggregateOneCommitOptions,
): void {
  if (commit.files.length === 0) {
    return;
  }

  for (const file of commit.files) {
    if (file.renameFrom !== undefined) {
      aliasMap.link(file.renameFrom, file.path);
    }
  }

  const isPathInScope = options?.isPathInScope;
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
