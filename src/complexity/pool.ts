import { availableParallelism } from "node:os";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import {
  analyzeBatch,
  type BatchAnalysisOutput,
} from "./analyze-batch.js";

export const DEFAULT_WORKER_CONCURRENCY = Math.min(availableParallelism(), 4);

export interface WorkerPoolOptions {
  concurrency: number;
  workerScript?: URL;
}

export interface WorkerPool {
  runBatches(
    repoPath: string,
    batches: string[][],
  ): Promise<BatchAnalysisOutput[]>;
}

interface WorkerMessage {
  ok: boolean;
  output?: BatchAnalysisOutput;
  error?: string;
}

function defaultWorkerScript(): URL {
  const adjacent = new URL("./worker.js", import.meta.url);
  if (existsSync(fileURLToPath(adjacent))) {
    return adjacent;
  }
  return new URL("../../dist/complexity/worker.js", import.meta.url);
}

function runBatchInWorker(
  repoPath: string,
  batch: string[],
  workerScript: URL,
): Promise<BatchAnalysisOutput> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerScript, {
      workerData: { repoPath, batch },
    });

    worker.on("message", (message: WorkerMessage) => {
      if (message.ok && message.output) {
        resolve(message.output);
        return;
      }
      reject(
        new Error(
          message.error ??
            `Worker failed for batch in ${repoPath}: [${batch.join(", ")}]`,
        ),
      );
    });

    worker.on("error", (error) => {
      reject(
        new Error(
          `Worker error for batch in ${repoPath}: [${batch.join(", ")}]: ${error.message}`,
        ),
      );
    });

    worker.on("exit", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `Worker exited with code ${code} for batch in ${repoPath}: [${batch.join(", ")}]`,
          ),
        );
      }
    });
  });
}

export function createWorkerPool(options: WorkerPoolOptions): WorkerPool {
  const concurrency = options.concurrency;
  const workerScript = options.workerScript ?? defaultWorkerScript();

  return {
    async runBatches(repoPath, batches) {
      if (batches.length === 0) {
        return [];
      }

      if (concurrency === 1) {
        const results: BatchAnalysisOutput[] = [];
        for (const batch of batches) {
          results.push(await analyzeBatch({ repoPath, batch }));
        }
        return results;
      }

      const results: BatchAnalysisOutput[] = new Array(batches.length);
      let nextIndex = 0;
      let inFlight = 0;
      let rejected = false;

      return new Promise((resolve, reject) => {
        const dispatch = () => {
          if (rejected) {
            return;
          }

          while (inFlight < concurrency && nextIndex < batches.length) {
            const batchIndex = nextIndex;
            nextIndex += 1;
            inFlight += 1;

            const batch = batches[batchIndex]!;
            runBatchInWorker(repoPath, batch, workerScript)
              .then((output) => {
                if (rejected) {
                  return;
                }
                results[batchIndex] = output;
                inFlight -= 1;

                if (nextIndex >= batches.length && inFlight === 0) {
                  resolve(results);
                  return;
                }

                dispatch();
              })
              .catch((error) => {
                if (rejected) {
                  return;
                }
                rejected = true;
                const message =
                  error instanceof Error ? error.message : String(error);
                reject(
                  new Error(
                    `${message} (repoPath: ${repoPath}, batch: [${batch.join(", ")}])`,
                  ),
                );
              });
          }
        };

        dispatch();
      });
    },
  };
}
