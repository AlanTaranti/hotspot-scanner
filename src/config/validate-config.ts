import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ConfigError,
  HOTSPOT_SCANNER_CONFIG_FILENAME,
  loadHotspotScannerConfig,
} from "./load-config.js";

function isEnoent(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

export async function validateHotspotScannerConfigFile(
  pathOrDir: string,
): Promise<{ path: string }> {
  const absolute = resolve(pathOrDir);

  let fileStats;
  try {
    fileStats = await stat(absolute);
  } catch (error) {
    if (isEnoent(error)) {
      throw new ConfigError(`Config file not found: ${absolute}`);
    }
    throw error;
  }

  if (fileStats.isFile()) {
    const loaded = await loadHotspotScannerConfig(absolute, {
      configPath: absolute,
    });
    if (loaded.path === null) {
      throw new ConfigError(`Config file not found: ${absolute}`);
    }
    return { path: loaded.path };
  }

  if (fileStats.isDirectory()) {
    const loaded = await loadHotspotScannerConfig(absolute);
    if (loaded.path === null) {
      throw new ConfigError(
        `No ${HOTSPOT_SCANNER_CONFIG_FILENAME} found in ${absolute} or parent directories`,
      );
    }
    return { path: loaded.path };
  }

  throw new ConfigError(`Config path is not a file or directory: ${absolute}`);
}
