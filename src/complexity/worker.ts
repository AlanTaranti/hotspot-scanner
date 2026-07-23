import { parentPort, workerData } from "node:worker_threads";
import { analyzeBatch, type BatchAnalysisInput } from "./analyze-batch.js";

const input = workerData as BatchAnalysisInput;

analyzeBatch(input)
  .then((output) => parentPort!.postMessage({ ok: true, output }))
  .catch((error) =>
    parentPort!.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }),
  );
