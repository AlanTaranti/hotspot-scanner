import { readdir, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";

export const ELIGIBLE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"] as const;

function hasEligibleExtension(fileName: string): boolean {
  return ELIGIBLE_EXTENSIONS.some((extension) => fileName.endsWith(extension));
}

function toPosixPath(filePath: string): string {
  return filePath.split(sep).join("/");
}

async function walkDirectory(
  repoPath: string,
  currentDir: string,
  results: string[],
): Promise<void> {
  const entries = await readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = join(currentDir, entry.name);

    if (entry.isDirectory()) {
      await walkDirectory(repoPath, absolutePath, results);
      continue;
    }

    if (entry.isFile() && hasEligibleExtension(entry.name)) {
      results.push(toPosixPath(relative(repoPath, absolutePath)));
    }
  }
}

/** Returns paths relative to repoPath. */
export async function discoverSourceFiles(repoPath: string): Promise<string[]> {
  let repoStat;
  try {
    repoStat = await stat(repoPath);
  } catch {
    throw new Error(`repoPath does not exist or is not accessible: ${repoPath}`);
  }

  if (!repoStat.isDirectory()) {
    throw new Error(`repoPath is not a directory: ${repoPath}`);
  }

  const results: string[] = [];
  await walkDirectory(repoPath, repoPath, results);
  return results.sort();
}
