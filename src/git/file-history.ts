import { spawn } from "node:child_process";
import { formatGitStderrHint } from "./git-error-hint.js";

export type FileRevisionRef = {
  rev: string;
  pathAtRev: string;
  date?: string;
};

export interface ListFileRevisionsOptions {
  repoPath: string;
  filePath: string;
  since?: string;
  start?: string;
  end?: string;
  follow: boolean;
  signal?: AbortSignal;
}

export interface ShowFileAtRevisionOptions {
  repoPath: string;
  rev: string;
  pathAtRev: string;
  signal?: AbortSignal;
}

export class GitFileHistoryError extends Error {
  readonly repoPath: string;
  readonly command: string;
  readonly stderr: string;

  constructor(repoPath: string, command: string, stderr: string) {
    const body = stderr.trim() || "unknown error";
    const hint = formatGitStderrHint(stderr);
    const base = `git file history failed for repo ${repoPath}: ${body}`;
    super(hint !== undefined ? `${base}\nHint: ${hint}` : base);
    this.name = "GitFileHistoryError";
    this.repoPath = repoPath;
    this.command = command;
    this.stderr = stderr;
  }
}

function createAbortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

function normalizePosixPath(path: string): string {
  return path.replace(/\\/g, "/");
}

export function buildGitFileLogArgv(
  options: ListFileRevisionsOptions,
): string[] {
  const args = [
    "-C",
    options.repoPath,
    "log",
    "--name-only",
    "--pretty=format:COMMIT|%H|%aI",
  ];

  if (options.follow) {
    args.push("--follow");
  }

  if (options.since !== undefined) {
    args.push(`--since=${options.since}`);
  }

  if (options.start !== undefined && options.end !== undefined) {
    args.push(`${options.start}..${options.end}`);
  }

  args.push("--", normalizePosixPath(options.filePath));
  return args;
}

export function buildGitShowFileArgv(
  options: ShowFileAtRevisionOptions,
): string[] {
  const object = `${options.rev}:${normalizePosixPath(options.pathAtRev)}`;
  return ["-C", options.repoPath, "show", object];
}

function parseFileLogOutput(
  output: string,
  _fallbackPath: string,
): FileRevisionRef[] {
  const revisions: FileRevisionRef[] = [];
  let pending: { rev: string; date?: string } | undefined;

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (line.length === 0) {
      continue;
    }

    if (line.startsWith("COMMIT|")) {
      const [, rev, date] = line.split("|");
      if (rev) {
        pending = { rev, date };
      }
      continue;
    }

    if (pending) {
      revisions.push({
        rev: pending.rev,
        pathAtRev: normalizePosixPath(line),
        date: pending.date,
      });
      pending = undefined;
    }
  }

  if (revisions.length === 0) {
    return revisions;
  }

  // git log is newest-first; trend needs ascending chronological order
  return revisions.reverse();
}

async function runGitCapture(
  repoPath: string,
  args: string[],
  signal?: AbortSignal,
): Promise<string> {
  const command = `git ${args.join(" ")}`;

  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: string[] = [];
    let aborted = false;

    const abortFromSignal = () => {
      aborted = true;
      child.kill();
      child.stdout?.destroy();
      child.stderr?.destroy();
    };

    if (signal) {
      if (signal.aborted) {
        abortFromSignal();
      } else {
        signal.addEventListener("abort", abortFromSignal, { once: true });
      }
    }

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk.toString());
    });

    child.on("error", (err) => {
      signal?.removeEventListener("abort", abortFromSignal);
      reject(new GitFileHistoryError(repoPath, command, err.message));
    });

    child.on("close", (code) => {
      signal?.removeEventListener("abort", abortFromSignal);
      if (aborted) {
        reject(createAbortError());
        return;
      }
      if (code !== 0) {
        reject(
          new GitFileHistoryError(repoPath, command, stderrChunks.join("")),
        );
        return;
      }
      resolve(Buffer.concat(stdoutChunks).toString("utf8"));
    });
  });
}

export async function listFileRevisions(
  options: ListFileRevisionsOptions,
): Promise<FileRevisionRef[]> {
  const args = buildGitFileLogArgv(options);
  const output = await runGitCapture(options.repoPath, args, options.signal);
  return parseFileLogOutput(output, options.filePath);
}

export async function showFileAtRevision(
  options: ShowFileAtRevisionOptions,
): Promise<string> {
  const args = buildGitShowFileArgv(options);
  return runGitCapture(options.repoPath, args, options.signal);
}
