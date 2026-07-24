import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { availableParallelism, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as analyzeBatchModule from "./analyze-batch.js";
import * as projectModule from "./project.js";
import { createWorkerPool, DEFAULT_WORKER_CONCURRENCY } from "./pool.js";

const fixtureWorkersDir = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../tests/fixtures/workers",
);

const spawnCount = vi.hoisted(() => ({ value: 0 }));

describe("DEFAULT_WORKER_CONCURRENCY", () => {
  it("equals min(availableParallelism(), 8)", () => {
    expect(DEFAULT_WORKER_CONCURRENCY).toBe(
      Math.min(availableParallelism(), 8),
    );
    expect(DEFAULT_WORKER_CONCURRENCY).toBeLessThanOrEqual(8);
  });
});

describe("createWorkerPool", () => {
  let tempDirs: string[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(
      tempDirs.map((dir) => rm(dir, { recursive: true, force: true })),
    );
    tempDirs = [];
  });

  async function createTempRepo(files: Record<string, string>) {
    const dir = await mkdtemp(join(tmpdir(), "pool-test-"));
    tempDirs.push(dir);
    for (const [relativePath, content] of Object.entries(files)) {
      const filePath = join(dir, relativePath);
      await writeFile(filePath, content, "utf8");
    }
    return dir;
  }

  it("returns empty array for no batches", async () => {
    const pool = createWorkerPool({ concurrency: 2 });
    await expect(pool.runBatches("/tmp/repo", [])).resolves.toEqual([]);
  });

  it("processes batches inline when concurrency is 1 without spawning workers", async () => {
    const repoPath = await createTempRepo({
      "a.ts": "export const a = 1;",
      "b.ts": "export const b = 2;",
    });

    const pool = createWorkerPool({ concurrency: 1 });
    const batches = [["a.ts"], ["b.ts"]];
    const outputs = await pool.runBatches(repoPath, batches);

    expect(outputs).toHaveLength(2);
    expect(outputs[0]!.results[0]?.filePath).toBe("a.ts");
    expect(outputs[1]!.results[0]?.filePath).toBe("b.ts");
  });

  it("reuses one Project adapter across batches when concurrency is 1", async () => {
    const createProjectSpy = vi.spyOn(projectModule, "createTsMorphProject");
    const repoPath = await createTempRepo({
      "a.ts": "export const a = 1;",
      "b.ts": "export const b = 2;",
      "c.ts": "export const c = 3;",
    });

    const pool = createWorkerPool({ concurrency: 1 });
    await pool.runBatches(repoPath, [["a.ts"], ["b.ts"], ["c.ts"]]);

    expect(createProjectSpy).toHaveBeenCalledTimes(1);
    expect(createProjectSpy).toHaveBeenCalledWith({ repoPath });
  });

  it("returns results aligned to input batch order with concurrency > 1", async () => {
    const repoPath = await createTempRepo({
      "a.ts": "export const a = 1;",
      "b.ts": "export const b = 2;",
      "c.ts": "export const c = 3;",
    });

    const pool = createWorkerPool({ concurrency: 2 });
    const batches = [["a.ts"], ["b.ts"], ["c.ts"]];
    const outputs = await pool.runBatches(repoPath, batches);

    expect(outputs).toHaveLength(3);
    expect(outputs.map((output) => output.results[0]?.filePath)).toEqual([
      "a.ts",
      "b.ts",
      "c.ts",
    ]);
  });

  it("spawns at most concurrency workers, not one per batch", async () => {
    spawnCount.value = 0;

    vi.doMock("node:worker_threads", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("node:worker_threads")>();
      class CountingWorker extends actual.Worker {
        constructor(...args: ConstructorParameters<typeof actual.Worker>) {
          spawnCount.value += 1;
          super(...args);
        }
      }
      return { ...actual, Worker: CountingWorker };
    });

    vi.resetModules();
    const { createWorkerPool: createCountingPool } = await import("./pool.js");

    const repoPath = await createTempRepo({
      "a.ts": "export const a = 1;",
      "b.ts": "export const b = 2;",
      "c.ts": "export const c = 3;",
      "d.ts": "export const d = 4;",
    });

    const concurrency = 2;
    const pool = createCountingPool({ concurrency });
    const batches = [["a.ts"], ["b.ts"], ["c.ts"], ["d.ts"]];
    const outputs = await pool.runBatches(repoPath, batches);

    expect(spawnCount.value).toBe(concurrency);
    expect(spawnCount.value).toBeLessThan(batches.length);
    expect(outputs).toHaveLength(4);
    expect(outputs.map((output) => output.results[0]?.filePath)).toEqual([
      "a.ts",
      "b.ts",
      "c.ts",
      "d.ts",
    ]);

    vi.doUnmock("node:worker_threads");
    vi.resetModules();
  });

  it("produces identical batch outputs for concurrency 1 vs higher concurrency", async () => {
    const files: Record<string, string> = {
      "a.ts": "export const a = 1;",
      "b.ts": "export function b(x: boolean) { return x ? 1 : 0; }",
      "c.ts": "export const broken = {{{",
      "d.ts": "export const d = 4;",
    };
    const repoPath = await createTempRepo(files);
    const batches = [["a.ts", "b.ts"], ["c.ts", "d.ts"]];

    const inlineOutputs = await createWorkerPool({ concurrency: 1 }).runBatches(
      repoPath,
      batches,
    );
    const parallelOutputs = await createWorkerPool({ concurrency: 2 }).runBatches(
      repoPath,
      batches,
    );

    expect(parallelOutputs).toEqual(inlineOutputs);
  });

  it("never exceeds concurrency limit for in-flight batches", async () => {
    const repoPath = await createTempRepo({
      "a.ts": "export const a = 1;",
      "b.ts": "export const b = 2;",
      "c.ts": "export const c = 3;",
      "d.ts": "export const d = 4;",
    });

    const concurrency = 2;
    const pool = createWorkerPool({ concurrency });
    const batches = [["a.ts"], ["b.ts"], ["c.ts"], ["d.ts"]];
    const outputs = await pool.runBatches(repoPath, batches);

    expect(outputs).toHaveLength(4);
    expect(outputs.map((output) => output.results[0]?.filePath)).toEqual([
      "a.ts",
      "b.ts",
      "c.ts",
      "d.ts",
    ]);
  });

  it("propagates worker errors with repoPath and batch context", async () => {
    const pool = createWorkerPool({
      concurrency: 2,
      workerScript: new URL("./nonexistent-worker.js", import.meta.url),
    });

    await expect(
      pool.runBatches("/tmp/test-repo", [["missing.ts"]]),
    ).rejects.toThrow(/repoPath: \/tmp\/test-repo/);
  });

  it("rejects when worker posts failure without error message", async () => {
    const pool = createWorkerPool({
      concurrency: 2,
      workerScript: new URL(
        `${fixtureWorkersDir}/bad-message-worker.mjs`,
        import.meta.url,
      ),
    });

    await expect(
      pool.runBatches("/tmp/bad-message-repo", [["a.ts"]]),
    ).rejects.toThrow(/Worker failed for batch/);
  });

  it("rejects when worker thread emits an error event", async () => {
    const pool = createWorkerPool({
      concurrency: 2,
      workerScript: new URL(
        `${fixtureWorkersDir}/error-worker.mjs`,
        import.meta.url,
      ),
    });

    await expect(
      pool.runBatches("/tmp/error-repo", [["a.ts"]]),
    ).rejects.toThrow(/Worker error for batch/);
  });

  it("rejects when worker exits with non-zero code", async () => {
    const pool = createWorkerPool({
      concurrency: 2,
      workerScript: new URL(
        `${fixtureWorkersDir}/exit-code-worker.mjs`,
        import.meta.url,
      ),
    });

    await expect(pool.runBatches("/tmp/exit-repo", [["a.ts"]])).rejects.toThrow(
      /Worker exited with code 1/,
    );
  });

  it("uses adjacent worker script when compiled worker exists beside pool", async () => {
    const repoPath = await createTempRepo({
      "a.ts": "export const a = 1;",
    });
    const pool = createWorkerPool({
      concurrency: 2,
      workerScript: new URL("../../dist/complexity/worker.js", import.meta.url),
    });

    const outputs = await pool.runBatches(repoPath, [["a.ts"]]);
    expect(outputs[0]?.results[0]?.filePath).toBe("a.ts");
  });

  it("rejects with AbortError when signal is already aborted", async () => {
    const repoPath = await createTempRepo({
      "a.ts": "export const a = 1;",
    });
    const controller = new AbortController();
    controller.abort();

    const pool = createWorkerPool({ concurrency: 2 });
    await expect(
      pool.runBatches(repoPath, [["a.ts"]], controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("terminates in-flight workers when signal aborts mid-run", async () => {
    const repoPath = await createTempRepo({
      "a.ts": "export const a = 1;",
      "b.ts": "export const b = 2;",
      "c.ts": "export const c = 3;",
      "d.ts": "export const d = 4;",
    });
    const pool = createWorkerPool({
      concurrency: 2,
      workerScript: new URL(
        `${fixtureWorkersDir}/slow-worker.mjs`,
        import.meta.url,
      ),
    });
    const controller = new AbortController();

    const promise = pool.runBatches(
      repoPath,
      [["a.ts"], ["b.ts"], ["c.ts"], ["d.ts"]],
      controller.signal,
    );

    await new Promise((resolve) => setTimeout(resolve, 50));
    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });

  it("stops scheduling new batches after abort when concurrency is 1", async () => {
    let unblockFirstBatch!: () => void;
    const firstBatchBlocked = new Promise<void>((resolve) => {
      unblockFirstBatch = resolve;
    });

    const analyzeBatchSpy = vi
      .spyOn(analyzeBatchModule, "analyzeBatch")
      .mockImplementation(async () => {
        if (analyzeBatchSpy.mock.calls.length === 1) {
          await firstBatchBlocked;
        }
        return { results: [], functions: [], warnings: [] };
      });

    const repoPath = await createTempRepo({
      "a.ts": "export const a = 1;",
      "b.ts": "export const b = 2;",
      "c.ts": "export const c = 3;",
    });
    const controller = new AbortController();
    const pool = createWorkerPool({ concurrency: 1 });

    const promise = pool.runBatches(
      repoPath,
      [["a.ts"], ["b.ts"], ["c.ts"]],
      controller.signal,
    );

    await vi.waitFor(() => {
      expect(analyzeBatchSpy).toHaveBeenCalledTimes(1);
    });
    controller.abort();
    unblockFirstBatch();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(analyzeBatchSpy).toHaveBeenCalledTimes(1);
  });
});
