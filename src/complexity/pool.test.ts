import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createWorkerPool } from "./pool.js";

const fixtureWorkersDir = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../tests/fixtures/workers",
);

describe("createWorkerPool", () => {
  let tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
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

    await expect(
      pool.runBatches("/tmp/exit-repo", [["a.ts"]]),
    ).rejects.toThrow(/Worker exited with code 1/);
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
});
