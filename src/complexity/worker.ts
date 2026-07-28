import { parentPort } from "node:worker_threads";
import { analyzeBatch, type BatchAnalysisOutput } from "./analyze-batch.js";

type WorkerInbound =
  | { type: "analyze"; id: number; repoPath: string; batch: string[] }
  | { type: "shutdown" };

type WorkerOutbound =
  | { type: "result"; id: number; ok: true; output: BatchAnalysisOutput }
  | { type: "result"; id: number; ok: false; error: string };

parentPort!.on("message", async (message: WorkerInbound) => {
  if (message.type === "shutdown") {
    process.exit(0);
    return;
  }

  if (message.type !== "analyze") {
    return;
  }

  try {
    const output = await analyzeBatch({
      repoPath: message.repoPath,
      batch: message.batch,
    });

    const response: WorkerOutbound = {
      type: "result",
      id: message.id,
      ok: true,
      output,
    };
    parentPort!.postMessage(response);
  } catch (error) {
    const response: WorkerOutbound = {
      type: "result",
      id: message.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    parentPort!.postMessage(response);
  }
});
