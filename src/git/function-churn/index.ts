import { createScanWarning } from "../../diagnostics/logger.js";
import type {
  FunctionChangeStats,
  FunctionComplexityResult,
  ScanProgress,
  ScanWarning,
} from "../../types/index.js";
import { GitLogError } from "../spawn.js";
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
import {
  partitionPathspecs,
  PATCH_PATHSPEC_FALLBACK_THRESHOLD,
  streamGitPatchLog,
  type FunctionChurnSpawnOptions,
} from "./spawn.js";

export const PATHSPEC_ARG_MAX_FALLBACK_CODE = "PATHSPEC_ARG_MAX_FALLBACK";

export interface FunctionChurnMinerOptions {
  repoPath: string;
  since?: string;
  /** Relative paths for git pathspecs; empty → no patch spawn */
  paths?: string[];
  functions: FunctionComplexityResult[];
  onProgress?: (progress: ScanProgress) => void;
  signal?: AbortSignal;
  onSpawnArgv?: (argv: string[]) => void;
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

interface PatchStreamContext {
  functionsByFile: Map<string, FunctionComplexityResult[]>;
  aliasMap: PathAliasMap;
  accumulators: ReturnType<typeof createFunctionChurnAccumulators>;
  onProgress?: (progress: ScanProgress) => void;
  commitCountRef: { value: number };
  renameLinkObservedRef: { value: boolean };
}

function isArgMaxClassError(error: unknown): boolean {
  if (error instanceof GitLogError) {
    const stderr = error.stderr.toLowerCase();
    if (
      stderr.includes("argument list too long") ||
      stderr.includes("e2big") ||
      stderr.includes("arg_max")
    ) {
      return true;
    }
  }

  if (error instanceof Error) {
    const errno = error as NodeJS.ErrnoException;
    if (errno.code === "E2BIG") {
      return true;
    }
    const message = error.message.toLowerCase();
    if (message.includes("e2big") || message.includes("arg_max")) {
      return true;
    }
  }

  return false;
}

function createPathspecArgMaxFallbackWarning(pathCount: number): ScanWarning {
  return createScanWarning(
    PATHSPEC_ARG_MAX_FALLBACK_CODE,
    `Patch pathspec batch exceeded argv limits; fell back to unrestricted stream for ${pathCount} path(s)`,
  );
}

async function processPatchLogStream(
  stream: (
    options: FunctionChurnSpawnOptions,
  ) => AsyncGenerator<string>,
  spawnOptions: FunctionChurnSpawnOptions,
  context: PatchStreamContext,
): Promise<void> {
  for await (const commit of parsePatchLogStream(stream(spawnOptions))) {
    context.commitCountRef.value += 1;
    for (const file of commit.files) {
      if (file.renameFrom !== undefined) {
        context.renameLinkObservedRef.value = true;
      }
    }
    aggregatePatchCommit(
      commit,
      context.functionsByFile,
      context.aliasMap,
      context.accumulators,
    );
    context.onProgress?.({
      phase: "function-churn",
      commitsProcessed: context.commitCountRef.value,
    });
  }
}

async function streamPathspecPathsWithEmergency(
  paths: string[],
  spawnBase: Pick<FunctionChurnSpawnOptions, "repoPath" | "since">,
  stream: (
    options: FunctionChurnSpawnOptions,
  ) => AsyncGenerator<string>,
  context: PatchStreamContext,
  warnings: ScanWarning[],
): Promise<void> {
  const runChunk = async (chunkPaths: string[]) => {
    await processPatchLogStream(stream, { ...spawnBase, paths: chunkPaths }, context);
  };

  try {
    await runChunk(paths);
    return;
  } catch (error) {
    if (!isArgMaxClassError(error)) {
      throw error;
    }
  }

  if (paths.length <= 1) {
    warnings.push(createPathspecArgMaxFallbackWarning(paths.length));
    await processPatchLogStream(stream, { ...spawnBase, paths: undefined }, context);
    return;
  }

  const halfSize = Math.max(1, Math.floor(paths.length / 2));
  const subChunks = partitionPathspecs(paths, halfSize);

  for (let i = 0; i < subChunks.length; i++) {
    try {
      await runChunk(subChunks[i]!);
    } catch (error) {
      if (!isArgMaxClassError(error)) {
        throw error;
      }
      const remainingPaths = subChunks.slice(i).flat();
      warnings.push(createPathspecArgMaxFallbackWarning(remainingPaths.length));
      await processPatchLogStream(
        stream,
        { ...spawnBase, paths: undefined },
        context,
      );
      break;
    }
  }
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

      if (options.paths !== undefined && options.paths.length === 0) {
        return { functionStats: new Map(), warnings };
      }

      const aliasMap = new PathAliasMap();
      const accumulators = createFunctionChurnAccumulators();
      const functionsByFile = indexFunctionsByFile(options.functions);
      const commitCountRef = { value: 0 };
      const renameLinkObservedRef = { value: false };
      const context: PatchStreamContext = {
        functionsByFile,
        aliasMap,
        accumulators,
        onProgress: options.onProgress,
        commitCountRef,
        renameLinkObservedRef,
      };
      const spawnBase = {
        repoPath: options.repoPath,
        since: options.since,
        signal: options.signal,
        onSpawnArgv: options.onSpawnArgv,
      };

      if (options.paths !== undefined && options.paths.length > 0) {
        const chunks =
          options.paths.length > PATCH_PATHSPEC_FALLBACK_THRESHOLD
            ? partitionPathspecs(options.paths)
            : [options.paths];

        for (const chunk of chunks) {
          await streamPathspecPathsWithEmergency(
            chunk,
            spawnBase,
            stream,
            context,
            warnings,
          );
        }
      } else {
        await processPatchLogStream(
          stream,
          { ...spawnBase, paths: options.paths },
          context,
        );
      }

      const commitCount = commitCountRef.value;
      const renameLinkObserved = renameLinkObservedRef.value;

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
export {
  buildGitPatchLogArgv,
  PATCH_PATHSPEC_FALLBACK_THRESHOLD,
  partitionPathspecs,
  streamGitPatchLog,
} from "./spawn.js";
