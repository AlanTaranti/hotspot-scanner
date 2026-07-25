import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PathAliasMap } from "../rename.js";
import {
  aggregatePatchCommit,
  createFunctionChurnAccumulators,
  finalizeFunctionStats,
  functionsIntersectingHunk,
  indexFunctionsByFile,
} from "./aggregate.js";
import { functionStatsKey } from "./keys.js";
import {
  hunkIntersectsFunction,
  parsePatchLogStream,
  type ParsedPatchHunk,
} from "./parse.js";
import type { FunctionComplexityResult } from "../../types/index.js";

const fixtureDir = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../tests/fixtures/git-patch",
);

async function linesFromFixture(name: string): Promise<string[]> {
  const text = await readFile(join(fixtureDir, name), "utf8");
  return text.split("\n").filter((line, index, all) => {
    if (index === all.length - 1 && line === "") {
      return false;
    }
    return true;
  });
}

async function* asyncLines(lines: string[]): AsyncGenerator<string> {
  for (const line of lines) {
    yield line;
  }
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

function bruteForceIntersectingFunctions(
  functions: FunctionComplexityResult[],
  hunk: ParsedPatchHunk,
): FunctionComplexityResult[] {
  return functions.filter((fn) =>
    hunkIntersectsFunction(hunk, fn.line, fn.endLine),
  );
}

function makeFunction(
  name: string,
  line: number,
  endLine: number,
): FunctionComplexityResult {
  return {
    filePath: "src/example.ts",
    functionName: name,
    line,
    endLine,
    complexity: 1,
  };
}

describe("functionsIntersectingHunk", () => {
  it("matches brute-force oracle for nested, adjacent, and non-overlap ranges", () => {
    const functions = [
      makeFunction("outer", 1, 20),
      makeFunction("inner", 5, 10),
      makeFunction("adjacentBefore", 1, 4),
      makeFunction("adjacentAfter", 11, 15),
      makeFunction("farAway", 30, 40),
    ];
    const sorted = sortFunctionsByLine(functions);

    const cases: ParsedPatchHunk[] = [
      { newLinesTouched: new Set([7]), linesChanged: 2 },
      { newLinesTouched: new Set([4]), linesChanged: 1 },
      { newLinesTouched: new Set([25]), linesChanged: 1 },
      { newLinesTouched: new Set([5, 6, 7]), linesChanged: 3 },
    ];

    for (const hunk of cases) {
      const indexed = functionsIntersectingHunk(sorted, hunk);
      const brute = bruteForceIntersectingFunctions(functions, hunk);
      expect(indexed.map((fn) => fn.functionName).sort()).toEqual(
        brute.map((fn) => fn.functionName).sort(),
      );
    }
  });

  it("returns empty array when hunk has no touched lines", () => {
    const sorted = sortFunctionsByLine([makeFunction("only", 1, 10)]);
    expect(
      functionsIntersectingHunk(sorted, {
        newLinesTouched: new Set(),
        linesChanged: 0,
      }),
    ).toEqual([]);
  });
});

describe("aggregatePatchCommit interval index", () => {
  async function aggregateFromLines(
    lines: string[],
    functions: FunctionComplexityResult[],
  ) {
    const commits = [];
    for await (const commit of parsePatchLogStream(asyncLines(lines))) {
      commits.push(commit);
    }

    const functionsByFile = indexFunctionsByFile(functions);
    const accumulators = createFunctionChurnAccumulators();
    const aliasMap = new PathAliasMap();

    for (const commit of commits) {
      aggregatePatchCommit(commit, functionsByFile, aliasMap, accumulators);
    }

    return finalizeFunctionStats(accumulators);
  }

  it("attributes commits to overlapping functions only (fixture)", async () => {
    const lines = await linesFromFixture("overlap-sample.txt");
    const functions = [
      makeFunction("outer", 1, 10),
      { ...makeFunction("inner", 11, 20), filePath: "src/example.ts" },
    ];

    const stats = await aggregateFromLines(lines, functions);
    const outerKey = functionStatsKey("src/example.ts", "outer", 1);
    const innerKey = functionStatsKey("src/example.ts", "inner", 11);

    expect(stats.get(outerKey)?.commitCount).toBe(1);
    expect(stats.get(outerKey)?.authors).toEqual(new Set(["Alice"]));
    expect(stats.get(innerKey)?.commitCount).toBe(1);
    expect(stats.get(innerKey)?.authors).toEqual(new Set(["Bob"]));
  });

  it("credits nested functions when a hunk intersects both ranges", async () => {
    const lines = [
      "COMMIT|ccc333|2024-01-03T00:00:00Z|Carol",
      "diff --git a/src/nested.ts b/src/nested.ts",
      "@@ -3 +3 @@",
      "-x",
      "+y",
    ];

    const functions = [
      { ...makeFunction("outer", 1, 10), filePath: "src/nested.ts" },
      { ...makeFunction("inner", 2, 5), filePath: "src/nested.ts" },
    ];

    const stats = await aggregateFromLines(lines, functions);

    expect(
      stats.get(functionStatsKey("src/nested.ts", "outer", 1))?.commitCount,
    ).toBe(1);
    expect(
      stats.get(functionStatsKey("src/nested.ts", "inner", 2))?.commitCount,
    ).toBe(1);
    expect(
      stats.get(functionStatsKey("src/nested.ts", "outer", 1))?.linesChanged,
    ).toBe(2);
    expect(
      stats.get(functionStatsKey("src/nested.ts", "inner", 2))?.linesChanged,
    ).toBe(2);
  });

  it("attributes adjacent non-overlapping functions independently", async () => {
    const lines = [
      "COMMIT|add001|2024-01-04T00:00:00Z|Dana",
      "diff --git a/src/adjacent.ts b/src/adjacent.ts",
      "@@ -3 +3 @@",
      "-a",
      "+b",
      "@@ -12 +12 @@",
      "-c",
      "+d",
    ];

    const functions = [
      { ...makeFunction("first", 1, 5), filePath: "src/adjacent.ts" },
      { ...makeFunction("second", 10, 15), filePath: "src/adjacent.ts" },
    ];

    const stats = await aggregateFromLines(lines, functions);
    const firstKey = functionStatsKey("src/adjacent.ts", "first", 1);
    const secondKey = functionStatsKey("src/adjacent.ts", "second", 10);

    expect(stats.get(firstKey)?.commitCount).toBe(1);
    expect(stats.get(secondKey)?.commitCount).toBe(1);
    expect(stats.get(firstKey)?.linesChanged).toBe(2);
    expect(stats.get(secondKey)?.linesChanged).toBe(2);
  });

  it("does not credit functions with no hunk overlap", async () => {
    const lines = [
      "COMMIT|0ee001|2024-01-05T00:00:00Z|Eve",
      "diff --git a/src/miss.ts b/src/miss.ts",
      "@@ -20 +20 @@",
      "-old",
      "+new",
    ];

    const functions = [
      { ...makeFunction("before", 1, 5), filePath: "src/miss.ts" },
      { ...makeFunction("after", 30, 40), filePath: "src/miss.ts" },
    ];

    const stats = await aggregateFromLines(lines, functions);

    expect(stats.size).toBe(0);
  });

  it("sums full hunk line deltas across multiple hunks for one function", async () => {
    const lines = [
      "COMMIT|bad001|2024-01-06T00:00:00Z|Frank",
      "diff --git a/src/multi.ts b/src/multi.ts",
      "@@ -2 +2 @@",
      "-a",
      "+A",
      "@@ -8 +8 @@",
      "-b",
      "+B",
    ];

    const functions = [
      { ...makeFunction("spanning", 1, 15), filePath: "src/multi.ts" },
    ];

    const stats = await aggregateFromLines(lines, functions);
    const key = functionStatsKey("src/multi.ts", "spanning", 1);

    expect(stats.get(key)?.commitCount).toBe(1);
    expect(stats.get(key)?.linesChanged).toBe(4);
  });

  it("attributes hunks when functions share a start line but differ in end line", async () => {
    const lines = [
      "COMMIT|aae001|2024-01-07T00:00:00Z|Gina",
      "diff --git a/src/same-line.ts b/src/same-line.ts",
      "@@ -6 +6 @@",
      "-x",
      "+y",
    ];

    const functions = [
      { ...makeFunction("narrow", 5, 8), filePath: "src/same-line.ts" },
      { ...makeFunction("wide", 5, 15), filePath: "src/same-line.ts" },
    ];

    const stats = await aggregateFromLines(lines, functions);

    expect(
      stats.get(functionStatsKey("src/same-line.ts", "narrow", 5))?.commitCount,
    ).toBe(1);
    expect(
      stats.get(functionStatsKey("src/same-line.ts", "wide", 5))?.commitCount,
    ).toBe(1);
  });

  it("does not double-count linesChanged when the same commit is aggregated twice", async () => {
    const lines = [
      "COMMIT|deadbeef01|2024-01-08T00:00:00Z|Hank",
      "diff --git a/src/replay.ts b/src/replay.ts",
      "@@ -1 +1 @@",
      "-a",
      "+b",
    ];

    const commits = [];
    for await (const commit of parsePatchLogStream(asyncLines(lines))) {
      commits.push(commit);
    }

    const functions = [{ ...makeFunction("fn", 1, 10), filePath: "src/replay.ts" }];
    const functionsByFile = indexFunctionsByFile(functions);
    const accumulators = createFunctionChurnAccumulators();
    const aliasMap = new PathAliasMap();
    const commit = commits[0]!;

    aggregatePatchCommit(commit, functionsByFile, aliasMap, accumulators);
    aggregatePatchCommit(commit, functionsByFile, aliasMap, accumulators);

    const stats = finalizeFunctionStats(accumulators);
    const key = functionStatsKey("src/replay.ts", "fn", 1);

    expect(stats.get(key)?.commitCount).toBe(1);
    expect(stats.get(key)?.linesChanged).toBe(2);
  });
});
