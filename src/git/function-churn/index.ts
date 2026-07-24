import type {
  FunctionChangeStats,
  FunctionComplexityResult,
} from "../../types/index.js";
import { PathAliasMap } from "../rename.js";
import {
  aggregatePatchCommit,
  createFunctionChurnAccumulators,
  finalizeFunctionStats,
  indexFunctionsByFile,
} from "./aggregate.js";
import { parsePatchLogStream } from "./parse.js";
import { streamGitPatchLog, type FunctionChurnSpawnOptions } from "./spawn.js";

export interface FunctionChurnMinerProgress {
  commitsProcessed: number;
}

export interface FunctionChurnMinerOptions {
  repoPath: string;
  since?: string;
  functions: FunctionComplexityResult[];
  onProgress?: (progress: FunctionChurnMinerProgress) => void;
}

export interface FunctionChurnMinerResult {
  functionStats: Map<string, FunctionChangeStats>;
  warnings: string[];
}

export interface FunctionChurnMiner {
  mine(options: FunctionChurnMinerOptions): Promise<FunctionChurnMinerResult>;
}

export interface FunctionChurnMinerDependencies {
  streamGitPatchLog?: (
    options: FunctionChurnSpawnOptions,
  ) => AsyncGenerator<string>;
}

export function createFunctionChurnMiner(
  deps: FunctionChurnMinerDependencies = {},
): FunctionChurnMiner {
  const stream = deps.streamGitPatchLog ?? streamGitPatchLog;

  return {
    async mine(options) {
      const warnings: string[] = [];

      if (options.functions.length === 0) {
        return { functionStats: new Map(), warnings };
      }

      const aliasMap = new PathAliasMap();
      const accumulators = createFunctionChurnAccumulators();
      const functionsByFile = indexFunctionsByFile(options.functions);
      let commitCount = 0;

      for await (const commit of parsePatchLogStream(
        stream({ repoPath: options.repoPath, since: options.since }),
      )) {
        commitCount += 1;
        aggregatePatchCommit(commit, functionsByFile, aliasMap, accumulators);
        options.onProgress?.({ commitsProcessed: commitCount });
      }

      if (commitCount === 0 && options.since !== undefined) {
        warnings.push("No commits found in the specified --since window.");
      }

      for (const path of aliasMap.getAmbiguousPaths()) {
        warnings.push(`Rename history may be incomplete for: ${path}`);
      }

      return {
        functionStats: finalizeFunctionStats(accumulators),
        warnings,
      };
    },
  };
}

export { functionStatsKey } from "./keys.js";
export { hunkIntersectsFunction, parsePatchLogStream } from "./parse.js";
export { buildGitPatchLogArgv, streamGitPatchLog } from "./spawn.js";
