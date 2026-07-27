import { DEFAULT_WORKER_CONCURRENCY } from "../complexity/pool.js";
import { DEFAULT_SINCE, DEFAULT_TOP } from "../scan.js";
import {
  loadHotspotScannerConfig,
  type HotspotScannerConfig,
} from "./load-config.js";

export type OptionSource = "cli" | "config" | "default";

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

export interface MergedScanConfigWithSources {
  values: MergedScanConfig;
  sources: {
    since: OptionSource;
    include: OptionSource;
    exclude: OptionSource;
    top: OptionSource;
    concurrency: OptionSource;
  };
  configPath: string | null;
}

export interface LoadMergedScanConfigWithSourcesInput {
  repoPath: string;
  configPath?: string;
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

function pickSourceRequired<T>(
  cli: T | undefined,
  config: T | undefined,
): OptionSource {
  if (cli !== undefined) {
    return "cli";
  }
  if (config !== undefined) {
    return "config";
  }
  return "default";
}

function pickSourceOptional<T>(
  cli: T | undefined,
  config: T | undefined,
): OptionSource {
  if (cli !== undefined) {
    return "cli";
  }
  if (config !== undefined) {
    return "config";
  }
  return "default";
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

export function mergeScanOptionsWithSources(
  input: MergeScanOptionsInput,
  configPath: string | null,
): MergedScanConfigWithSources {
  const { config, cli = {} } = input;

  return {
    values: mergeScanOptions(input),
    sources: {
      since: pickSourceRequired(cli.since, config?.since),
      include: pickSourceOptional(cli.include, config?.include),
      exclude: pickSourceOptional(cli.exclude, config?.exclude),
      top: pickSourceRequired(cli.top, config?.top),
      concurrency: pickSourceRequired(cli.concurrency, config?.concurrency),
    },
    configPath,
  };
}

export async function loadMergedScanConfigWithSources(
  input: LoadMergedScanConfigWithSourcesInput,
): Promise<MergedScanConfigWithSources> {
  const loaded = await loadHotspotScannerConfig(input.repoPath, {
    configPath: input.configPath,
  });

  return mergeScanOptionsWithSources(
    { config: loaded.config, cli: input.cli },
    loaded.path,
  );
}
