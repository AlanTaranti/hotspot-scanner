import type {
  FunctionChangeStats,
  FunctionComplexityResult,
  ScanProgress,
  ScanWarning,
} from "../../types/index.js";
import {
  createEmptySinceWindowWarning,
  createRenameHistoryIncompleteWarning,
  formatAmbiguousRenameWarnings,
  formatFunctionPostRenameOverlapWarning,
} from "../rename-warnings.js";
import { PathAliasMap } from "../rename.js";
import {
  aggregatePatchCommit,
  createFunctionChurnAccumulators,
  finalizeFunctionStats,
  indexFunctionsByFile,
} from "./aggregate.js";
import { parsePatchLogStream } from "./parse.js";
import { streamGitPatchLog, type FunctionChurnSpawnOptions } from "./spawn.js";

export interface FunctionChurnMinerOptions {
  repoPath: string;
  since?: string;
  functions: FunctionComplexityResult[];
  onProgress?: (progress: ScanProgress) => void;
}

export interface FunctionChurnMinerResult {
  functionStats: Map<string, FunctionChangeStats>;
  warnings: ScanWarning[];
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
      const warnings: ScanWarning[] = [];

      if (options.functions.length === 0) {
        return { functionStats: new Map(), warnings };
      }

      const aliasMap = new PathAliasMap();
      const accumulators = createFunctionChurnAccumulators();
      const functionsByFile = indexFunctionsByFile(options.functions);
      let commitCount = 0;
      let renameLinkObserved = false;

      for await (const commit of parsePatchLogStream(
        stream({ repoPath: options.repoPath, since: options.since }),
      )) {
        commitCount += 1;
        for (const file of commit.files) {
          if (file.renameFrom !== undefined) {
            renameLinkObserved = true;
          }
        }
        aggregatePatchCommit(commit, functionsByFile, aliasMap, accumulators);
        options.onProgress?.({
          phase: "function-churn",
          commitsProcessed: commitCount,
        });
      }

      if (commitCount === 0 && options.since !== undefined) {
        warnings.push(createEmptySinceWindowWarning());
      }

      const ambiguousPaths = aliasMap.getAmbiguousPaths();
      warnings.push(
        ...formatAmbiguousRenameWarnings(ambiguousPaths).map(
          createRenameHistoryIncompleteWarning,
        ),
      );
      if (renameLinkObserved || ambiguousPaths.length > 0) {
        warnings.push(
          createRenameHistoryIncompleteWarning(
            formatFunctionPostRenameOverlapWarning(),
          ),
        );
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
