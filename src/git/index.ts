import type { CoChangeEvent, FileChangeStats } from "../types/index.js";
import {
  aggregateOneCommit,
  createAggregateAccumulators,
} from "./aggregate.js";
import {
  canonicalizeCoChangeEvents,
  canonicalizeFileStats,
} from "./canonicalize.js";
import { parseGitLogStream } from "./parse.js";
import { PathAliasMap } from "./rename.js";
import { streamGitLog, type GitLogSpawnOptions } from "./spawn.js";

export interface GitMinerOptions {
  repoPath: string;
  since?: string;
}

export interface GitMinerResult {
  fileStats: Map<string, FileChangeStats>;
  coChangeEvents: CoChangeEvent[];
  warnings: string[];
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
      const warnings: string[] = [];
      const aliasMap = new PathAliasMap();
      const accumulators = createAggregateAccumulators();
      let commitCount = 0;

      for await (const commit of parseGitLogStream(stream(options))) {
        commitCount += 1;
        aggregateOneCommit(commit, aliasMap, accumulators);
      }

      if (commitCount === 0 && options.since !== undefined) {
        warnings.push("No commits found in the specified --since window.");
      }

      for (const path of aliasMap.getAmbiguousPaths()) {
        warnings.push(`Rename history may be incomplete for: ${path}`);
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
