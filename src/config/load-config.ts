import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export const HOTSPOT_SCANNER_CONFIG_FILENAME = ".hotspot-scanner.json";

const KNOWN_KEYS = new Set([
  "since",
  "include",
  "exclude",
  "top",
  "concurrency",
]);

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export interface HotspotScannerConfig {
  since?: string;
  include?: string[];
  exclude?: string[];
  top?: number;
  concurrency?: number;
}

export interface ParsedHotspotScannerConfig {
  config: HotspotScannerConfig;
  unknownKeys: string[];
}

export interface LoadedHotspotScannerConfig {
  config: HotspotScannerConfig | null;
  unknownKeys: string[];
}

export interface LoadConfigOptions {
  /** When set, load this file and skip parent walk. Missing → ConfigError. */
  configPath?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, key: string): string {
  if (typeof value !== "string") {
    throw new ConfigError(`Config key "${key}" must be a string`);
  }
  return value;
}

function assertStringArray(value: unknown, key: string): string[] {
  if (!Array.isArray(value)) {
    throw new ConfigError(`Config key "${key}" must be an array of strings`);
  }

  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      throw new ConfigError(`Config key "${key}" must be an array of strings`);
    }
    if (item.length === 0) {
      throw new ConfigError(`Config key "${key}" patterns must not be empty`);
    }
    result.push(item);
  }
  return result;
}

function assertPositiveInteger(value: unknown, key: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new ConfigError(`Config key "${key}" must be a positive integer`);
  }
  return value;
}

export function parseHotspotScannerConfig(
  raw: unknown,
): ParsedHotspotScannerConfig {
  if (!isRecord(raw)) {
    throw new ConfigError("Config file must be a JSON object");
  }

  const config: HotspotScannerConfig = {};
  const unknownKeys: string[] = [];

  for (const key of Object.keys(raw)) {
    if (!KNOWN_KEYS.has(key)) {
      unknownKeys.push(key);
      continue;
    }

    const value = raw[key];
    if (value === undefined) {
      continue;
    }

    switch (key) {
      case "since":
        config.since = assertString(value, key);
        break;
      case "include":
        config.include = assertStringArray(value, key);
        break;
      case "exclude":
        config.exclude = assertStringArray(value, key);
        break;
      case "top":
        config.top = assertPositiveInteger(value, key);
        break;
      case "concurrency":
        config.concurrency = assertPositiveInteger(value, key);
        break;
    }
  }

  unknownKeys.sort();
  return { config, unknownKeys };
}

function isEnoent(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

async function loadConfigAtPath(
  configPath: string,
  onMissing: "error" | "null",
): Promise<LoadedHotspotScannerConfig> {
  let content: string;
  try {
    content = await readFile(configPath, "utf8");
  } catch (error) {
    if (isEnoent(error)) {
      if (onMissing === "error") {
        throw new ConfigError(
          `Config file not found: ${configPath}\nHint: the --config path must exist; omit --config to discover ${HOTSPOT_SCANNER_CONFIG_FILENAME} upward from the repo.`,
        );
      }
      return { config: null, unknownKeys: [] };
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new ConfigError(`Invalid JSON in ${configPath}`);
  }

  return parseHotspotScannerConfig(parsed);
}

export async function loadHotspotScannerConfig(
  repoPath: string,
  options?: LoadConfigOptions,
): Promise<LoadedHotspotScannerConfig> {
  if (options?.configPath) {
    return loadConfigAtPath(options.configPath, "error");
  }

  let dir = resolve(repoPath);
  while (true) {
    const candidatePath = join(dir, HOTSPOT_SCANNER_CONFIG_FILENAME);
    const loaded = await loadConfigAtPath(candidatePath, "null");
    if (loaded.config !== null) {
      return loaded;
    }

    const parent = dirname(dir);
    if (parent === dir) {
      return { config: null, unknownKeys: [] };
    }
    dir = parent;
  }
}
