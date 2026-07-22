import { stat } from "node:fs/promises";
import type { ScanOptions, ScanResult } from "./types/index.js";
import { DEFAULT_MIN_COCHANGE } from "./scoring/index.js";

export const DEFAULT_SINCE = "12 months ago";
export const DEFAULT_TOP = 20;

async function validateRepoPath(repoPath: string): Promise<void> {
  try {
    const repoStat = await stat(repoPath);
    if (!repoStat.isDirectory()) {
      throw new Error(`repoPath is not a directory: ${repoPath}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("repoPath")) {
      throw error;
    }
    throw new Error(`repoPath does not exist or is not accessible: ${repoPath}`);
  }
}

export async function runScan(options: ScanOptions): Promise<ScanResult> {
  await validateRepoPath(options.repoPath);

  const since = options.since ?? DEFAULT_SINCE;

  // top, minCochange, and callbacks are accepted for CLI/M6 wiring; M5 returns stub rankings.
  void (options.top ?? DEFAULT_TOP);
  void (options.minCochange ?? DEFAULT_MIN_COCHANGE);
  void options.onWarning;
  void options.onProgress;

  return {
    version: "1.0",
    hotspots: [],
    coupling: [],
    meta: {
      since,
      scannedAt: new Date().toISOString(),
    },
  };
}
