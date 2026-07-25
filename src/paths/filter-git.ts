import type { GitMinerResult } from "../git/index.js";
import type { CoChangePairCount } from "../types/index.js";
import type { PathScope } from "./scope.js";
import { isPathInScope } from "./scope.js";

export function filterGitMinerResult(
  result: GitMinerResult,
  scope: PathScope,
): GitMinerResult {
  const fileStats = new Map<
    string,
    typeof result.fileStats extends Map<string, infer V> ? V : never
  >();

  for (const [filePath, stats] of result.fileStats) {
    if (isPathInScope(filePath, scope)) {
      fileStats.set(filePath, stats);
    }
  }

  const pairCounts = new Map<string, CoChangePairCount>();
  for (const [key, pair] of result.pairCounts) {
    if (isPathInScope(pair.fileA, scope) && isPathInScope(pair.fileB, scope)) {
      pairCounts.set(key, pair);
    }
  }

  return {
    fileStats,
    pairCounts,
    warnings: result.warnings,
    canonicalizePath: result.canonicalizePath,
  };
}
