import { discoverSourceFiles } from "./complexity/discover.js";
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
  /** Absolute config file path when loaded; null when none was found. */
  configPath: string | null;
  /** Monorepo remount note when scan path was remounted to git root. */
  remountMessage?: string;
  /** Unknown config keys after reserved-meta strip. */
  unknownConfigKeys: string[];
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
  const {
    merged,
    pipelineRepoPath,
    remountWarning,
    unknownConfigKeys,
    configPath,
  } = await resolveScanPipelineContext(options);

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
    configPath,
    ...(remountWarning ? { remountMessage: remountWarning.message } : {}),
    unknownConfigKeys,
  };
}

export function formatScanScopePreview(preview: ScanScopePreview): string {
  const lines = [
    `repo: ${preview.repoPath}`,
    `config file: ${preview.configPath ?? "none"}`,
  ];

  if (preview.remountMessage !== undefined) {
    lines.push(preview.remountMessage);
  }

  if (preview.unknownConfigKeys.length > 0) {
    lines.push(
      `Unknown config key(s) ignored: ${preview.unknownConfigKeys.join(", ")}`,
    );
  }

  lines.push(
    `since: ${preview.since}`,
    `include: ${formatPatternList(preview.include)}`,
    `exclude: ${formatPatternList(preview.exclude)}`,
    "default excludes: always on",
    `test files: ${preview.includeTests ? "included" : "excluded"}`,
    `eligible files: ${preview.eligibleFileCount}`,
    `concurrency: ${preview.concurrency}`,
  );

  return `${lines.join("\n")}\n`;
}
