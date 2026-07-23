import { access, stat } from "node:fs/promises";
import { join } from "node:path";
import { createComplexityAnalyzer } from "./complexity/index.js";
import { createGitMiner } from "./git/index.js";
import { createPathScope, filterGitMinerResult } from "./paths/index.js";
import {
  createFunctionHotspotScorer,
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

export async function validateGitRepository(repoPath: string): Promise<void> {
  try {
    await access(join(repoPath, ".git"));
  } catch {
    throw new Error(`repoPath is not a git repository: ${repoPath}`);
  }
}

export async function runScan(options: ScanOptions): Promise<ScanResult> {
  await validateRepoPath(options.repoPath);
  await validateGitRepository(options.repoPath);

  const scope = createPathScope({
    include: options.include,
    exclude: options.exclude,
  });

  const since = options.since ?? DEFAULT_SINCE;
  const minCochange = options.minCochange ?? DEFAULT_MIN_COCHANGE;
  const onWarning = options.onWarning;

  const miner = createGitMiner();
  const rawGit = await miner.mine({
    repoPath: options.repoPath,
    since,
    onProgress: options.onProgress,
  });
  const { fileStats, coChangeEvents, warnings: gitWarnings } =
    filterGitMinerResult(rawGit, scope);

  for (const message of gitWarnings) {
    onWarning?.(message);
  }

  const analyzer = createComplexityAnalyzer();
  const { results, functions: functionComplexity, warnings: complexityWarnings } =
    await analyzer.analyze({
    repoPath: options.repoPath,
    scope,
  });

  for (const message of complexityWarnings) {
    onWarning?.(message);
  }

  const coupling = createTemporalCouplingScorer().score(
    coChangeEvents,
    fileStats,
    minCochange,
  );

  const granularity = options.granularity ?? "file";
  const scannedAt = new Date().toISOString();

  if (granularity === "function") {
    const functions = createFunctionHotspotScorer().score(
      fileStats,
      functionComplexity,
    );

    return {
      version: "1.0",
      hotspots: [],
      functions,
      coupling,
      meta: {
        since,
        scannedAt,
        granularity,
      },
    };
  }

  const hotspots = createHotspotScorer().score(fileStats, results);

  return {
    version: "1.0",
    hotspots,
    functions: [],
    coupling,
    meta: {
      since,
      scannedAt,
      granularity: "file",
    },
  };
}
