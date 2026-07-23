import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeBatch } from "./analyze-batch.js";
import {
  createComplexityAnalyzer,
  DEFAULT_BATCH_SIZE,
  type ComplexityAnalyzerResult,
} from "./index.js";

const fixtureDir = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../tests/fixtures/complexity",
);

function findResult(
  results: Array<{ filePath: string }>,
  fileName: string,
) {
  return results.find((result) => result.filePath.endsWith(fileName));
}

describe("createComplexityAnalyzer", () => {
  let tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs = [];
  });

  async function createTempRepo(files: Record<string, string>) {
    const dir = await mkdtemp(join(tmpdir(), "complexity-test-"));
    tempDirs.push(dir);
    for (const [relativePath, content] of Object.entries(files)) {
      const filePath = join(dir, relativePath);
      await writeFile(filePath, content, "utf8");
    }
    return dir;
  }

  it("analyzes fixture files and returns results with warnings for invalid syntax", async () => {
    const analyzer = createComplexityAnalyzer();
    const { results, warnings } = await analyzer.analyze({ repoPath: fixtureDir });

    expect(findResult(results, "if-else.ts")).toEqual({
      filePath: "if-else.ts",
      functionCount: 1,
      cyclomaticComplexity: 3,
    });
    expect(findResult(results, "switch.ts")).toEqual({
      filePath: "switch.ts",
      functionCount: 1,
      cyclomaticComplexity: 5,
    });
    expect(findResult(results, "loops.ts")).toEqual({
      filePath: "loops.ts",
      functionCount: 1,
      cyclomaticComplexity: 4,
    });
    expect(findResult(results, "try-catch.ts")).toEqual({
      filePath: "try-catch.ts",
      functionCount: 1,
      cyclomaticComplexity: 2,
    });
    expect(findResult(results, "logical-ops.ts")).toEqual({
      filePath: "logical-ops.ts",
      functionCount: 1,
      cyclomaticComplexity: 4,
    });
    expect(findResult(results, "ternary.ts")).toEqual({
      filePath: "ternary.ts",
      functionCount: 1,
      cyclomaticComplexity: 2,
    });
    expect(findResult(results, "nested.ts")).toEqual({
      filePath: "nested.ts",
      functionCount: 2,
      cyclomaticComplexity: 3,
    });
    expect(findResult(results, "empty.ts")).toEqual({
      filePath: "empty.ts",
      functionCount: 0,
      cyclomaticComplexity: 0,
    });

    expect(findResult(results, "invalid-syntax.ts")).toBeUndefined();
    expect(warnings.some((warning) => warning.includes("invalid-syntax.ts"))).toBe(
      true,
    );
  });

  it("throws when repoPath is invalid", async () => {
    const analyzer = createComplexityAnalyzer();

    await expect(
      analyzer.analyze({ repoPath: "/path/that/does/not/exist" }),
    ).rejects.toThrow(/repoPath/);
  });

  it("calls discoverSourceFiles once before worker pool dispatch", async () => {
    const callOrder: string[] = [];
    const discoverSourceFiles = vi.fn(async () => {
      callOrder.push("discover");
      return ["a.ts"];
    });
    const createWorkerPool = vi.fn(() => {
      callOrder.push("pool");
      return {
        runBatches: vi.fn(async () => [
          {
            results: [
              {
                filePath: "a.ts",
                cyclomaticComplexity: 1,
                functionCount: 0,
              },
            ],
            functions: [],
            warnings: [],
          },
        ]),
      };
    });

    const analyzer = createComplexityAnalyzer({
      discoverSourceFiles,
      createWorkerPool,
    });

    await analyzer.analyze({ repoPath: fixtureDir });

    expect(discoverSourceFiles).toHaveBeenCalledTimes(1);
    expect(createWorkerPool).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(["discover", "pool"]);
  });

  it("uses injected createWorkerPool when provided", async () => {
    const runBatches = vi.fn(async () => [
      { results: [], functions: [], warnings: [] },
    ]);
    const createWorkerPool = vi.fn(() => ({ runBatches }));

    const analyzer = createComplexityAnalyzer({
      discoverSourceFiles: async () => ["a.ts"],
      createWorkerPool,
      concurrency: 3,
    });

    await analyzer.analyze({ repoPath: fixtureDir });

    expect(createWorkerPool).toHaveBeenCalledWith({ concurrency: 1 });
    expect(runBatches).toHaveBeenCalled();
  });

  it("returns empty result without spawning workers for zero files", async () => {
    const createWorkerPool = vi.fn(() => ({
      runBatches: vi.fn(async () => []),
    }));

    const analyzer = createComplexityAnalyzer({
      discoverSourceFiles: async () => [],
      createWorkerPool,
    });

    const result = await analyzer.analyze({ repoPath: fixtureDir });

    expect(result).toEqual({
      results: [],
      functions: [],
      warnings: [],
    } satisfies ComplexityAnalyzerResult);
    expect(createWorkerPool).not.toHaveBeenCalled();
  });

  it("produces identical output with concurrency 1 vs higher concurrency", async () => {
    const files: Record<string, string> = {};
    for (let index = 0; index < DEFAULT_BATCH_SIZE + 2; index += 1) {
      files[`file-${String(index).padStart(3, "0")}.ts`] =
        `export const value${index} = ${index};`;
    }
    const repoPath = await createTempRepo(files);

    const sequential = createComplexityAnalyzer({ concurrency: 1 });
    const parallel = createComplexityAnalyzer({ concurrency: 2 });

    const sequentialResult = await sequential.analyze({ repoPath });
    const parallelResult = await parallel.analyze({ repoPath });

    expect(parallelResult).toEqual(sequentialResult);
  });

  it("collects parse failures across multiple batches without throwing", async () => {
    const files: Record<string, string> = {};
    for (let index = 0; index < DEFAULT_BATCH_SIZE + 1; index += 1) {
      const fileName = `file-${String(index).padStart(3, "0")}.ts`;
      if (index === 10 || index === DEFAULT_BATCH_SIZE) {
        files[fileName] = "export const broken = {{{";
      } else {
        files[fileName] = `export const value${index} = ${index};`;
      }
    }

    const repoPath = await createTempRepo(files);
    const analyzer = createComplexityAnalyzer({ concurrency: 2 });
    const { results, warnings } = await analyzer.analyze({ repoPath });

    expect(results).toHaveLength(DEFAULT_BATCH_SIZE + 1 - 2);
    expect(warnings).toHaveLength(2);
    expect(warnings.every((warning) => warning.startsWith("Failed to parse "))).toBe(
      true,
    );
    expect(warnings.some((warning) => warning.includes("file-010.ts"))).toBe(true);
    expect(
      warnings.some((warning) =>
        warning.includes(`file-${String(DEFAULT_BATCH_SIZE).padStart(3, "0")}.ts`),
      ),
    ).toBe(true);
  });

  it("orders merged results by discovery index after parallel batches", async () => {
    const switchResult = await analyzeBatch({
      repoPath: fixtureDir,
      batch: ["switch.ts"],
    });
    const ifElseResult = await analyzeBatch({
      repoPath: fixtureDir,
      batch: ["if-else.ts"],
    });
    const runBatches = vi.fn(async () => [ifElseResult, switchResult]);
    const createWorkerPool = vi.fn(() => ({ runBatches }));
    const discoverSourceFiles = vi.fn(async () => ["switch.ts", "if-else.ts"]);

    const analyzer = createComplexityAnalyzer({
      discoverSourceFiles,
      createWorkerPool,
      concurrency: 2,
    });

    const { results } = await analyzer.analyze({ repoPath: fixtureDir });

    expect(runBatches).toHaveBeenCalled();
    expect(results.map((result) => result.filePath)).toEqual([
      "switch.ts",
      "if-else.ts",
    ]);
  });
});
