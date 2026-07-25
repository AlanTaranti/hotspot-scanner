import { spawn } from "node:child_process";
import { createInterface, type Interface } from "node:readline";
import { GitLogError, type GitLogSpawnOptions } from "../spawn.js";

/**
 * Max pathspecs per `git log -p` argv chunk; larger allowlists are partitioned
 * by the caller before spawning.
 */
export const PATCH_PATHSPEC_FALLBACK_THRESHOLD = 1000;

export interface FunctionChurnSpawnOptions extends GitLogSpawnOptions {
  /** Relative paths; when non-empty, appended after `--` (one partition chunk) */
  paths?: string[];
}

export function partitionPathspecs(
  paths: string[],
  maxPerChunk = PATCH_PATHSPEC_FALLBACK_THRESHOLD,
): string[][] {
  const sorted = [...paths].sort();
  const chunks: string[][] = [];
  for (let i = 0; i < sorted.length; i += maxPerChunk) {
    chunks.push(sorted.slice(i, i + maxPerChunk));
  }
  return chunks;
}

export function buildGitPatchLogArgv(
  options: FunctionChurnSpawnOptions,
): string[] {
  const args = [
    "-C",
    options.repoPath,
    "log",
    "-M",
    "-p",
    "--unified=0",
    "--pretty=format:COMMIT|%H|%ad|%an",
  ];
  if (options.since !== undefined) {
    args.push(`--since=${options.since}`);
  }
  const paths = options.paths;
  if (paths !== undefined && paths.length > 0) {
    args.push("--", ...paths);
  }
  return args;
}

function createAbortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

export async function* streamGitPatchLog(
  options: FunctionChurnSpawnOptions,
): AsyncGenerator<string> {
  const args = buildGitPatchLogArgv(options);
  const command = `git ${args.join(" ")}`;
  options.onSpawnArgv?.(args);

  const child = spawn("git", args, { stdio: ["ignore", "pipe", "pipe"] });

  const stderrChunks: string[] = [];
  child.stderr.on("data", (chunk: Buffer) => {
    stderrChunks.push(chunk.toString());
  });

  const exitPromise = new Promise<number>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });

  const rl = createInterface({ input: child.stdout! });
  let aborted = false;
  let rlRef: Interface | undefined = rl;

  const abortFromSignal = () => {
    aborted = true;
    rlRef?.close();
    child.kill();
    child.stdout?.destroy();
    child.stderr?.destroy();
  };

  const { signal } = options;
  if (signal) {
    if (signal.aborted) {
      abortFromSignal();
    } else {
      signal.addEventListener("abort", abortFromSignal, { once: true });
    }
  }

  try {
    if (aborted) {
      throw createAbortError();
    }

    for await (const line of rl) {
      if (aborted) {
        throw createAbortError();
      }
      yield line;
    }
  } finally {
    signal?.removeEventListener("abort", abortFromSignal);
    rlRef = undefined;

    const exitCode = await exitPromise;
    if (aborted) {
      throw createAbortError();
    }
    if (exitCode !== 0) {
      throw new GitLogError(options.repoPath, command, stderrChunks.join(""));
    }
  }
}
