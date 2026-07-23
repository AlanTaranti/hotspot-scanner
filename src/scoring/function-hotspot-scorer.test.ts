import { describe, expect, it } from "vitest";
import type { FileChangeStats, FunctionComplexityResult } from "../types/index.js";
import { scoreFunctionHotspots } from "./function-hotspot-scorer.js";

function makeStats(
  filePath: string,
  commitCount: number,
  linesChanged = 100,
  authorCount = 2,
): [string, FileChangeStats] {
  return [
    filePath,
    {
      filePath,
      commitCount,
      linesChanged,
      authors: new Set(Array.from({ length: authorCount }, (_, i) => `author${i}`)),
      lastModified: new Date("2026-01-01"),
    },
  ];
}

function makeFunction(
  overrides: Partial<FunctionComplexityResult> & Pick<FunctionComplexityResult, "filePath">,
): FunctionComplexityResult {
  return {
    functionName: "fn",
    line: 1,
    complexity: 1,
    ...overrides,
  };
}

describe("scoreFunctionHotspots", () => {
  it("returns empty array when no functions provided", () => {
    expect(scoreFunctionHotspots(new Map(), [])).toEqual([]);
  });

  it("scores functions with inherited file churn and harmonic combiner", () => {
    const fileStats = new Map([
      makeStats("src/a.ts", 10),
      makeStats("src/b.ts", 2),
    ]);
    const functions: FunctionComplexityResult[] = [
      makeFunction({ filePath: "src/a.ts", functionName: "hot", line: 10, complexity: 20 }),
      makeFunction({ filePath: "src/b.ts", functionName: "cold", line: 5, complexity: 2 }),
    ];

    const scores = scoreFunctionHotspots(fileStats, functions);

    expect(scores).toHaveLength(2);
    expect(scores[0]!.filePath).toBe("src/a.ts");
    expect(scores[0]!.functionName).toBe("hot");
    expect(scores[0]!.commitCount).toBe(10);
    expect(scores[0]!.linesChanged).toBe(100);
    expect(scores[0]!.authorCount).toBe(2);
    expect(scores[0]!.hotspotScore).toBeGreaterThan(scores[1]!.hotspotScore);
  });

  it("returns hotspotScore 0 when c + h === 0", () => {
    const fileStats = new Map<string, FileChangeStats>();
    const functions = [
      makeFunction({ filePath: "src/zero.ts", complexity: 0 }),
    ];

    const scores = scoreFunctionHotspots(fileStats, functions);

    expect(scores[0]).toMatchObject({
      hotspotScore: 0,
      commitCount: 0,
      linesChanged: 0,
      authorCount: 0,
    });
  });

  it("defaults git fields to 0 when parent file has no fileStats entry", () => {
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
    const fileStats = new Map([
      makeStats("src/b.ts", 5),
      makeStats("src/a.ts", 5),
    ]);
    const functions: FunctionComplexityResult[] = [
      makeFunction({ filePath: "src/b.ts", functionName: "b1", line: 20, complexity: 5 }),
      makeFunction({ filePath: "src/a.ts", functionName: "a2", line: 30, complexity: 5 }),
      makeFunction({ filePath: "src/a.ts", functionName: "a1", line: 10, complexity: 5 }),
    ];

    const scores = scoreFunctionHotspots(fileStats, functions);

    expect(scores.map((score) => `${score.filePath}:${score.line}`)).toEqual([
      "src/a.ts:10",
      "src/a.ts:30",
      "src/b.ts:20",
    ]);
  });

  it("inherits identical churn for functions in the same file", () => {
    const fileStats = new Map([makeStats("src/shared.ts", 7)]);
    const functions: FunctionComplexityResult[] = [
      makeFunction({ filePath: "src/shared.ts", functionName: "one", line: 1, complexity: 3 }),
      makeFunction({ filePath: "src/shared.ts", functionName: "two", line: 10, complexity: 8 }),
    ];

    const scores = scoreFunctionHotspots(fileStats, functions);

    expect(scores[0]!.commitCount).toBe(7);
    expect(scores[1]!.commitCount).toBe(7);
    expect(scores[0]!.churnNormalized).toBe(scores[1]!.churnNormalized);
  });
});
