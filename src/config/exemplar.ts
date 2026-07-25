import { access, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DEFAULT_SINCE, DEFAULT_TOP } from "../scan.js";
import { DEFAULT_MIN_COCHANGE } from "../scoring/index.js";
import {
  HOTSPOT_SCANNER_CONFIG_FILENAME,
  type HotspotScannerConfig,
} from "./load-config.js";

export class InitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InitError";
  }
}

export const EXEMPLAR_HOTSPOT_SCANNER_CONFIG: HotspotScannerConfig = {
  since: DEFAULT_SINCE,
  include: [],
  exclude: [],
  granularity: "file",
  minCochange: DEFAULT_MIN_COCHANGE,
  top: DEFAULT_TOP,
};

export function formatExemplarConfig(): string {
  return `${JSON.stringify(EXEMPLAR_HOTSPOT_SCANNER_CONFIG, null, 2)}\n`;
}

function isEnoent(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

async function assertTargetDirectory(targetDir: string): Promise<void> {
  let stats;
  try {
    stats = await stat(targetDir);
  } catch (error) {
    if (isEnoent(error)) {
      throw new InitError(`Target directory does not exist: ${targetDir}`);
    }
    throw error;
  }

  if (!stats.isDirectory()) {
    throw new InitError(`Target path is not a directory: ${targetDir}`);
  }
}

export async function writeInitConfig(options: {
  targetDir: string;
  force: boolean;
}): Promise<{ path: string }> {
  const { targetDir, force } = options;
  await assertTargetDirectory(targetDir);

  const configPath = join(targetDir, HOTSPOT_SCANNER_CONFIG_FILENAME);

  if (!force) {
    try {
      await access(configPath);
      throw new InitError(
        `Config file already exists: ${configPath}\nHint: pass --force to overwrite.`,
      );
    } catch (error) {
      if (error instanceof InitError) {
        throw error;
      }
      if (!isEnoent(error)) {
        throw error;
      }
    }
  }

  await writeFile(configPath, formatExemplarConfig(), "utf8");
  return { path: configPath };
}
