import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeBatch } from "./analyze-batch.js";
import { discoverSourceFiles } from "./discover.js";
import {
  createComplexityAnalyzer,
  DEFAULT_BATCH_SIZE,
  type ComplexityAnalyzerResult,
} from "./index.js";

const fixtureDir = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../tests/fixtures/complexity",
);

async function discoverFixtureFiles(repoPath: string): Promise<string[]> {
  return discoverSourceFiles(repoPath, undefined, {
    listTrackedFiles: async () => {
      throw new Error("walk fixture directory");
    },
  });
}

function findResult(results: Array<{ filePath: string }>, fileName: string) {
  return results.find((result) => result.filePath.endsWith(fileName));
}

describe("createComplexityAnalyzer", () => {
  let tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.map((dir) => rm(dir, { recursive: true, force: true })),
    );
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

  it("analyzes fixture files and returns NCLOC results without warnings", async () => {
    const analyzer = createComplexityAnalyzer({
      discoverSourceFiles: discoverFixtureFiles,
    });
    const { results, warnings } = await analyzer.analyze({
      repoPath: fixtureDir,
    });

    expect(findResult(results, "if-else.ts")).toEqual({
      filePath: "if-else.ts",
      ncloc: 9,
    });
    expect(findResult(results, "switch.ts")).toEqual({
      filePath: "switch.ts",
      ncloc: 12,
    });
    expect(findResult(results, "loops.ts")).toEqual({
      filePath: "loops.ts",
      ncloc: 5,
    });
    expect(findResult(results, "try-catch.ts")).toEqual({
      filePath: "try-catch.ts",
      ncloc: 5,
    });
    expect(findResult(results, "logical-ops.ts")).toEqual({
      filePath: "logical-ops.ts",
      ncloc: 3,
    });
    expect(findResult(results, "ternary.ts")).toEqual({
      filePath: "ternary.ts",
      ncloc: 3,
    });
    expect(findResult(results, "nested.ts")).toEqual({
      filePath: "nested.ts",
      ncloc: 9,
    });
    expect(findResult(results, "empty.ts")).toEqual({
      filePath: "empty.ts",
      ncloc: 1,
    });

    expect(findResult(results, "invalid-syntax.ts")).toEqual({
      filePath: "invalid-syntax.ts",
      ncloc: 3,
    });
    expect(warnings).toEqual([]);
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
                ncloc: 1,
              },
            ],
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
      { results: [], warnings: [] },
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
      warnings: [],
    } satisfies ComplexityAnalyzerResult);
    expect(createWorkerPool).not.toHaveBeenCalled();
  });

  it("produces identical output with concurrency 1 vs higher concurrency", async () => {
    const files: Record<string, string> = {};
    for (let index = 0; index < DEFAULT_BATCH_SIZE + 2; index += 1) {
      const fileName = `file-${String(index).padStart(3, "0")}.ts`;
      if (index % 7 === 0) {
        files[fileName] = `export function fn${index}(x: boolean) { return x ? 1 : 0; }`;
      } else {
        files[fileName] = `export const value${index} = ${index};`;
      }
    }
    const repoPath = await createTempRepo(files);

    const sequential = createComplexityAnalyzer({ concurrency: 1 });
    const parallel = createComplexityAnalyzer({ concurrency: 2 });

    const sequentialResult = await sequential.analyze({ repoPath });
    const parallelResult = await parallel.analyze({ repoPath });

    expect(parallelResult.results).toEqual(sequentialResult.results);
    expect(parallelResult.warnings).toEqual(sequentialResult.warnings);
    expect(parallelResult).toEqual(sequentialResult);
  });

  it("collects read failures across multiple batches without throwing", async () => {
    const files: Record<string, string> = {};
    const unreadablePaths: string[] = [];
    for (let index = 0; index < DEFAULT_BATCH_SIZE + 1; index += 1) {
      const fileName = `file-${String(index).padStart(3, "0")}.ts`;
      files[fileName] = `export const value${index} = ${index};`;
    }

    const repoPath = await createTempRepo(files);
    for (const fileName of ["file-010.ts", `file-${String(DEFAULT_BATCH_SIZE).padStart(3, "0")}.ts`]) {
      const absolutePath = join(repoPath, fileName);
      unreadablePaths.push(absolutePath);
      await chmod(absolutePath, 0o000);
    }

    try {
      const analyzer = createComplexityAnalyzer({ concurrency: 2 });
      const { results, warnings } = await analyzer.analyze({ repoPath });

      expect(results).toHaveLength(DEFAULT_BATCH_SIZE + 1 - 2);
      expect(warnings).toHaveLength(2);
      expect(
        warnings.every(
          (warning) =>
            warning.code === "READ_FAILED" &&
            warning.severity === "warning" &&
            warning.message.startsWith("Failed to read "),
        ),
      ).toBe(true);
      expect(
        warnings.some((warning) => warning.message.includes("file-010.ts")),
      ).toBe(true);
      expect(
        warnings.some((warning) =>
          warning.message.includes(
            `file-${String(DEFAULT_BATCH_SIZE).padStart(3, "0")}.ts`,
          ),
        ),
      ).toBe(true);
    } finally {
      await Promise.all(unreadablePaths.map((path) => chmod(path, 0o644)));
    }
  });

  it("produces identical read-failure output for concurrency 1 vs higher concurrency", async () => {
    const files: Record<string, string> = {};
    for (let index = 0; index < DEFAULT_BATCH_SIZE + 1; index += 1) {
      const fileName = `file-${String(index).padStart(3, "0")}.ts`;
      files[fileName] = `export const value${index} = ${index};`;
    }

    const repoPath = await createTempRepo(files);
    const unreadablePaths = [
      join(repoPath, "file-010.ts"),
      join(repoPath, `file-${String(DEFAULT_BATCH_SIZE).padStart(3, "0")}.ts`),
    ];
    await Promise.all(unreadablePaths.map((path) => chmod(path, 0o000)));

    try {
      const sequential = createComplexityAnalyzer({ concurrency: 1 });
      const parallel = createComplexityAnalyzer({ concurrency: 2 });

      const sequentialResult = await sequential.analyze({ repoPath });
      const parallelResult = await parallel.analyze({ repoPath });

      expect(parallelResult.results).toEqual(sequentialResult.results);
      expect(parallelResult.warnings).toEqual(sequentialResult.warnings);
    } finally {
      await Promise.all(unreadablePaths.map((path) => chmod(path, 0o644)));
    }
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

  it("rejects non-existent repoPath", async () => {
    const analyzer = createComplexityAnalyzer();
    await expect(
      analyzer.analyze({ repoPath: "/nonexistent/path/that/does/not/exist" }),
    ).rejects.toThrow("repoPath does not exist or is not accessible");
  });

  it("rejects repoPath that is not a directory", async () => {
    const filePath = await createTempRepo({ "only-file.ts": "export const x = 1;" });
    const analyzer = createComplexityAnalyzer();
    await expect(
      analyzer.analyze({ repoPath: join(filePath, "only-file.ts") }),
    ).rejects.toThrow("repoPath is not a directory");
  });

  it("normalizes legacy string warnings from worker pool output", async () => {
    const runBatches = vi.fn(async () => [
      {
        results: [],
        warnings: ["Failed to read legacy.ts: EACCES"],
      },
    ]);
    const createWorkerPool = vi.fn(() => ({ runBatches }));
    const discoverSourceFiles = vi.fn(async () => ["legacy.ts"]);

    const analyzer = createComplexityAnalyzer({
      discoverSourceFiles,
      createWorkerPool,
    });

    const { warnings } = await analyzer.analyze({ repoPath: fixtureDir });

    expect(warnings).toEqual([
      {
        code: "READ_FAILED",
        severity: "warning",
        message: "Failed to read legacy.ts: EACCES",
      },
    ]);
  });

  it("analyzes only paths in pathAllowlist intersecting discovery", async () => {
    const runBatches = vi.fn(async (_repoPath: string, batches: string[][]) => [
      {
        results: batches[0]!.map((filePath) => ({
          filePath,
          ncloc: 1,
        })),
        warnings: [],
      },
    ]);
    const createWorkerPool = vi.fn(() => ({ runBatches }));
    const discoverSourceFiles = vi.fn(async () => [
      "a.ts",
      "b.ts",
      "c.ts",
    ]);

    const analyzer = createComplexityAnalyzer({
      discoverSourceFiles,
      createWorkerPool,
    });

    const result = await analyzer.analyze({
      repoPath: fixtureDir,
      pathAllowlist: ["b.ts", "missing.ts"],
    });

    expect(discoverSourceFiles).toHaveBeenCalledTimes(1);
    expect(runBatches).toHaveBeenCalledWith(fixtureDir, [["b.ts"]], undefined, undefined);
    expect(result.results.map((entry) => entry.filePath)).toEqual(["b.ts"]);
  });

  it("returns empty result without workers when pathAllowlist intersection is empty", async () => {
    const createWorkerPool = vi.fn(() => ({
      runBatches: vi.fn(async () => []),
    }));
    const discoverSourceFiles = vi.fn(async () => ["a.ts", "b.ts"]);

    const analyzer = createComplexityAnalyzer({
      discoverSourceFiles,
      createWorkerPool,
    });

    const result = await analyzer.analyze({
      repoPath: fixtureDir,
      pathAllowlist: [],
    });

    expect(result).toEqual({
      results: [],
      warnings: [],
    } satisfies ComplexityAnalyzerResult);
    expect(createWorkerPool).not.toHaveBeenCalled();
  });

  it("returns empty result without workers when pathAllowlist has no discovered paths", async () => {
    const createWorkerPool = vi.fn(() => ({
      runBatches: vi.fn(async () => []),
    }));
    const discoverSourceFiles = vi.fn(async () => ["a.ts", "b.ts"]);

    const analyzer = createComplexityAnalyzer({
      discoverSourceFiles,
      createWorkerPool,
    });

    const result = await analyzer.analyze({
      repoPath: fixtureDir,
      pathAllowlist: ["only-not-discovered.ts"],
    });

    expect(result).toEqual({
      results: [],
      warnings: [],
    } satisfies ComplexityAnalyzerResult);
    expect(createWorkerPool).not.toHaveBeenCalled();
  });

  it("sorts warnings with non-standard messages without throwing", async () => {
    const runBatches = vi.fn(async () => [
      {
        results: [],
        warnings: [
          {
            code: "READ_FAILED",
            severity: "warning",
            message: "custom warning without read prefix",
          },
        ],
      },
    ]);
    const createWorkerPool = vi.fn(() => ({ runBatches }));
    const discoverSourceFiles = vi.fn(async () => ["a.ts"]);

    const analyzer = createComplexityAnalyzer({
      discoverSourceFiles,
      createWorkerPool,
    });

    const { warnings } = await analyzer.analyze({ repoPath: fixtureDir });

    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toBe("custom warning without read prefix");
  });

  it("forwards signal to worker pool runBatches", async () => {
    const controller = new AbortController();
    const runBatches = vi.fn(async () => [
      { results: [], warnings: [] },
    ]);
    const createWorkerPool = vi.fn(() => ({ runBatches }));
    const discoverSourceFiles = vi.fn(async () => ["a.ts", "b.ts"]);

    const analyzer = createComplexityAnalyzer({
      discoverSourceFiles,
      createWorkerPool,
      concurrency: 2,
    });

    await analyzer.analyze({
      repoPath: fixtureDir,
      signal: controller.signal,
    });

    expect(runBatches).toHaveBeenCalledWith(
      fixtureDir,
      expect.any(Array),
      controller.signal,
      undefined,
    );
  });

  it("forwards onProgress to worker pool runBatches", async () => {
    const onProgress = vi.fn();
    const runBatches = vi.fn(async () => [
      { results: [], warnings: [] },
    ]);
    const createWorkerPool = vi.fn(() => ({ runBatches }));
    const discoverSourceFiles = vi.fn(async () => ["a.ts", "b.ts"]);

    const analyzer = createComplexityAnalyzer({
      discoverSourceFiles,
      createWorkerPool,
      concurrency: 2,
    });

    await analyzer.analyze({
      repoPath: fixtureDir,
      onProgress,
    });

    expect(runBatches).toHaveBeenCalledWith(
      fixtureDir,
      expect.any(Array),
      undefined,
      onProgress,
    );
  });

  it("emits complexity progress per batch for inline concurrency", async () => {
    const files: Record<string, string> = {};
    for (let index = 0; index < 3; index += 1) {
      files[`file-${index}.ts`] = `export const value${index} = ${index};`;
    }
    const repoPath = await createTempRepo(files);
    const onProgress = vi.fn();
    const analyzer = createComplexityAnalyzer({ concurrency: 1 });

    await analyzer.analyze({ repoPath, onProgress });

    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith({
      phase: "complexity",
      commitsProcessed: 0,
      filesProcessed: 3,
      batchesProcessed: 1,
      totalFiles: 3,
      totalBatches: 1,
    });
  });

  it("emits complexity progress per batch for worker pool concurrency", async () => {
    const files: Record<string, string> = {};
    for (let index = 0; index < DEFAULT_BATCH_SIZE + 2; index += 1) {
      files[`file-${String(index).padStart(3, "0")}.ts`] =
        `export const value${index} = ${index};`;
    }
    const repoPath = await createTempRepo(files);
    const onProgress = vi.fn();
    const analyzer = createComplexityAnalyzer({ concurrency: 2 });

    await analyzer.analyze({ repoPath, onProgress });

    const totalFiles = DEFAULT_BATCH_SIZE + 2;
    const totalBatches = 2;
    expect(onProgress).toHaveBeenCalledTimes(totalBatches);
    expect(onProgress).toHaveBeenNthCalledWith(1, {
      phase: "complexity",
      commitsProcessed: 0,
      filesProcessed: DEFAULT_BATCH_SIZE,
      batchesProcessed: 1,
      totalFiles,
      totalBatches,
    });
    expect(onProgress).toHaveBeenNthCalledWith(2, {
      phase: "complexity",
      commitsProcessed: 0,
      filesProcessed: totalFiles,
      batchesProcessed: 2,
      totalFiles,
      totalBatches,
    });
  });

  it("does not emit complexity progress for zero discovered files", async () => {
    const onProgress = vi.fn();
    const createWorkerPool = vi.fn(() => ({
      runBatches: vi.fn(async () => []),
    }));

    const analyzer = createComplexityAnalyzer({
      discoverSourceFiles: async () => [],
      createWorkerPool,
    });

    await analyzer.analyze({ repoPath: fixtureDir, onProgress });

    expect(onProgress).not.toHaveBeenCalled();
    expect(createWorkerPool).not.toHaveBeenCalled();
  });
});
