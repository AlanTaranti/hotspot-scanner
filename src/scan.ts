import { stat } from "node:fs/promises";
import { createComplexityAnalyzer } from "./complexity/index.js";
import { createGitMiner } from "./git/index.js";
import {
  createHotspotScorer,
  createTemporalCouplingScorer,
  DEFAULT_MIN_COCHANGE,
} from "./scoring/index.js";
import type { ScanOptions, ScanResult } from "./types/index.js";

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
  const minCochange = options.minCochange ?? DEFAULT_MIN_COCHANGE;
  const onWarning = options.onWarning;

  const miner = createGitMiner();
  const { fileStats, coChangeEvents, warnings: gitWarnings } =
    await miner.mine({
      repoPath: options.repoPath,
      since,
      onProgress: options.onProgress,
    });

  for (const message of gitWarnings) {
    onWarning?.(message);
  }

  const analyzer = createComplexityAnalyzer();
  const { results, warnings: complexityWarnings } = await analyzer.analyze({
    repoPath: options.repoPath,
  });

  for (const message of complexityWarnings) {
    onWarning?.(message);
  }

  const hotspots = createHotspotScorer().score(fileStats, results);
  const coupling = createTemporalCouplingScorer().score(
    coChangeEvents,
    fileStats,
    minCochange,
  );

  return {
    version: "1.0",
    hotspots,
    coupling,
    meta: {
      since,
      scannedAt: new Date().toISOString(),
    },
  };
}
