import { execFile } from "node:child_process";
import { resolve, relative, sep } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface ResolvedMonorepoScanPath {
  /** Absolute path used for git / discovery / enrich */
  repoPath: string;
  /** Absolute original user path */
  requestPath: string;
  /** Posix relative prefix under repoPath when remounted; undefined if requestPath is git root */
  packagePrefix?: string;
  remounted: boolean;
}

export interface ResolveMonorepoScanPathDeps {
  detectGitToplevel?: (cwd: string) => Promise<string>;
}

function normalizeAbsolutePath(filePath: string): string {
  return resolve(filePath);
}

function notGitRepositoryError(requestPath: string): Error {
  return new Error(
    `repoPath is not a git repository: ${requestPath}\nHint: pass a repository root that contains a .git directory, or cd into the Git repo first.`,
  );
}

async function defaultDetectGitToplevel(cwd: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", cwd, "rev-parse", "--show-toplevel"],
      { encoding: "utf8" },
    );
    return stdout;
  } catch {
    throw notGitRepositoryError(cwd);
  }
}

function toPosixRelativePrefix(rootAbs: string, requestAbs: string): string {
  return relative(rootAbs, requestAbs).split(sep).join("/");
}

export function buildAutoIncludePattern(packagePrefix: string): string {
  const normalized = packagePrefix.replace(/\\/g, "/").replace(/^\.\//, "");
  return `${normalized}/**`;
}

export async function resolveMonorepoScanPath(
  requestPath: string,
  deps?: ResolveMonorepoScanPathDeps,
): Promise<ResolvedMonorepoScanPath> {
  const requestAbs = normalizeAbsolutePath(requestPath);
  const detectGitToplevel = deps?.detectGitToplevel ?? defaultDetectGitToplevel;

  let toplevel: string;
  try {
    toplevel = await detectGitToplevel(requestAbs);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("not a git repository") &&
      error.message.includes("Hint:")
    ) {
      throw error;
    }
    throw notGitRepositoryError(requestAbs);
  }

  const rootAbs = normalizeAbsolutePath(toplevel.trim());

  if (rootAbs === requestAbs) {
    return {
      repoPath: rootAbs,
      requestPath: requestAbs,
      remounted: false,
    };
  }

  const packagePrefix = toPosixRelativePrefix(rootAbs, requestAbs);
  if (packagePrefix === "" || packagePrefix.startsWith("..")) {
    throw new Error(
      `scan path is outside the git repository root: ${requestAbs} (git root: ${rootAbs})`,
    );
  }

  return {
    repoPath: rootAbs,
    requestPath: requestAbs,
    packagePrefix,
    remounted: true,
  };
}
