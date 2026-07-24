import type { GitMinerResult } from "../git/index.js";
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

  const coChangeEvents = result.coChangeEvents
    .map((event) => {
      const inScopeFiles = [
        ...new Set(
          event.filesChanged.filter((filePath) =>
            isPathInScope(filePath, scope),
          ),
        ),
      ];
      return { ...event, filesChanged: inScopeFiles };
    })
    .filter((event) => event.filesChanged.length >= 2);

  return {
    fileStats,
    coChangeEvents,
    warnings: result.warnings,
  };
}
