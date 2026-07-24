import type {
  FunctionChangeStats,
  FunctionComplexityResult,
} from "../../types/index.js";
import { PathAliasMap } from "../rename.js";
import { functionStatsKey } from "./keys.js";
import type { ParsedPatchCommit } from "./parse.js";
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

    for (const fn of functions) {
      let attributed = false;
      for (const hunk of file.hunks) {
        if (!hunkIntersectsFunction(hunk, fn.line, fn.endLine)) {
          continue;
        }
        attributed = true;
        const entry = getOrCreateAccumulator(accumulators, fn);
        entry.stats.linesChanged += hunk.linesChanged;
      }

      if (attributed) {
        const entry = getOrCreateAccumulator(accumulators, fn);
        if (!entry.commits.has(commit.hash)) {
          entry.commits.add(commit.hash);
          entry.stats.commitCount += 1;
          entry.stats.authors.add(commit.author);
        }
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
