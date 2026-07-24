import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { GitLogError, type GitLogSpawnOptions } from "../spawn.js";

export type FunctionChurnSpawnOptions = GitLogSpawnOptions;

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
