import type { CoChangeEvent, FileChangeStats } from "../types/index.js";
import type { ParsedCommit, ParsedFileChange } from "./parse.js";
import type { PathAliasMap } from "./rename.js";

export interface AggregateResult {
  fileStats: Map<string, FileChangeStats>;
  coChangeEvents: CoChangeEvent[];
}

export interface AggregateAccumulators {
  fileStats: Map<string, FileChangeStats>;
  coChangeEvents: CoChangeEvent[];
}

export function createAggregateAccumulators(): AggregateAccumulators {
  return {
    fileStats: new Map(),
    coChangeEvents: [],
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

  accumulators.coChangeEvents.push({
    commitHash: commit.hash,
    filesChanged: [...canonicalPaths].sort(),
  });

  const seenInCommit = new Set<string>();

  for (const file of commit.files) {
    const canonicalPath = aliasMap.canonical(file.path);
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
): AggregateResult {
  const accumulators = createAggregateAccumulators();
  for (const commit of commits) {
    aggregateOneCommit(commit, aliasMap, accumulators);
  }
  return accumulators;
}
