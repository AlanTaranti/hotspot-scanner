import { spawn } from "node:child_process";
import { createInterface, type Interface } from "node:readline";

export interface GitLogSpawnOptions {
  repoPath: string;
  since?: string;
  signal?: AbortSignal;
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
    "-M",
    "--numstat",
    "--pretty=format:COMMIT|%H|%ad|%an",
  ];
  if (options.since !== undefined) {
    args.push(`--since=${options.since}`);
  }
  return args;
}

function createAbortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
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
