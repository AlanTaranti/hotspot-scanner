import { access, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  loadHotspotScannerConfig,
  mergeScanOptions,
  type HotspotScannerConfig,
} from "#config";
import { createCliDiagnosticHandlers, type WarningsMode } from "#diagnostics";
import type { CsvBundle, ReportSection } from "#report";
import { runScan } from "#scan";
import type { ScanOptions, ScanResult } from "#types";

export type { WarningsMode };

export type OutputFormat = "table" | "json" | "markdown" | "csv";

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

export async function validateOutputPath(outputPath: string): Promise<void> {
  if (outputPath.length === 0) {
    throw new CliUsageError("--output path must not be empty");
  }

  try {
    const outputStat = await stat(outputPath);
    if (outputStat.isDirectory()) {
      throw new CliUsageError(`--output path is a directory: ${outputPath}`);
    }
  } catch (error) {
    if (error instanceof CliUsageError) {
      throw error;
    }
    const parentDir = dirname(outputPath);
    try {
      await access(parentDir);
    } catch {
      throw new CliUsageError(
        `--output parent directory does not exist: ${parentDir}`,
      );
    }
  }
}

export function deriveCsvStem(outputPath: string): string {
  if (outputPath.endsWith(".csv")) {
    return outputPath.slice(0, -4);
  }
  return outputPath;
}

export const CSV_SINGLE_FILE_SCAN_KEY = "hotspots.csv";

export function pickSingleFileCsvContent(
  bundle: CsvBundle,
  key: string,
): string {
  const content = bundle[key];
  if (content === undefined) {
    throw new CliUsageError(
      `--csv-single-file requires hotspots CSV content (${key}); ensure --only includes hotspots`,
    );
  }
  return content;
}

export async function writeCsvBundle(
  stem: string,
  bundle: CsvBundle,
  options?: { quiet?: boolean },
): Promise<void> {
  const entries = Object.entries(bundle);
  await Promise.all(
    entries.map(([suffix, content]) =>
      writeFile(`${stem}.${suffix}`, ensureTrailingNewline(content), "utf8"),
    ),
  );
  if (!options?.quiet) {
    process.stderr.write("Wrote CSV bundle:\n");
    for (const [suffix] of entries) {
      process.stderr.write(`  ${stem}.${suffix}\n`);
    }
  }
}

async function resolveEffectiveSince(options: {
  repoPath: string;
  cliOverrides: HotspotScannerConfig;
  configPath?: string;
}): Promise<string> {
  const { config } = await loadHotspotScannerConfig(options.repoPath, {
    configPath: options.configPath,
  });
  return mergeScanOptions({ config, cli: options.cliOverrides }).since;
}

function writeReport(output: string, outputPath?: string): Promise<void> {
  const content = ensureTrailingNewline(output);
  if (outputPath) {
    return writeFile(outputPath, content, "utf8");
  }
  process.stdout.write(content);
  return Promise.resolve();
}

function emitWriteConfirm(path: string, quiet?: boolean): void {
  if (!quiet) {
    process.stderr.write(`Wrote ${path}\n`);
  }
}

export class ScanCancelExit extends Error {
  readonly exitCode: 130 | 143;

