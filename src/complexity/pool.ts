import { availableParallelism } from "node:os";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import type { ScanProgress } from "../types/index.js";
import { analyzeBatch, type BatchAnalysisOutput } from "./analyze-batch.js";

export const DEFAULT_WORKER_CONCURRENCY = Math.min(availableParallelism(), 8);

export interface WorkerPoolOptions {
  concurrency: number;
  workerScript?: URL;
}

export interface WorkerPool {
  runBatches(
    repoPath: string,
    batches: string[][],
    signal?: AbortSignal,
    onProgress?: (progress: ScanProgress) => void,
  ): Promise<BatchAnalysisOutput[]>;
}

type WorkerInbound =
  | { type: "analyze"; id: number; repoPath: string; batch: string[] }
  | { type: "shutdown" };

type WorkerResultMessage =
  | { type: "result"; id: number; ok: true; output: BatchAnalysisOutput }
  | { type: "result"; id: number; ok: false; error?: string };

interface WorkerSlot {
  worker: Worker;
  inFlightBatchIndex: number | null;
}

function defaultWorkerScript(): URL {
  const adjacent = new URL("./worker.js", import.meta.url);
  if (existsSync(fileURLToPath(adjacent))) {
    return adjacent;
  }
  return new URL("../../dist/complexity/worker.js", import.meta.url);
}

function enrichBatchError(
  message: string,
  repoPath: string,
  batch: string[],
): Error {
  return new Error(
    `${message} (repoPath: ${repoPath}, batch: [${batch.join(", ")}])`,
  );
}

function createAbortError(): DOMException {
  return new DOMException("This operation was aborted", "AbortError");
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

function emitBatchProgress(
  onProgress: ((progress: ScanProgress) => void) | undefined,
  batches: string[][],
  batchesCompleted: number,
): void {
  if (!onProgress) {
    return;
  }

  const totalBatches = batches.length;
  const totalFiles = batches.reduce((sum, batch) => sum + batch.length, 0);
  const filesProcessed = batches
    .slice(0, batchesCompleted)
    .reduce((sum, batch) => sum + batch.length, 0);

  onProgress({
    phase: "complexity",
    commitsProcessed: 0,
    filesProcessed,
    batchesProcessed: batchesCompleted,
    totalFiles,
    totalBatches,
  });
}

async function shutdownWorkers(
  workers: Worker[],
  force = false,
): Promise<void> {
  await Promise.all(
    workers.map(async (worker) => {
      if (!force) {
        worker.postMessage({ type: "shutdown" } satisfies WorkerInbound);
      }
      await worker.terminate();
    }),
  );
}

export function createWorkerPool(options: WorkerPoolOptions): WorkerPool {
  const concurrency = options.concurrency;
  const workerScript = options.workerScript ?? defaultWorkerScript();

  return {
    async runBatches(repoPath, batches, signal, onProgress) {
      if (batches.length === 0) {
        return [];
      }

      throwIfAborted(signal);

      if (concurrency === 1) {
        const results: BatchAnalysisOutput[] = [];
        let batchesCompleted = 0;
        for (const batch of batches) {
          throwIfAborted(signal);
          results.push(await analyzeBatch({ repoPath, batch }));
          batchesCompleted += 1;
          emitBatchProgress(onProgress, batches, batchesCompleted);
        }
        return results;
      }

      const workerCount = Math.min(concurrency, batches.length);
      const results: BatchAnalysisOutput[] = new Array(batches.length);
      let nextBatchIndex = 0;
      let completedCount = 0;
      let settled = false;

      return new Promise((resolve, reject) => {
        const slots: WorkerSlot[] = [];
        let removeAbortListener: (() => void) | undefined;

        const cleanupAbortListener = () => {
          removeAbortListener?.();
          removeAbortListener = undefined;
        };

        const rejectWithAbort = () => {
          if (settled) {
            return;
          }
          settled = true;
          cleanupAbortListener();
          const workers = slots.map((slot) => slot.worker);
          shutdownWorkers(workers, true).then(() => {
            reject(createAbortError());
          });
        };

        const rejectWithBatch = (
          message: string,
          batch: string[],
          force = true,
        ) => {
          if (settled) {
            return;
          }
          settled = true;
          cleanupAbortListener();
          const workers = slots.map((slot) => slot.worker);
          shutdownWorkers(workers, force).then(() => {
            reject(enrichBatchError(message, repoPath, batch));
          });
        };

        const assignWork = (slot: WorkerSlot) => {
          if (settled || signal?.aborted || nextBatchIndex >= batches.length) {
            slot.inFlightBatchIndex = null;
            return;
          }

          const batchIndex = nextBatchIndex;
          nextBatchIndex += 1;
          slot.inFlightBatchIndex = batchIndex;

          slot.worker.postMessage({
            type: "analyze",
            id: batchIndex,
            repoPath,
            batch: batches[batchIndex]!,
          } satisfies WorkerInbound);
        };

        const finish = () => {
          if (settled) {
            return;
          }
          settled = true;
          cleanupAbortListener();
          const workers = slots.map((slot) => slot.worker);
          shutdownWorkers(workers).then(() => resolve(results));
        };

        if (signal) {
          if (signal.aborted) {
            rejectWithAbort();
            return;
          }
          const onAbort = () => {
            rejectWithAbort();
          };
          signal.addEventListener("abort", onAbort, { once: true });
          removeAbortListener = () => {
            signal.removeEventListener("abort", onAbort);
          };
        }

        for (let i = 0; i < workerCount; i++) {
          const worker = new Worker(workerScript);
          const slot: WorkerSlot = { worker, inFlightBatchIndex: null };
          slots.push(slot);

          worker.on("message", (message: WorkerResultMessage) => {
            if (settled || message.type !== "result") {
              return;
            }

            const batchIndex = message.id;
            const batch = batches[batchIndex]!;

            if (!message.ok) {
              rejectWithBatch(
                message.error ??
                  `Worker failed for batch in ${repoPath}: [${batch.join(", ")}]`,
                batch,
              );
              return;
            }

            results[batchIndex] = message.output!;
            completedCount += 1;
            emitBatchProgress(onProgress, batches, completedCount);
            slot.inFlightBatchIndex = null;

            if (completedCount === batches.length) {
              finish();
              return;
            }

            assignWork(slot);
          });

          worker.on("error", (error) => {
            if (settled) {
              return;
            }
            const batchIndex = slot.inFlightBatchIndex;
            const batch = batchIndex !== null ? batches[batchIndex]! : ["?"];
            rejectWithBatch(
              `Worker error for batch in ${repoPath}: [${batch.join(", ")}]: ${error.message}`,
              batch,
            );
          });

          worker.on("exit", (code) => {
            if (settled || code === 0) {
              return;
            }
            const batchIndex = slot.inFlightBatchIndex;
            const batch = batchIndex !== null ? batches[batchIndex]! : ["?"];
            rejectWithBatch(
              `Worker exited with code ${code} for batch in ${repoPath}: [${batch.join(", ")}]`,
              batch,
            );
          });

          assignWork(slot);
        }
      });
    },
  };
}
