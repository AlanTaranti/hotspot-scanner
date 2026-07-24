import { readdir, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { listTrackedFiles } from "../git/ls-files.js";
import {
  createPathScope,
  isPathInScope,
  shouldPruneDirectory,
  type PathScope,
} from "../paths/scope.js";

export const ELIGIBLE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"] as const;

export interface DiscoverDependencies {
  listTrackedFiles?: (repoPath: string) => Promise<string[]>;
}

function hasEligibleExtension(fileName: string): boolean {
  return ELIGIBLE_EXTENSIONS.some((extension) => fileName.endsWith(extension));
}

function toPosixPath(filePath: string): string {
  return filePath.split(sep).join("/");
}

function filterDiscoveredPaths(paths: string[], scope: PathScope): string[] {
  return paths
    .filter(
      (path) =>
        hasEligibleExtension(path) && isPathInScope(toPosixPath(path), scope),
    )
    .map(toPosixPath)
    .sort();
}

async function walkDirectory(
  repoPath: string,
  currentDir: string,
  scope: PathScope,
  results: string[],
): Promise<void> {
  const entries = await readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = join(currentDir, entry.name);

    if (entry.isDirectory()) {
      const relativeDir = toPosixPath(relative(repoPath, absolutePath));
      if (shouldPruneDirectory(relativeDir, scope)) {
        continue;
      }
      await walkDirectory(repoPath, absolutePath, scope, results);
      continue;
    }

    if (entry.isFile() && hasEligibleExtension(entry.name)) {
      const relativePath = toPosixPath(relative(repoPath, absolutePath));
      if (isPathInScope(relativePath, scope)) {
        results.push(relativePath);
      }
    }
  }
}

async function discoverViaWalk(
  repoPath: string,
  scope: PathScope,
): Promise<string[]> {
  const results: string[] = [];
  await walkDirectory(repoPath, repoPath, scope, results);
  return results.sort();
}

/** Returns paths relative to repoPath. */
export async function discoverSourceFiles(
  repoPath: string,
  scope?: PathScope,
  deps: DiscoverDependencies = {},
): Promise<string[]> {
  const effectiveScope = scope ?? createPathScope();
  const listTracked = deps.listTrackedFiles ?? listTrackedFiles;

  let repoStat;
  try {
    repoStat = await stat(repoPath);
  } catch {
    throw new Error(
      `repoPath does not exist or is not accessible: ${repoPath}`,
    );
  }

  if (!repoStat.isDirectory()) {
    throw new Error(`repoPath is not a directory: ${repoPath}`);
  }

  try {
    const trackedPaths = await listTracked(repoPath);
    return filterDiscoveredPaths(trackedPaths, effectiveScope);
  } catch {
    return discoverViaWalk(repoPath, effectiveScope);
  }
}
