import type { ScanWarning } from "../types/index.js";
import type { ParsedCommit, ParsedFileChange } from "./parse.js";

export const EMPTY_SINCE_WINDOW_MESSAGE =
  "No commits found in the specified --since window.";

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
    (path) => `Rename history may be incomplete for: ${path}`,
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
      `Suspected unlinked rename (no git rename metadata): ${from} -> ${to}`,
    );
  }

  const remaining = pairs.length - Math.min(pairs.length, maxPairs);
  if (remaining > 0) {
    warnings.push(
      `... and ${remaining} more suspected unlinked rename${remaining === 1 ? "" : "s"}`,
    );
  }

  return warnings;
}

export function formatSinceTruncationWarning(since: string): string {
  return `Rename history before the --since window (${since}) may be missing under canonical paths`;
}

export function formatFunctionPostRenameOverlapWarning(): string {
  return (
    "Function churn overlap uses current [line, endLine] ranges against historical hunks; " +
    "confidence may be reduced after renames or moves"
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
