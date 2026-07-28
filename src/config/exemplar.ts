import { access, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DEFAULT_SINCE, DEFAULT_TOP } from "../scan.js";
import { HOTSPOT_SCANNER_CONFIG_FILENAME } from "./load-config.js";

export const HOTSPOT_SCANNER_CONFIG_SCHEMA_URL =
  "https://raw.githubusercontent.com/AlanTaranti/hotspot-scanner/main/schemas/hotspot-scanner-config.json";

export const EXEMPLAR_HOTSPOT_SCANNER_CONFIG: Record<string, unknown> = {
  $schema: HOTSPOT_SCANNER_CONFIG_SCHEMA_URL,
  $comments: [
    "include: extra globs added to PathScope beyond defaults.",
    "exclude: additional patterns; built-in excludes always apply.",
    "concurrency is omitted — the scanner host default applies.",
    "Precedence: CLI flags override config; config overrides built-in defaults.",
  ],
  since: DEFAULT_SINCE,
  include: ["src/**"],
  exclude: ["**/*.generated.ts"],
  top: DEFAULT_TOP,
};

export class InitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InitError";
  }
}

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
