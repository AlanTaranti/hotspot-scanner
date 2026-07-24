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
  createEmptyBlindSpotSignals,
  createEmptySinceWindowWarning,
  createRenameHistoryIncompleteWarning,
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
  signal?: AbortSignal;
}

export interface GitMinerResult {
  fileStats: Map<string, FileChangeStats>;
  pairCounts: Map<string, CoChangePairCount>;
  warnings: ScanWarning[];
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
        options.isPathInScope === undefined
          ? undefined
          : { isPathInScope: options.isPathInScope };

      for await (const commit of parseGitLogStream(
        stream({
          repoPath: options.repoPath,
          since: options.since,
          signal: options.signal,
        }),
      )) {
        commitCount += 1;
        aggregateOneCommit(commit, aliasMap, accumulators, aggregateOptions);
        recordBlindSpotsFromCommit(commit, blindSpotSignals);
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
        ...createMegaCommitSkippedWarnings(accumulators.megaCommitSkips),
      );

      return {
        fileStats: canonicalizeFileStats(accumulators.fileStats, aliasMap),
        pairCounts: canonicalizePairCounts(accumulators.pairCounts, aliasMap),
        warnings,
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
} from "./aggregate.js";
