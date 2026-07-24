import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { GitLogError, type GitLogSpawnOptions } from "../spawn.js";

/**
 * When `paths` exceeds this count, omit pathspecs from argv to avoid ARG_MAX risk.
 * Unrestricted patch stream remains correct; only I/O is less selective.
 */
export const PATCH_PATHSPEC_FALLBACK_THRESHOLD = 1000;

export interface FunctionChurnSpawnOptions extends GitLogSpawnOptions {
  /** Relative paths; when non-empty and under threshold, appended after `--` */
  paths?: string[];
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
  if (
    paths !== undefined &&
    paths.length > 0 &&
    paths.length <= PATCH_PATHSPEC_FALLBACK_THRESHOLD
  ) {
    args.push("--", ...paths);
  }
  return args;
}

export async function* streamGitPatchLog(
  options: FunctionChurnSpawnOptions,
): AsyncGenerator<string> {
  const args = buildGitPatchLogArgv(options);
  const command = `git ${args.join(" ")}`;

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

  try {
    for await (const line of rl) {
      yield line;
    }
  } finally {
    const exitCode = await exitPromise;
    if (exitCode !== 0) {
      throw new GitLogError(options.repoPath, command, stderrChunks.join(""));
    }
  }
}
