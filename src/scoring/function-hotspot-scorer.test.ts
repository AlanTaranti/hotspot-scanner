import { describe, expect, it } from "vitest";
import type {
  FunctionChangeStats,
  FunctionComplexityResult,
} from "../types/index.js";
import { functionStatsKey } from "../git/function-churn/keys.js";
import { scoreFunctionHotspots } from "./function-hotspot-scorer.js";

function makeFunctionStats(
  fn: Pick<FunctionComplexityResult, "filePath" | "functionName" | "line"> & {
    commitCount: number;
    linesChanged?: number;
    authorCount?: number;
  },
): [string, FunctionChangeStats] {
  const key = functionStatsKey(fn.filePath, fn.functionName, fn.line);
  return [
    key,
    {
      filePath: fn.filePath,
      functionName: fn.functionName,
      line: fn.line,
      commitCount: fn.commitCount,
      linesChanged: fn.linesChanged ?? 100,
      authors: new Set(
        Array.from({ length: fn.authorCount ?? 2 }, (_, i) => `author${i}`),
      ),
    },
  ];
}

function makeFunction(
  overrides: Partial<FunctionComplexityResult> &
    Pick<FunctionComplexityResult, "filePath">,
): FunctionComplexityResult {
  return {
    functionName: "fn",
    line: 1,
    endLine: 10,
    complexity: 1,
    ...overrides,
  };
}

describe("scoreFunctionHotspots", () => {
  it("returns empty array when no functions provided", () => {
    expect(scoreFunctionHotspots(new Map(), [])).toEqual([]);
  });

  it("scores functions with per-function churn and harmonic combiner", () => {
    const fnA = makeFunction({
      filePath: "src/a.ts",
      functionName: "hot",
      line: 10,
      endLine: 20,
      complexity: 20,
    });
    const fnB = makeFunction({
      filePath: "src/b.ts",
      functionName: "cold",
      line: 5,
      endLine: 15,
      complexity: 2,
    });
    const functionStats = new Map([
      makeFunctionStats({
        filePath: "src/a.ts",
        functionName: "hot",
        line: 10,
        commitCount: 10,
      }),
      makeFunctionStats({
        filePath: "src/b.ts",
        functionName: "cold",
        line: 5,
        commitCount: 2,
      }),
    ]);
    const functions: FunctionComplexityResult[] = [fnA, fnB];

    const scores = scoreFunctionHotspots(functionStats, functions);

    expect(scores).toHaveLength(2);
    expect(scores[0]!.filePath).toBe("src/a.ts");
    expect(scores[0]!.functionName).toBe("hot");
    expect(scores[0]!.commitCount).toBe(10);
    expect(scores[0]!.linesChanged).toBe(100);
    expect(scores[0]!.authorCount).toBe(2);
    expect(scores[0]!.hotspotScore).toBeGreaterThan(scores[1]!.hotspotScore);
  });

  it("returns hotspotScore 0 when c + h === 0", () => {
    const functions = [
      makeFunction({ filePath: "src/zero.ts", complexity: 0 }),
    ];

    const scores = scoreFunctionHotspots(new Map(), functions);

    expect(scores[0]).toMatchObject({
      hotspotScore: 0,
      commitCount: 0,
      linesChanged: 0,
      authorCount: 0,
    });
  });

  it("defaults git fields to 0 when function has no churn entry", () => {
    const functions = [
      makeFunction({ filePath: "src/missing.ts", complexity: 5 }),
    ];

    const scores = scoreFunctionHotspots(new Map(), functions);

    expect(scores[0]).toMatchObject({
      commitCount: 0,
      linesChanged: 0,
      authorCount: 0,
    });
  });

  it("sorts by hotspotScore desc, then filePath asc, then line asc", () => {
    const functionStats = new Map([
      makeFunctionStats({
        filePath: "src/b.ts",
        functionName: "b1",
        line: 20,
        commitCount: 5,
      }),
      makeFunctionStats({
        filePath: "src/a.ts",
        functionName: "a2",
        line: 30,
        commitCount: 5,
      }),
      makeFunctionStats({
        filePath: "src/a.ts",
        functionName: "a1",
        line: 10,
        commitCount: 5,
      }),
    ]);
    const functions: FunctionComplexityResult[] = [
      makeFunction({
        filePath: "src/b.ts",
        functionName: "b1",
        line: 20,
        endLine: 30,
        complexity: 5,
      }),
      makeFunction({
        filePath: "src/a.ts",
        functionName: "a2",
        line: 30,
        endLine: 40,
        complexity: 5,
      }),
      makeFunction({
        filePath: "src/a.ts",
        functionName: "a1",
        line: 10,
        endLine: 20,
        complexity: 5,
      }),
    ];

    const scores = scoreFunctionHotspots(functionStats, functions);

    expect(scores.map((score) => `${score.filePath}:${score.line}`)).toEqual([
      "src/a.ts:10",
      "src/a.ts:30",
      "src/b.ts:20",
    ]);
  });

  it("allows divergent churn for siblings in the same file", () => {
    const functionStats = new Map([
      makeFunctionStats({
        filePath: "src/shared.ts",
        functionName: "one",
        line: 1,
        commitCount: 3,
      }),
      makeFunctionStats({
        filePath: "src/shared.ts",
        functionName: "two",
        line: 10,
        commitCount: 9,
      }),
    ]);
    const functions: FunctionComplexityResult[] = [
      makeFunction({
        filePath: "src/shared.ts",
        functionName: "one",
        line: 1,
        endLine: 8,
        complexity: 3,
      }),
      makeFunction({
        filePath: "src/shared.ts",
        functionName: "two",
        line: 10,
        endLine: 20,
        complexity: 8,
      }),
    ];

    const scores = scoreFunctionHotspots(functionStats, functions);

    expect(scores[0]!.commitCount).toBe(9);
    expect(scores[1]!.commitCount).toBe(3);
    expect(scores[0]!.churnNormalized).not.toBe(scores[1]!.churnNormalized);
  });
});
