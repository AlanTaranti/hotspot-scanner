import type {
  FunctionChangeStats,
  FunctionComplexityResult,
} from "../../types/index.js";
import { PathAliasMap } from "../rename.js";
import { functionStatsKey } from "./keys.js";
import type { ParsedPatchCommit, ParsedPatchHunk } from "./parse.js";
import { hunkIntersectsFunction } from "./parse.js";

interface FunctionAccumulator {
  stats: FunctionChangeStats;
  commits: Set<string>;
}

function getOrCreateAccumulator(
  accumulators: Map<string, FunctionAccumulator>,
  fn: FunctionComplexityResult,
): FunctionAccumulator {
  const key = functionStatsKey(fn.filePath, fn.functionName, fn.line);
  let entry = accumulators.get(key);
  if (entry === undefined) {
    entry = {
      stats: {
        filePath: fn.filePath,
        functionName: fn.functionName,
        line: fn.line,
        commitCount: 0,
        linesChanged: 0,
        authors: new Set<string>(),
      },
      commits: new Set<string>(),
    };
    accumulators.set(key, entry);
  }
  return entry;
}

export function indexFunctionsByFile(
  functions: FunctionComplexityResult[],
): Map<string, FunctionComplexityResult[]> {
  const byFile = new Map<string, FunctionComplexityResult[]>();
  for (const fn of functions) {
    const list = byFile.get(fn.filePath) ?? [];
    list.push(fn);
    byFile.set(fn.filePath, list);
  }
  return byFile;
}

function sortFunctionsByLine(
  functions: FunctionComplexityResult[],
): FunctionComplexityResult[] {
  return [...functions].sort((a, b) => {
    if (a.line !== b.line) {
      return a.line - b.line;
    }
    if (a.endLine !== b.endLine) {
      return a.endLine - b.endLine;
    }
    return a.functionName.localeCompare(b.functionName);
  });
}

function hunkLineSpan(hunk: ParsedPatchHunk): { start: number; end: number } {
  let start = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;
  for (const line of hunk.newLinesTouched) {
    if (line < start) {
      start = line;
    }
    if (line > end) {
      end = line;
    }
  }
  return { start, end };
}

function lowerBoundByEndLine(
  sortedFns: FunctionComplexityResult[],
  hunkStart: number,
): number {
  let lo = 0;
  let hi = sortedFns.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sortedFns[mid]!.endLine < hunkStart) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

export function functionsIntersectingHunk(
  sortedFns: FunctionComplexityResult[],
  hunk: ParsedPatchHunk,
): FunctionComplexityResult[] {
  const { start: hunkStart, end: hunkEnd } = hunkLineSpan(hunk);
  if (!Number.isFinite(hunkStart)) {
    return [];
  }

  const matches: FunctionComplexityResult[] = [];
  const startIdx = lowerBoundByEndLine(sortedFns, hunkStart);
  for (let i = startIdx; i < sortedFns.length; i++) {
    const fn = sortedFns[i]!;
    if (fn.line > hunkEnd) {
      break;
    }
    if (hunkIntersectsFunction(hunk, fn.line, fn.endLine)) {
      matches.push(fn);
    }
  }
  return matches;
}

export function aggregatePatchCommit(
  commit: ParsedPatchCommit,
  functionsByFile: Map<string, FunctionComplexityResult[]>,
  aliasMap: PathAliasMap,
  accumulators: Map<string, FunctionAccumulator>,
): void {
  for (const file of commit.files) {
    if (file.renameFrom !== undefined) {
      aliasMap.link(file.renameFrom, file.path);
    }

    const canonicalPath = aliasMap.canonical(file.path);
    const functions = functionsByFile.get(canonicalPath);
    if (functions === undefined || functions.length === 0) {
      continue;
    }

    const sortedFunctions = sortFunctionsByLine(functions);
    const attributedFns = new Set<FunctionComplexityResult>();

    for (const hunk of file.hunks) {
      for (const fn of functionsIntersectingHunk(sortedFunctions, hunk)) {
        const entry = getOrCreateAccumulator(accumulators, fn);
        if (entry.commits.has(commit.hash)) {
          continue;
        }
        attributedFns.add(fn);
        entry.stats.linesChanged += hunk.linesChanged;
      }
    }

    for (const fn of attributedFns) {
      const entry = getOrCreateAccumulator(accumulators, fn);
      if (!entry.commits.has(commit.hash)) {
        entry.commits.add(commit.hash);
        entry.stats.commitCount += 1;
        entry.stats.authors.add(commit.author);
      }
    }
  }
}

export function finalizeFunctionStats(
  accumulators: Map<string, FunctionAccumulator>,
): Map<string, FunctionChangeStats> {
  const result = new Map<string, FunctionChangeStats>();
  for (const [key, entry] of accumulators) {
    result.set(key, entry.stats);
  }
  return result;
}

export function createFunctionChurnAccumulators(): Map<
  string,
  FunctionAccumulator
> {
  return new Map();
}

export type { FunctionAccumulator };
