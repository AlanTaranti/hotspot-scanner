import type { ScanWarning } from "../types/index.js";
import type { ParsedCommit, ParsedFileChange } from "./parse.js";

const NEXT_STEP_EMPTY_SINCE =
  " Next step: widen --since or check path scope (--path / monorepo roots).";
const NEXT_STEP_AMBIGUOUS =
  " Next step: verify rename detection or widen --since to capture more history.";
const NEXT_STEP_UNLINKED =
  " Next step: ensure git records renames (-M is enabled) or widen --since to capture earlier history.";
const NEXT_STEP_SINCE_TRUNCATION =
  " Next step: widen --since to include rename history before the window.";
const NEXT_STEP_FUNCTION_OVERLAP =
  " Next step: treat function ranks cautiously after moves; prefer file mode or a wider --since window.";

export const EMPTY_SINCE_WINDOW_MESSAGE =
  "No commits found in the specified --since window." + NEXT_STEP_EMPTY_SINCE;

export function createEmptySinceWindowWarning(): ScanWarning {
  return {
    severity: "warning",
    code: "EMPTY_SINCE_WINDOW",
    message: EMPTY_SINCE_WINDOW_MESSAGE,
  };
}

export function createRenameHistoryIncompleteWarning(
  message: string,
): ScanWarning {
  return {
    severity: "warning",
    code: "RENAME_HISTORY_INCOMPLETE",
    message,
  };
}

export interface RenameBlindSpotSignals {
  ambiguousPaths: string[];
  /** In-window PathAliasMap links observed */
  renameLinkCount: number;
  /** Suspected delete+add pairs without rename metadata */
  unlinkedSuspectedRenames: Array<{ from: string; to: string }>;
}

const DEFAULT_MAX_UNLINKED_PAIRS = 5;

export function createEmptyBlindSpotSignals(): RenameBlindSpotSignals {
  return {
    ambiguousPaths: [],
    renameLinkCount: 0,
    unlinkedSuspectedRenames: [],
  };
}

export function formatAmbiguousRenameWarnings(paths: string[]): string[] {
  return paths.map(
    (path) =>
      `Rename history may be incomplete for: ${path}${NEXT_STEP_AMBIGUOUS}`,
  );
}

export function formatUnlinkedRenameWarnings(
  pairs: Array<{ from: string; to: string }>,
  options?: { maxPairs?: number },
): string[] {
  const maxPairs = options?.maxPairs ?? DEFAULT_MAX_UNLINKED_PAIRS;
  if (pairs.length === 0) {
    return [];
  }

  const warnings: string[] = [];
  for (const { from, to } of pairs.slice(0, maxPairs)) {
    warnings.push(
      `Suspected unlinked rename (no git rename metadata): ${from} -> ${to}${NEXT_STEP_UNLINKED}`,
    );
  }

  const remaining = pairs.length - Math.min(pairs.length, maxPairs);
  if (remaining > 0) {
    warnings.push(
      `... and ${remaining} more suspected unlinked rename${remaining === 1 ? "" : "s"}${NEXT_STEP_UNLINKED}`,
    );
  }

  return warnings;
}

export function formatSinceTruncationWarning(since: string): string {
  return `Rename history before the --since window (${since}) may be missing under canonical paths${NEXT_STEP_SINCE_TRUNCATION}`;
}

export function formatFunctionPostRenameOverlapWarning(): string {
  return (
    "Function churn overlap uses current [line, endLine] ranges against historical hunks; " +
    "confidence may be reduced after renames or moves" +
    NEXT_STEP_FUNCTION_OVERLAP
  );
}

function basename(filePath: string): string {
  const slash = filePath.lastIndexOf("/");
  return slash === -1 ? filePath : filePath.slice(slash + 1);
}

/** Cheap relatedness: identical basename (posix-style paths). */
export function pathsLookLikeRename(a: string, b: string): boolean {
  if (a === b) {
    return false;
  }
  return basename(a) === basename(b);
}

function isDeletedCandidate(file: ParsedFileChange): boolean {
  return file.additions === 0 && file.deletions !== null && file.deletions > 0;
}

function isAddedCandidate(file: ParsedFileChange): boolean {
  return file.additions !== null && file.additions > 0 && file.deletions === 0;
}

export function recordBlindSpotsFromCommit(
  commit: ParsedCommit,
  signals: RenameBlindSpotSignals,
): void {
  const linkedPaths = new Set<string>();
  for (const file of commit.files) {
    if (file.renameFrom !== undefined) {
      linkedPaths.add(file.renameFrom);
      linkedPaths.add(file.path);
      signals.renameLinkCount += 1;
    }
  }

  const deleted = commit.files.filter(
    (file) => isDeletedCandidate(file) && !linkedPaths.has(file.path),
  );
  const added = commit.files.filter(
    (file) => isAddedCandidate(file) && !linkedPaths.has(file.path),
  );

  const seen = new Set(
    signals.unlinkedSuspectedRenames.map((pair) => `${pair.from}\0${pair.to}`),
  );

  for (const del of deleted) {
    for (const add of added) {
      if (!pathsLookLikeRename(del.path, add.path)) {
        continue;
      }
      const key = `${del.path}\0${add.path}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      signals.unlinkedSuspectedRenames.push({ from: del.path, to: add.path });
    }
  }
}
