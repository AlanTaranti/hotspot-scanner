import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ScanGranularity } from "../types/index.js";

export const HOTSPOT_SCANNER_CONFIG_FILENAME = ".hotspot-scanner.json";

const KNOWN_KEYS = new Set([
  "since",
  "include",
  "exclude",
  "granularity",
  "minCochange",
  "top",
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
  granularity?: ScanGranularity;
  minCochange?: number;
  top?: number;
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

function assertGranularity(value: unknown, key: string): ScanGranularity {
  if (value !== "file" && value !== "function") {
    throw new ConfigError(`Config key "${key}" must be "file" or "function"`);
  }
  return value;
}

function assertPositiveInteger(value: unknown, key: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new ConfigError(`Config key "${key}" must be a positive integer`);
  }
  return value;
}

export function parseHotspotScannerConfig(raw: unknown): HotspotScannerConfig {
  if (!isRecord(raw)) {
    throw new ConfigError("Config file must be a JSON object");
  }

  const config: HotspotScannerConfig = {};

  for (const key of Object.keys(raw)) {
    if (!KNOWN_KEYS.has(key)) {
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
      case "granularity":
        config.granularity = assertGranularity(value, key);
        break;
      case "minCochange":
        config.minCochange = assertPositiveInteger(value, key);
        break;
      case "top":
        config.top = assertPositiveInteger(value, key);
        break;
    }
  }

  return config;
}

export async function loadHotspotScannerConfig(
  repoPath: string,
): Promise<HotspotScannerConfig | null> {
  const configPath = join(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME);
  let content: string;
  try {
    content = await readFile(configPath, "utf8");
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new ConfigError(`Invalid JSON in ${HOTSPOT_SCANNER_CONFIG_FILENAME}`);
  }

  return parseHotspotScannerConfig(parsed);
}
