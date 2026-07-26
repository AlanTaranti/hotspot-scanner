import { DEFAULT_WORKER_CONCURRENCY } from "../complexity/pool.js";
import { DEFAULT_SINCE, DEFAULT_TOP } from "../scan.js";
import type { HotspotScannerConfig } from "./load-config.js";

export interface MergedScanConfig {
  since: string;
  include?: string[];
  exclude?: string[];
  top: number;
  concurrency: number;
}

export interface MergeScanOptionsInput {
  config?: HotspotScannerConfig | null;
  cli?: HotspotScannerConfig;
}

function pickRequired<T>(
  cli: T | undefined,
  config: T | undefined,
  fallback: T,
): T {
  if (cli !== undefined) {
    return cli;
  }
  if (config !== undefined) {
    return config;
  }
  return fallback;
}

function pickOptional<T>(
  cli: T | undefined,
  config: T | undefined,
): T | undefined {
  if (cli !== undefined) {
    return cli;
  }
  if (config !== undefined) {
    return config;
  }
  return undefined;
}

export function mergeScanOptions(
  input: MergeScanOptionsInput,
): MergedScanConfig {
  const { config, cli = {} } = input;

  return {
    since: pickRequired(cli.since, config?.since, DEFAULT_SINCE),
    include: pickOptional(cli.include, config?.include),
    exclude: pickOptional(cli.exclude, config?.exclude),
    top: pickRequired(cli.top, config?.top, DEFAULT_TOP),
    concurrency: pickRequired(
      cli.concurrency,
      config?.concurrency,
      DEFAULT_WORKER_CONCURRENCY,
    ),
  };
}