  constructor(exitCode: 130 | 143) {
    super(`CLI exited with code ${exitCode}`);
    this.name = "ScanCancelExit";
    this.exitCode = exitCode;
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function createVerboseSpawnArgvHandler(options: {
  verbose: boolean;
  quiet: boolean;
}): ScanOptions["onSpawnArgv"] | undefined {
  if (!options.verbose || options.quiet) {
    return undefined;
  }
  return (argv) => {
    process.stderr.write(`verbose: git ${argv.join(" ")}\n`);
  };
}

export async function runWithScanCancelSignals<T>(
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let cancelExitCode: 130 | 143 | undefined;

  const cleanup = (): void => {
    process.off("SIGINT", onSigint);
    process.off("SIGTERM", onSigterm);
  };

  const onSigint = (): void => {
    cancelExitCode = 130;
    controller.abort();
    cleanup();
  };

  const onSigterm = (): void => {
    cancelExitCode = 143;
    controller.abort();
    cleanup();
  };

  process.on("SIGINT", onSigint);
  process.on("SIGTERM", onSigterm);

  try {
    return await fn(controller.signal);
  } catch (error) {
    if (cancelExitCode !== undefined && isAbortError(error)) {
      process.stderr.write("warning: scan cancelled\n");
      throw new ScanCancelExit(cancelExitCode);
    }
    throw error;
  } finally {
    cleanup();
  }
}

export function buildScanOptions(
  repoPath: string,
  cliOverrides: HotspotScannerConfig,
  callbacks: Pick<
    ScanOptions,
    "onWarning" | "onProgress" | "signal" | "onSpawnArgv"
  >,
  configPath?: string,
  includeTests?: boolean,
  sequential?: boolean,
): ScanOptions {
  const scanOptions: ScanOptions = {
    repoPath,
    ...callbacks,
  };

  if (configPath !== undefined) {
    scanOptions.configPath = configPath;
  }

  if (cliOverrides.since !== undefined) {
    scanOptions.since = cliOverrides.since;
  }
  if (cliOverrides.include !== undefined) {
    scanOptions.include = cliOverrides.include;
  }
  if (cliOverrides.exclude !== undefined) {
    scanOptions.exclude = cliOverrides.exclude;
  }
  if (cliOverrides.top !== undefined) {
    scanOptions.top = cliOverrides.top;
  }
  if (cliOverrides.concurrency !== undefined) {
    scanOptions.concurrency = cliOverrides.concurrency;
  }
  if (includeTests === true) {
    scanOptions.includeTests = true;
  }
  if (sequential === true) {
    scanOptions.sequential = true;
  }

  return scanOptions;
}

export type ScanDiagnosticOptions = {
  quiet?: boolean;
  noProgress?: boolean;
  includeTests?: boolean;
  verbose?: boolean;
  /** CLI stderr warning presentation; default summary. */
  warningsMode?: WarningsMode;
  signal?: AbortSignal;
};

export type ExecuteScanResult = {
  result: ScanResult;
  flushWarnings: () => void;
};

export async function executeScan(
  options: {
    repoPath: string;
    cliOverrides: HotspotScannerConfig;
    configPath?: string;
    sequential?: boolean;
  } & ScanDiagnosticOptions,
): Promise<ExecuteScanResult> {
  const since = await resolveEffectiveSince(options);
  const { onWarning, onProgress, flushWarnings } = createCliDiagnosticHandlers({
    quiet: options.quiet ?? false,
    noProgress: options.noProgress ?? false,
    warningsMode: options.warningsMode ?? "summary",
    since,
  });
  const onSpawnArgv = createVerboseSpawnArgvHandler({
    verbose: options.verbose ?? false,
    quiet: options.quiet ?? false,
  });

  const result = await runScan(
    buildScanOptions(
      options.repoPath,
      options.cliOverrides,
      {
        onWarning,
        onProgress,
        ...(options.signal !== undefined ? { signal: options.signal } : {}),
        ...(onSpawnArgv !== undefined ? { onSpawnArgv } : {}),
      },
      options.configPath,
      options.includeTests,
      options.sequential,
    ),
  );
  return { result, flushWarnings };
}

export type ReporterRenderOptions = {
  format: OutputFormat;
  top: number;
  only?: ReportSection[];
  triageHints: boolean;
  color: boolean;
};

export async function writeRenderedOutput(
  output: string | CsvBundle,
  format: OutputFormat,
  outputPath?: string,
  options?: {
    quiet?: boolean;
    csvSingleFile?: boolean;
    csvBundleKey?: string;
  },
): Promise<void> {
  if (format === "csv") {
    await validateOutputPath(outputPath!);
    if (options?.csvSingleFile) {
      const key = options.csvBundleKey ?? CSV_SINGLE_FILE_SCAN_KEY;
      const content = pickSingleFileCsvContent(output as CsvBundle, key);
      await writeFile(outputPath!, ensureTrailingNewline(content), "utf8");
      emitWriteConfirm(outputPath!, options?.quiet);
      return;
    }
    await writeCsvBundle(deriveCsvStem(outputPath!), output as CsvBundle, {
      quiet: options?.quiet,
    });
    return;
  }

  if (outputPath) {
    await validateOutputPath(outputPath);
  }
  await writeReport(output as string, outputPath);
  if (outputPath) {
    emitWriteConfirm(outputPath, options?.quiet);
  }
}
