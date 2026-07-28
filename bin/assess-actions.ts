import { writeFile } from "node:fs/promises";
import {
  loadHotspotScannerConfig,
  mergeScanOptions,
  type HotspotScannerConfig,
} from "#config";
import {
  createCliDiagnosticHandlers,
  type WarningsMode,
} from "#diagnostics";
import {
  renderAssessJson,
  renderAssessMarkdown,
  renderAssessTable,
} from "#report";
import type { AssessResult } from "#assess";
import {
  CliUsageError,
  createVerboseSpawnArgvHandler,
  runWithScanCancelSignals,
  ScanCancelExit,
  validateOutputPath,
} from "./scan-actions.js";

export type AssessOutputFormat = "table" | "json" | "markdown";

export function parseAssessFormat(value: string): AssessOutputFormat {
  if (value === "table" || value === "json" || value === "markdown") {
    return value;
  }
  throw new CliUsageError(
    `Invalid --format: ${value}. Expected table, json, or markdown.`,
  );
}

export function parseMinHotspotScore(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new CliUsageError(
      "--min-hotspot-score must be a number between 0 and 1 (hotspotScore scale)",
    );
  }
  return parsed;
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

function renderAssessOutput(
  result: AssessResult,
  format: AssessOutputFormat,
  color: boolean,
): string {
  if (format === "json") {
    return renderAssessJson(result);
  }
  if (format === "markdown") {
    return renderAssessMarkdown(result);
  }
  return renderAssessTable(result, { color });
}

function createAssessProgressHandler(options: {
  quiet?: boolean;
  noProgress?: boolean;
  stderrIsTTY?: boolean;
}): (progress: { index: number; total: number; filePath: string }) => void {
  if (options.quiet || options.noProgress) {
    return () => {};
  }
  const tty = options.stderrIsTTY ?? false;
  return (progress) => {
    const line = `assess: [${progress.index}/${progress.total}] ${progress.filePath}`;
    if (tty) {
      process.stderr.write(`\r\x1b[2K${line}`);
    } else {
      process.stderr.write(`${line}\n`);
    }
  };
}

export async function executeAssess(options: {
  repoPath: string;
  cliOverrides: HotspotScannerConfig;
  configPath?: string;
  minHotspotScore: number;
  top: number;
  format: AssessOutputFormat;
  outputPath?: string;
  quiet?: boolean;
  noProgress?: boolean;
  includeTests?: boolean;
  sequential?: boolean;
  verbose?: boolean;
  warningsMode?: WarningsMode;
  color?: boolean;
}): Promise<void> {
  const { config: fileConfig } = await loadHotspotScannerConfig(
    options.repoPath,
    {
      configPath: options.configPath,
    },
  );
  const merged = mergeScanOptions({
    config: fileConfig,
    cli: options.cliOverrides,
  });

  const { onWarning, onProgress, flushWarnings, clearLiveProgress } =
    createCliDiagnosticHandlers({
      quiet: options.quiet ?? false,
      noProgress: options.noProgress ?? false,
      warningsMode: options.warningsMode ?? "summary",
      since: merged.since,
      stderrIsTTY: process.stderr.isTTY,
    });

  const onAssessProgress = createAssessProgressHandler({
    quiet: options.quiet,
    noProgress: options.noProgress,
    stderrIsTTY: process.stderr.isTTY,
  });

  const onSpawnArgv = createVerboseSpawnArgvHandler({
    verbose: options.verbose ?? false,
    quiet: options.quiet ?? false,
  });

  const { runAssess } = await import("#assess");

  const result = await runWithScanCancelSignals((signal) =>
    runAssess({
      repoPath: options.repoPath,
      configPath: options.configPath,
      since: merged.since,
      include: merged.include,
      exclude: merged.exclude,
      top: options.top,
      concurrency: merged.concurrency,
      includeTests: options.includeTests,
      sequential: options.sequential,
      minHotspotScore: options.minHotspotScore,
      signal,
      onWarning,
      onProgress,
      onSpawnArgv,
      onAssessProgress,
    }),
  );

  clearLiveProgress();

  const body = renderAssessOutput(result, options.format, options.color ?? false);
  if (options.outputPath !== undefined) {
    await validateOutputPath(options.outputPath);
    await writeFile(options.outputPath, ensureTrailingNewline(body), "utf8");
    if (!options.quiet) {
      process.stderr.write(`Wrote ${options.outputPath}\n`);
    }
  } else {
    process.stdout.write(ensureTrailingNewline(body));
  }

  flushWarnings();
}

export function mapAssessError(error: unknown): never {
  if (error instanceof ScanCancelExit) {
    process.stderr.write("warning: assess cancelled\n");
    throw error;
  }
  throw error;
}
