import { access, stat } from "node:fs/promises";
import { join } from "node:path";
import { createComplexityAnalyzer } from "./complexity/index.js";
import {
  loadHotspotScannerConfig,
  mergeScanOptions,
  type HotspotScannerConfig,
  type MergedScanConfig,
} from "./config/index.js";
import { createGitMiner } from "./git/index.js";
import { createFunctionChurnMiner } from "./git/function-churn/index.js";
import { createPathScope, filterGitMinerResult } from "./paths/index.js";
import {
  createFunctionHotspotScorer,
  createHotspotScorer,
  createTemporalCouplingScorer,
  enrichCouplingStaticDeps,
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
    throw new Error(
      `repoPath does not exist or is not accessible: ${repoPath}`,
    );
  }
}

export async function validateGitRepository(repoPath: string): Promise<void> {
  try {
    await access(join(repoPath, ".git"));
  } catch {
    throw new Error(`repoPath is not a git repository: ${repoPath}`);
  }
}

function pickCliOverrides(options: ScanOptions): HotspotScannerConfig {
  const cli: HotspotScannerConfig = {};

  if (options.since !== undefined) {
    cli.since = options.since;
  }
  if (options.include !== undefined) {
    cli.include = options.include;
  }
  if (options.exclude !== undefined) {
    cli.exclude = options.exclude;
  }
  if (options.granularity !== undefined) {
    cli.granularity = options.granularity;
  }
  if (options.minCochange !== undefined) {
    cli.minCochange = options.minCochange;
  }
  if (options.top !== undefined) {
    cli.top = options.top;
  }

  return cli;
}

export async function resolveScanConfig(
  options: ScanOptions,
): Promise<MergedScanConfig> {
  const config = await loadHotspotScannerConfig(options.repoPath);
  return mergeScanOptions({ config, cli: pickCliOverrides(options) });
}

export async function runScan(options: ScanOptions): Promise<ScanResult> {
  await validateRepoPath(options.repoPath);
  await validateGitRepository(options.repoPath);

  const merged = await resolveScanConfig(options);

  const scope = createPathScope({
    include: merged.include,
    exclude: merged.exclude,
  });

  const since = merged.since;
  const minCochange = merged.minCochange;
  const onWarning = options.onWarning;

  const miner = createGitMiner();
  const rawGit = await miner.mine({
    repoPath: options.repoPath,
    since,
    onProgress: options.onProgress,
  });
  const {
    fileStats,
    coChangeEvents,
    warnings: gitWarnings,
  } = filterGitMinerResult(rawGit, scope);

  for (const message of gitWarnings) {
    onWarning?.(message);
  }

  const analyzer = createComplexityAnalyzer();
  const {
    results,
    functions: functionComplexity,
    warnings: complexityWarnings,
  } = await analyzer.analyze({
    repoPath: options.repoPath,
    scope,
  });

  for (const message of complexityWarnings) {
    onWarning?.(message);
  }

  const scoredCoupling = createTemporalCouplingScorer().score(
    coChangeEvents,
    fileStats,
    minCochange,
  );
  const coupling = enrichCouplingStaticDeps(scoredCoupling, options.repoPath);

  const granularity = merged.granularity;
  const scannedAt = new Date().toISOString();

  if (granularity === "function") {
    const churnMiner = createFunctionChurnMiner();
    const { functionStats, warnings: churnWarnings } = await churnMiner.mine({
      repoPath: options.repoPath,
      since,
      functions: functionComplexity,
      onProgress: options.onProgress,
    });

    for (const message of churnWarnings) {
      onWarning?.(message);
    }

    const functions = createFunctionHotspotScorer().score(
      functionStats,
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
