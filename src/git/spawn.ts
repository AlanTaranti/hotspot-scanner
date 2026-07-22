import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

export interface GitLogSpawnOptions {
  repoPath: string;
  since?: string;
}

export class GitLogError extends Error {
  readonly repoPath: string;
  readonly command: string;
  readonly stderr: string;

  constructor(repoPath: string, command: string, stderr: string) {
    super(
      `git log failed for repo ${repoPath}: ${stderr.trim() || "unknown error"}`,
    );
    this.name = "GitLogError";
    this.repoPath = repoPath;
    this.command = command;
    this.stderr = stderr;
  }
}

export function buildGitLogArgv(options: GitLogSpawnOptions): string[] {
  const args = [
    "-C",
    options.repoPath,
    "log",
    "--numstat",
    "--name-only",
    '--pretty=format:"COMMIT|%H|%ad|%an"',
  ];
  if (options.since !== undefined) {
    args.push(`--since=${options.since}`);
  }
  return args;
}

export async function* streamGitLog(
  options: GitLogSpawnOptions,
): AsyncGenerator<string> {
  const args = buildGitLogArgv(options);
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
