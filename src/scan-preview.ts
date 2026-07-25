import { discoverSourceFiles } from "./complexity/discover.js";
import { PATCH_PATHSPEC_FALLBACK_THRESHOLD } from "./git/function-churn/spawn.js";
import { createScanPathScope, resolveScanPipelineContext } from "./scan.js";
import type { ScanOptions } from "./types/index.js";

export interface ScanScopePreview {
  repoPath: string;
  since: string;
  /** Effective include patterns; empty when unset. */
  include: string[];
  /** User/config exclude patterns only (defaults always apply separately). */
  exclude: string[];
  /** Whether built-in test exclude patterns were lifted. */
  includeTests: boolean;
  eligibleFileCount: number;
  concurrency: number;
  /** Set when eligible files exceed the pathspec batch threshold. */
  pathspecScaleWarning?: string;
}

export function buildPathspecScaleWarning(
  eligibleFileCount: number,
): string | undefined {
  if (eligibleFileCount <= PATCH_PATHSPEC_FALLBACK_THRESHOLD) {
    return undefined;
  }

  return `warning: eligible files (${eligibleFileCount}) exceed pathspec batch threshold (${PATCH_PATHSPEC_FALLBACK_THRESHOLD}); function mode will batch git pathspecs`;
}

function formatPatternList(patterns: string[]): string {
  if (patterns.length === 0) {
    return "[]";
  }
  return JSON.stringify(patterns);
}

export async function previewScanScope(
  options: ScanOptions,
): Promise<ScanScopePreview> {
  const { merged, pipelineRepoPath } = await resolveScanPipelineContext(options);

  const includeTests = options.includeTests === true;

  const scope = createScanPathScope(merged, {
    includeTests: options.includeTests,
  });

  const eligiblePaths = await discoverSourceFiles(pipelineRepoPath, scope);
  const eligibleFileCount = eligiblePaths.length;

  return {
    repoPath: pipelineRepoPath,
    since: merged.since,
    include: merged.include ?? [],
    exclude: merged.exclude ?? [],
    includeTests,
    eligibleFileCount,
    concurrency: merged.concurrency,
    pathspecScaleWarning: buildPathspecScaleWarning(eligibleFileCount),
  };
}

export function formatScanScopePreview(preview: ScanScopePreview): string {
  const lines = [
    `repo: ${preview.repoPath}`,
    `since: ${preview.since}`,
    `include: ${formatPatternList(preview.include)}`,
    `exclude: ${formatPatternList(preview.exclude)}`,
    "default excludes: always on",
    `test files: ${preview.includeTests ? "included" : "excluded"}`,
    `eligible files: ${preview.eligibleFileCount}`,
    `concurrency: ${preview.concurrency}`,
  ];

  const pathspecScaleWarning =
    preview.pathspecScaleWarning ??
    buildPathspecScaleWarning(preview.eligibleFileCount);
  if (pathspecScaleWarning) {
    lines.push(pathspecScaleWarning);
  }

  return `${lines.join("\n")}\n`;
}
