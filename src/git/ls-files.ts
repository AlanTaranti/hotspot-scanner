import { spawn } from "node:child_process";
import { formatGitStderrHint } from "./git-error-hint.js";

export class GitLsFilesError extends Error {
  readonly repoPath: string;
  readonly command: string;
  readonly stderr: string;

  constructor(repoPath: string, command: string, stderr: string) {
    const body = stderr.trim() || "unknown error";
    const hint = formatGitStderrHint(stderr);
    const base = `git ls-files failed for repo ${repoPath}: ${body}`;
    super(hint !== undefined ? `${base}\nHint: ${hint}` : base);
    this.name = "GitLsFilesError";
    this.repoPath = repoPath;
    this.command = command;
    this.stderr = stderr;
  }
}

export function buildGitLsFilesArgv(repoPath: string): string[] {
  return ["-C", repoPath, "ls-files", "-z"];
}

function normalizeToPosix(path: string): string {
  return path.replace(/\\/g, "/");
}

function parseNullDelimitedPaths(buffer: Buffer): string[] {
  if (buffer.length === 0) {
    return [];
  }

  const parts = buffer.toString().split("\0");
  if (parts.at(-1) === "") {
    parts.pop();
  }

  return parts.map(normalizeToPosix);
}

export async function listTrackedFiles(repoPath: string): Promise<string[]> {
  const args = buildGitLsFilesArgv(repoPath);
  const command = `git ${args.join(" ")}`;

  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { stdio: ["ignore", "pipe", "pipe"] });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: string[] = [];

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk.toString());
    });

    child.on("error", (err) => {
      reject(new GitLsFilesError(repoPath, command, err.message));
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new GitLsFilesError(repoPath, command, stderrChunks.join("")));
        return;
      }

      resolve(parseNullDelimitedPaths(Buffer.concat(stdoutChunks)));
    });
  });
}
