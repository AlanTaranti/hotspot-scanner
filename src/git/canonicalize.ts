import type { CoChangeEvent, FileChangeStats } from "../types/index.js";
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

export function canonicalizeCoChangeEvents(
  coChangeEvents: CoChangeEvent[],
  aliasMap: PathAliasMap,
): CoChangeEvent[] {
  return coChangeEvents.map((event) => ({
    commitHash: event.commitHash,
    filesChanged: [
      ...new Set(event.filesChanged.map((path) => aliasMap.canonical(path))),
    ].sort(),
  }));
}
