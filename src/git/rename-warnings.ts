import { ELIGIBLE_EXTENSIONS } from "../complexity/discover.js";
import type { ScanWarning } from "../types/index.js";
import type { ParsedCommit, ParsedFileChange } from "./parse.js";
import type { PathAliasMap } from "./rename.js";

const NEXT_STEP_EMPTY_SINCE =
  " Next step: widen --since or check path scope (--path / monorepo roots).";
/** Shared with CLI warning summary templates (stderr aggregation). */
export const NEXT_STEP_AMBIGUOUS =
  " Next step: verify rename detection or widen --since to capture more history.";
export const NEXT_STEP_UNLINKED =
  " Next step: ensure git records renames (-M is enabled) or widen --since to capture earlier history.";
export const NEXT_STEP_SINCE_TRUNCATION =
  " Next step: widen --since to include rename history before the window.";
const NEXT_STEP_FUNCTION_OVERLAP =
  " Next step: treat function ranks cautiously after moves; prefer file mode or a wider --since window.";

/** Stable message prefixes for RENAME_HISTORY_INCOMPLETE sub-kind classification. */
export const RENAME_AMBIGUOUS_PREFIX = "Rename history may be incomplete for:";
export const RENAME_UNLINKED_PREFIX =
  "Suspected unlinked rename (no git rename metadata):";
export const RENAME_UNLINKED_REMAINDER_PREFIX = "... and ";
export const RENAME_SINCE_TRUNCATION_PREFIX =
  "Rename history before the --since window";

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
      `${RENAME_AMBIGUOUS_PREFIX} ${path}${NEXT_STEP_AMBIGUOUS}`,
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
      `${RENAME_UNLINKED_PREFIX} ${from} -> ${to}${NEXT_STEP_UNLINKED}`,
    );
  }

  const remaining = pairs.length - Math.min(pairs.length, maxPairs);
  if (remaining > 0) {
    warnings.push(
      `${RENAME_UNLINKED_REMAINDER_PREFIX}${remaining} more suspected unlinked rename${remaining === 1 ? "" : "s"}${NEXT_STEP_UNLINKED}`,
    );
  }

  return warnings;
}

export function formatSinceTruncationWarning(since: string): string {
  return `${RENAME_SINCE_TRUNCATION_PREFIX} (${since}) may be missing under canonical paths${NEXT_STEP_SINCE_TRUNCATION}`;
}

export function formatFunctionPostRenameOverlapWarning(): string {
  return (
    "Function churn overlap uses current [line, endLine] ranges against historical hunks; " +
    "confidence may be reduced after renames or moves" +
    NEXT_STEP_FUNCTION_OVERLAP
  );
}

const ELIGIBLE_EXTENSION_SET = new Set<string>(ELIGIBLE_EXTENSIONS);

function basename(filePath: string): string {
  const slash = filePath.lastIndexOf("/");
  return slash === -1 ? filePath : filePath.slice(slash + 1);
}

function extension(filePath: string): string {
  const base = basename(filePath);
  const dot = base.lastIndexOf(".");
  return dot === -1 ? "" : base.slice(dot);
}

function stem(filePath: string): string {
  const base = basename(filePath);
  const dot = base.lastIndexOf(".");
  return dot === -1 ? base : base.slice(0, dot);
}

function parentDirName(filePath: string): string {
  const slash = filePath.lastIndexOf("/");
  if (slash === -1) {
    return "";
  }
  const parent = filePath.slice(0, slash);
  const parentSlash = parent.lastIndexOf("/");
  return parentSlash === -1 ? parent : parent.slice(parentSlash + 1);
}

/** Strengthened relatedness per M50 design (basename / stem+ext / parent leaf). */
export function pathsLookLikeRename(a: string, b: string): boolean {
  if (a === b) {
    return false;
  }

  const baseA = basename(a);
  const baseB = basename(b);

  if (baseA === baseB) {
    return true;
  }

  const extA = extension(a);
  const extB = extension(b);
  if (
    stem(a) === stem(b) &&
    ELIGIBLE_EXTENSION_SET.has(extA) &&
    ELIGIBLE_EXTENSION_SET.has(extB)
  ) {
    return true;
  }

  if (baseA === baseB && parentDirName(a) === parentDirName(b)) {
    return true;
  }

  return false;
}

function isDeletedCandidate(file: ParsedFileChange): boolean {
  return file.additions === 0 && file.deletions !== null && file.deletions > 0;
}

function isAddedCandidate(file: ParsedFileChange): boolean {
  return file.additions !== null && file.additions > 0 && file.deletions === 0;
}

/** Deterministic greedy pairing: sorted deletes, first unused related add. */
export function pairUnlinkedRenames(
  deleted: string[],
  added: string[],
): Array<{ from: string; to: string }> {
  const sortedDeleted = [...deleted].sort();
  const sortedAdded = [...added].sort();
  const usedAdded = new Set<string>();
  const pairs: Array<{ from: string; to: string }> = [];

  for (const from of sortedDeleted) {
    for (const to of sortedAdded) {
      if (usedAdded.has(to)) {
        continue;
      }
      if (!pathsLookLikeRename(from, to)) {
        continue;
      }
      usedAdded.add(to);
      pairs.push({ from, to });
      break;
    }
  }

  return pairs;
}

export function applyHeuristicRenameLinks(
  aliasMap: PathAliasMap,
  pairs: Array<{ from: string; to: string }>,
): void {
  for (const { from, to } of pairs) {
    aliasMap.link(from, to);
  }
}

function linkedPathsFromCommit(commit: ParsedCommit): Set<string> {
  const linkedPaths = new Set<string>();
  for (const file of commit.files) {
    if (file.renameFrom !== undefined) {
      linkedPaths.add(file.renameFrom);
      linkedPaths.add(file.path);
    }
  }
  return linkedPaths;
}

export function detectUnlinkedRenamePairsFromCommit(
  commit: ParsedCommit,
): Array<{ from: string; to: string }> {
  const linkedPaths = linkedPathsFromCommit(commit);

  const deleted = commit.files
    .filter((file) => isDeletedCandidate(file) && !linkedPaths.has(file.path))
    .map((file) => file.path);
  const added = commit.files
    .filter((file) => isAddedCandidate(file) && !linkedPaths.has(file.path))
    .map((file) => file.path);

  return pairUnlinkedRenames(deleted, added);
}

export function recordBlindSpotsFromCommit(
  commit: ParsedCommit,
  signals: RenameBlindSpotSignals,
): void {
  for (const file of commit.files) {
    if (file.renameFrom !== undefined) {
      signals.renameLinkCount += 1;
    }
  }

  const seen = new Set(
    signals.unlinkedSuspectedRenames.map((pair) => `${pair.from}\0${pair.to}`),
  );

  for (const pair of detectUnlinkedRenamePairsFromCommit(commit)) {
    const key = `${pair.from}\0${pair.to}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    signals.unlinkedSuspectedRenames.push(pair);
  }
}
