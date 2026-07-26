import { access, stat } from "node:fs/promises";
import { join } from "node:path";
import { createComplexityAnalyzer } from "./complexity/index.js";
import {
  loadHotspotScannerConfig,
  mergeScanOptions,
  type HotspotScannerConfig,
  type MergedScanConfig,
} from "./config/index.js";
import { createScanWarning } from "./diagnostics/logger.js";
import { createGitMiner } from "./git/index.js";
import {
  buildAutoIncludePattern,
  createPathScope,
  filterGitMinerResult,
  isPathInScope,
  resolveMonorepoScanPath,
  type PathScope,
  type ResolvedMonorepoScanPath,
} from "./paths/index.js";
import { createHotspotScorer } from "./scoring/index.js";
import type {
  ScanOptions,
  ScanResult,
  ScanStageTimings,
  ScanWarning,
} from "./types/index.js";

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

function linkAbortSignal(
  external: AbortSignal | undefined,
  controller: AbortController,
): () => void {
  if (!external) {
    return () => {};
  }
  if (external.aborted) {
    controller.abort(external.reason);
    return () => {};
  }
  const onAbort = () => controller.abort(external.reason);
  external.addEventListener("abort", onAbort, { once: true });
  return () => external.removeEventListener("abort", onAbort);
}

function roundMs(durationMs: number): number {
  return Math.round(durationMs);
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

function createUnknownConfigKeyWarning(unknownKeys: string[]): ScanWarning {
  return createScanWarning(
    "UNKNOWN_CONFIG_KEY",
    `Unknown config key(s) ignored: ${unknownKeys.join(", ")}`,
    "warning",
  );
}

async function loadMergedScanConfig(
  options: ScanOptions,
  resolved: ResolvedMonorepoScanPath,
): Promise<{ merged: MergedScanConfig; unknownConfigKeys: string[] }> {
  const { config, unknownKeys } = await loadHotspotScannerConfig(
    options.repoPath,
    {
      configPath: options.configPath,
    },
  );
  const cli = pickCliOverrides(options);
  if (
    resolved.remounted &&
    options.include === undefined &&
    resolved.packagePrefix !== undefined
  ) {
    cli.include = [buildAutoIncludePattern(resolved.packagePrefix)];
  }
  return {
    merged: mergeScanOptions({ config, cli }),
    unknownConfigKeys: unknownKeys,
  };
}

export interface ScanPipelineContext {
  merged: MergedScanConfig;
  pipelineRepoPath: string;
  remountWarning?: ScanWarning;
  unknownConfigKeys: string[];
}

export async function resolveScanPipelineContext(
  options: ScanOptions,
): Promise<ScanPipelineContext> {
  await validateRepoPath(options.repoPath);
  const resolved = await resolveMonorepoScanPath(options.repoPath);
  const { merged, unknownConfigKeys } = await loadMergedScanConfig(
    options,
    resolved,
  );
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
    unknownConfigKeys,
  };
}

export async function resolveScanConfig(
  options: ScanOptions,
): Promise<MergedScanConfig> {
  const resolved = await resolveMonorepoScanPath(options.repoPath);
  const { merged } = await loadMergedScanConfig(options, resolved);
  return merged;
}

export function createScanPathScope(
  merged: Pick<MergedScanConfig, "include" | "exclude">,
  options?: { includeTests?: boolean },
): PathScope {
  return createPathScope({
    include: merged.include,
    exclude: merged.exclude,
    ...(options?.includeTests !== undefined
      ? { includeTests: options.includeTests }
      : {}),
  });
}

export async function runScan(options: ScanOptions): Promise<ScanResult> {
  const workStart = performance.now();
  const { merged, pipelineRepoPath, remountWarning, unknownConfigKeys } =
    await resolveScanPipelineContext(options);

  const scope = createScanPathScope(merged, {
    includeTests: options.includeTests,
  });

  const since = merged.since;
  const onWarning = options.onWarning;
  const onSpawnArgv = options.onSpawnArgv;
  const collectedWarnings: ScanWarning[] = [];

  if (remountWarning) {
    collectedWarnings.push(remountWarning);
    onWarning?.(remountWarning);
  }

  if (unknownConfigKeys.length > 0) {
    const unknownConfigWarning = createUnknownConfigKeyWarning(unknownConfigKeys);
    collectedWarnings.push(unknownConfigWarning);
    onWarning?.(unknownConfigWarning);
  }

  const miner = createGitMiner();
  const analyzer = createComplexityAnalyzer({ concurrency: merged.concurrency });
  const abortController = new AbortController();
  const signal = abortController.signal;
  const unlinkExternalAbort = linkAbortSignal(options.signal, abortController);

  try {
    if (signal.aborted) {
      throw signal.reason ?? new DOMException("Aborted", "AbortError");
    }

    const mineOptions: Parameters<typeof miner.mine>[0] = {
      repoPath: pipelineRepoPath,
      since,
      onProgress: options.onProgress,
      isPathInScope: (p) => isPathInScope(p, scope),
      signal,
      onSpawnArgv,
    };
    const analyzeOptions: Parameters<typeof analyzer.analyze>[0] = {
      repoPath: pipelineRepoPath,
      scope,
      signal,
      onProgress: options.onProgress,
    };

    let gitMs = 0;
    let complexityMs = 0;
    let rawGit;
    let cxResult;

    if (options.sequential === true) {
      const gitStart = performance.now();
      rawGit = await miner.mine(mineOptions);
      gitMs = roundMs(performance.now() - gitStart);

      const cxStart = performance.now();
      cxResult = await analyzer.analyze(analyzeOptions);
      complexityMs = roundMs(performance.now() - cxStart);
    } else {
      const gitStart = performance.now();
      const gitPromise = miner.mine(mineOptions).finally(() => {
        gitMs = roundMs(performance.now() - gitStart);
      });

      const cxStart = performance.now();
      const cxPromise = analyzer.analyze(analyzeOptions).finally(() => {
        complexityMs = roundMs(performance.now() - cxStart);
      });

      try {
        [rawGit, cxResult] = await Promise.all([gitPromise, cxPromise]);
      } catch (error) {
        abortController.abort();
        await Promise.allSettled([gitPromise, cxPromise]);
        throw error;
      }
    }

    const {
      fileStats,
      warnings: gitWarnings,
    } = filterGitMinerResult(rawGit, scope);

    const { results, warnings: complexityWarnings } = cxResult;

    collectedWarnings.push(...gitWarnings);
    forwardWarnings(gitWarnings, onWarning);
    collectedWarnings.push(...complexityWarnings);
    forwardWarnings(complexityWarnings, onWarning);

    const scannedAt = new Date().toISOString();
    const hotspots = createHotspotScorer().score(fileStats, results);

    const timings: ScanStageTimings = {
      gitMs,
      complexityMs,
      totalMs: roundMs(performance.now() - workStart),
    };

    return {
      version: "3.0",
      hotspots,
      meta: {
        since,
        scannedAt,
        warnings: collectedWarnings,
        timings,
      },
    };
  } finally {
    unlinkExternalAbort();
  }
}

export {
  formatScanScopePreview,
  previewScanScope,
  type ScanScopePreview,
} from "./scan-preview.js";
