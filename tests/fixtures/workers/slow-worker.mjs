import { parentPort } from "node:worker_threads";

parentPort?.on("message", (message) => {
  if (message.type === "analyze") {
    // Intentionally never respond — aborted runs should terminate the worker.
  }
});
