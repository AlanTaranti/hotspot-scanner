import type {
  CoChangeEvent,
  FileChangeStats,
  ScanProgress,
  ScanWarning,
} from "../types/index.js";
import {
  aggregateOneCommit,
  createAggregateAccumulators,
} from "./aggregate.js";
import {
  canonicalizeCoChangeEvents,
  canonicalizeFileStats,
} from "./canonicalize.js";
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
}

export interface GitMinerResult {
  fileStats: Map<string, FileChangeStats>;
  coChangeEvents: CoChangeEvent[];
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

      for await (const commit of parseGitLogStream(stream(options))) {
        commitCount += 1;
        aggregateOneCommit(commit, aliasMap, accumulators);
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

      return {
        fileStats: canonicalizeFileStats(accumulators.fileStats, aliasMap),
        coChangeEvents: canonicalizeCoChangeEvents(
          accumulators.coChangeEvents,
          aliasMap,
        ),
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
