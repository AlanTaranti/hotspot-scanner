import { access, stat } from "node:fs/promises";
import { join } from "node:path";
import {
  createComplexityAnalyzer,
  ELIGIBLE_EXTENSIONS,
} from "./complexity/index.js";
import {
  loadHotspotScannerConfig,
  mergeScanOptions,
  type HotspotScannerConfig,
  type MergedScanConfig,
} from "./config/index.js";
import { createGitMiner } from "./git/index.js";
import { createFunctionChurnMiner } from "./git/function-churn/index.js";
import {
  createPathScope,
  filterGitMinerResult,
  isPathInScope,
} from "./paths/index.js";
import {
  createFunctionHotspotScorer,
  createHotspotScorer,
  createTemporalCouplingScorer,
  enrichCouplingStaticDeps,
} from "./scoring/index.js";
import type {
  FileChangeStats,
  ScanOptions,
  ScanResult,
  ScanWarning,
} from "./types/index.js";

export function buildFunctionModePathAllowlist(
  fileStats: Map<string, FileChangeStats>,
  eligibleExtensions: readonly string[],
): string[] {
  const paths: string[] = [];
  for (const filePath of fileStats.keys()) {
    if (eligibleExtensions.some((extension) => filePath.endsWith(extension))) {
      paths.push(filePath);
    }
  }
  return paths.sort();
}

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
  if (options.concurrency !== undefined) {
    cli.concurrency = options.concurrency;
  }

  return cli;
}

function forwardWarnings(
  warnings: ScanWarning[],
  onWarning?: (warning: ScanWarning) => void,
): void {
  for (const warning of warnings) {
    onWarning?.(warning);
  }
}

export async function resolveScanConfig(
  options: ScanOptions,
): Promise<MergedScanConfig> {
  const config = await loadHotspotScannerConfig(options.repoPath, {
    configPath: options.configPath,
  });
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
  const collectedWarnings: ScanWarning[] = [];

  const granularity = merged.granularity;
  const miner = createGitMiner();
  const analyzer = createComplexityAnalyzer({ concurrency: merged.concurrency });
  const abortController = new AbortController();
  const signal = abortController.signal;

  const gitPromise = miner.mine({
    repoPath: options.repoPath,
    since,
    onProgress: options.onProgress,
    isPathInScope: (p) => isPathInScope(p, scope),
    signal,
  });

  let functionModePathAllowlist: string[] | undefined;

  const cxPromise = (async () => {
    const analyzeOptions: Parameters<typeof analyzer.analyze>[0] = {
      repoPath: options.repoPath,
      scope,
      signal,
    };

    if (granularity === "function") {
      const rawGit = await gitPromise;
      const { fileStats } = filterGitMinerResult(rawGit, scope);
      functionModePathAllowlist = buildFunctionModePathAllowlist(
        fileStats,
        ELIGIBLE_EXTENSIONS,
      );
      analyzeOptions.pathAllowlist = functionModePathAllowlist;
    }

    return analyzer.analyze(analyzeOptions);
  })();

  let rawGit;
  let cxResult;
  try {
    [rawGit, cxResult] = await Promise.all([gitPromise, cxPromise]);
  } catch (error) {
    abortController.abort();
    await Promise.allSettled([gitPromise, cxPromise]);
    throw error;
  }

  const {
    fileStats,
    pairCounts,
    warnings: gitWarnings,
  } = filterGitMinerResult(rawGit, scope);

  if (granularity === "function" && functionModePathAllowlist === undefined) {
    functionModePathAllowlist = buildFunctionModePathAllowlist(
      fileStats,
      ELIGIBLE_EXTENSIONS,
    );
  }

  const { results, functions: functionComplexity, warnings: complexityWarnings } =
    cxResult;

  collectedWarnings.push(...gitWarnings);
  forwardWarnings(gitWarnings, onWarning);
  collectedWarnings.push(...complexityWarnings);
  forwardWarnings(complexityWarnings, onWarning);

  const scoredCoupling = createTemporalCouplingScorer().score(
    pairCounts,
    fileStats,
    minCochange,
  );
  const coupling = enrichCouplingStaticDeps(scoredCoupling, options.repoPath);

  const scannedAt = new Date().toISOString();

  if (granularity === "function") {
    const churnMiner = createFunctionChurnMiner();
    const { functionStats, warnings: churnWarnings } = await churnMiner.mine({
      repoPath: options.repoPath,
      since,
      functions: functionComplexity,
      paths: functionModePathAllowlist,
      onProgress: options.onProgress,
    });

    collectedWarnings.push(...churnWarnings);
    forwardWarnings(churnWarnings, onWarning);

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
        warnings: collectedWarnings,
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
      warnings: collectedWarnings,
    },
  };
}
