import type {
  CoChangePairCount,
  FileChangeStats,
  ScanProgress,
  ScanWarning,
} from "../types/index.js";
import {
  aggregateOneCommit,
  createAggregateAccumulators,
} from "./aggregate.js";
import {
  canonicalizeFileStats,
  canonicalizePairCounts,
} from "./canonicalize.js";
import { createMegaCommitSkippedWarnings } from "./mega-commit-warnings.js";
import { parseGitLogStream } from "./parse.js";
import {
  applyHeuristicRenameLinks,
  createEmptyBlindSpotSignals,
  createEmptySinceWindowWarning,
  createRenameHistoryIncompleteWarning,
  detectUnlinkedRenamePairsFromCommit,
  formatAmbiguousRenameWarnings,
  formatSinceTruncationWarning,
  formatUnlinkedRenameWarnings,
  recordBlindSpotsFromCommit,
} from "./rename-warnings.js";
import { PathAliasMap } from "./rename.js";
import { streamGitLog, type GitLogSpawnOptions } from "./spawn.js";

export interface GitMinerOptions {
  repoPath: string;
  since?: string;
  onProgress?: (progress: ScanProgress) => void;
  isPathInScope?: (path: string) => boolean;
  megaCommitThreshold?: number;
  signal?: AbortSignal;
  onSpawnArgv?: (argv: string[]) => void;
}

export interface GitMinerResult {
  fileStats: Map<string, FileChangeStats>;
  pairCounts: Map<string, CoChangePairCount>;
  warnings: ScanWarning[];
  /** Rename-aware path canonicalizer from the mine-time PathAliasMap. */
  canonicalizePath: (path: string) => string;
}

export interface GitMiner {
  mine(options: GitMinerOptions): Promise<GitMinerResult>;
}

export interface GitMinerDependencies {
  streamGitLog?: (options: GitLogSpawnOptions) => AsyncGenerator<string>;
}

export function createGitMiner(deps: GitMinerDependencies = {}): GitMiner {
  const stream = deps.streamGitLog ?? streamGitLog;

  return {
    async mine(options) {
      const warnings: ScanWarning[] = [];
      const aliasMap = new PathAliasMap();
      const accumulators = createAggregateAccumulators();
      const blindSpotSignals = createEmptyBlindSpotSignals();
      let commitCount = 0;

      const aggregateOptions =
        options.isPathInScope === undefined &&
        options.megaCommitThreshold === undefined
          ? undefined
          : {
              ...(options.isPathInScope !== undefined && {
                isPathInScope: options.isPathInScope,
              }),
              ...(options.megaCommitThreshold !== undefined && {
                megaCommitThreshold: options.megaCommitThreshold,
              }),
            };

      for await (const commit of parseGitLogStream(
        stream({
          repoPath: options.repoPath,
          since: options.since,
          signal: options.signal,
          onSpawnArgv: options.onSpawnArgv,
        }),
      )) {
        commitCount += 1;
        const unlinkedPairs = detectUnlinkedRenamePairsFromCommit(commit);
        applyHeuristicRenameLinks(aliasMap, unlinkedPairs);
        recordBlindSpotsFromCommit(commit, blindSpotSignals);
        aggregateOneCommit(commit, aliasMap, accumulators, aggregateOptions);
        options.onProgress?.({ phase: "git", commitsProcessed: commitCount });
      }

      if (commitCount === 0 && options.since !== undefined) {
        warnings.push(createEmptySinceWindowWarning());
      }

      warnings.push(
        ...formatAmbiguousRenameWarnings(aliasMap.getAmbiguousPaths()).map(
          createRenameHistoryIncompleteWarning,
        ),
      );
      warnings.push(
        ...formatUnlinkedRenameWarnings(
          blindSpotSignals.unlinkedSuspectedRenames,
        ).map(createRenameHistoryIncompleteWarning),
      );
      if (options.since !== undefined && blindSpotSignals.renameLinkCount > 0) {
        warnings.push(
          createRenameHistoryIncompleteWarning(
            formatSinceTruncationWarning(options.since),
          ),
        );
      }

      warnings.push(
        ...createMegaCommitSkippedWarnings(accumulators.megaCommitSkips, {
          megaCommitThreshold: options.megaCommitThreshold,
        }),
      );

      return {
        fileStats: canonicalizeFileStats(accumulators.fileStats, aliasMap),
        pairCounts: canonicalizePairCounts(accumulators.pairCounts, aliasMap),
        warnings,
        canonicalizePath: (path) => aliasMap.canonical(path),
      };
    },
  };
}

export { streamGitLog } from "./spawn.js";
export { parseGitLogStream } from "./parse.js";
export { PathAliasMap } from "./rename.js";
export {
  aggregateCommits,
  aggregateOneCommit,
  createAggregateAccumulators,
  MEGA_COMMIT_UNIQUE_FILE_THRESHOLD,
} from "./aggregate.js";
