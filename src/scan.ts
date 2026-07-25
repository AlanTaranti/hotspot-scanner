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
  buildAutoIncludePattern,
  createPathScope,
  filterGitMinerResult,
  isPathInScope,
  resolveMonorepoScanPath,
  type ResolvedMonorepoScanPath,
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

export async function validateRepoPath(repoPath: string): Promise<void> {
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
    throw new Error(
      `repoPath is not a git repository: ${repoPath}\nHint: pass a repository root that contains a .git directory, or cd into the Git repo first.`,
    );
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

function createMonorepoPathRemountWarning(
  resolved: ResolvedMonorepoScanPath,
  autoIncludeApplied: boolean,
): ScanWarning {
  const message =
    autoIncludeApplied && resolved.packagePrefix
      ? `Scan path remounted to git root ${resolved.repoPath}; auto-including ${buildAutoIncludePattern(resolved.packagePrefix)}`
      : `Scan path remounted to git root ${resolved.repoPath}`;
  return {
    code: "MONOREPO_PATH_REMOUNT",
    severity: "info",
    message,
  };
}

async function loadMergedScanConfig(
  options: ScanOptions,
  resolved: ResolvedMonorepoScanPath,
): Promise<MergedScanConfig> {
  const config = await loadHotspotScannerConfig(options.repoPath, {
    configPath: options.configPath,
  });
  const cli = pickCliOverrides(options);
  if (
    resolved.remounted &&
    options.include === undefined &&
    resolved.packagePrefix !== undefined
  ) {
    cli.include = [buildAutoIncludePattern(resolved.packagePrefix)];
  }
  return mergeScanOptions({ config, cli });
}

export interface ScanPipelineContext {
  merged: MergedScanConfig;
  pipelineRepoPath: string;
  remountWarning?: ScanWarning;
}

export async function resolveScanPipelineContext(
  options: ScanOptions,
): Promise<ScanPipelineContext> {
  await validateRepoPath(options.repoPath);
  const resolved = await resolveMonorepoScanPath(options.repoPath);
  const merged = await loadMergedScanConfig(options, resolved);
  await validateGitRepository(resolved.repoPath);
  const autoIncludeApplied =
    resolved.remounted &&
    options.include === undefined &&
    resolved.packagePrefix !== undefined;
  const remountWarning = resolved.remounted
    ? createMonorepoPathRemountWarning(resolved, autoIncludeApplied)
    : undefined;
  return {
    merged,
    pipelineRepoPath: resolved.repoPath,
    remountWarning,
  };
}

export async function resolveScanConfig(
  options: ScanOptions,
): Promise<MergedScanConfig> {
  const resolved = await resolveMonorepoScanPath(options.repoPath);
  return loadMergedScanConfig(options, resolved);
}

export async function runScan(options: ScanOptions): Promise<ScanResult> {
  const { merged, pipelineRepoPath, remountWarning } =
    await resolveScanPipelineContext(options);

  const scope = createPathScope({
    include: merged.include,
    exclude: merged.exclude,
  });

  const since = merged.since;
  const minCochange = merged.minCochange;
  const onWarning = options.onWarning;
  const collectedWarnings: ScanWarning[] = [];

  if (remountWarning) {
    collectedWarnings.push(remountWarning);
    onWarning?.(remountWarning);
  }

  const granularity = merged.granularity;
  const miner = createGitMiner();
  const analyzer = createComplexityAnalyzer({ concurrency: merged.concurrency });
  const abortController = new AbortController();
  const signal = abortController.signal;

  const gitPromise = miner.mine({
    repoPath: pipelineRepoPath,
    since,
    onProgress: options.onProgress,
    isPathInScope: (p) => isPathInScope(p, scope),
    signal,
  });

  let functionModePathAllowlist: string[] | undefined;

  const cxPromise = (async () => {
    const analyzeOptions: Parameters<typeof analyzer.analyze>[0] = {
      repoPath: pipelineRepoPath,
      scope,
      signal,
      onProgress: options.onProgress,
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
  const coupling = enrichCouplingStaticDeps(scoredCoupling, pipelineRepoPath);

  const scannedAt = new Date().toISOString();

  if (granularity === "function") {
    const churnMiner = createFunctionChurnMiner();
    const { functionStats, warnings: churnWarnings } = await churnMiner.mine({
      repoPath: pipelineRepoPath,
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

export {
  formatScanScopePreview,
  previewScanScope,
  type ScanScopePreview,
} from "./scan-preview.js";
