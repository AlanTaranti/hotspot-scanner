import { writeFile } from "node:fs/promises";
import {
  renderTrendCsv,
  renderTrendJson,
  renderTrendTable,
} from "#report";
import {
  formatTruncationNote,
  runComplexityTrend,
  TrendNotTrackedError,
  TrendUsageError,
  type ComplexityTrendResult,
} from "#trend";
import {
  CliUsageError,
  runWithScanCancelSignals,
  ScanCancelExit,
  validateOutputPath,
} from "./scan-actions.js";

export type TrendOutputFormat = "table" | "json" | "csv";

export function parseTrendFormat(value: string): TrendOutputFormat {
  if (value === "table" || value === "json" || value === "csv") {
    return value;
  }
  throw new CliUsageError(
    `Invalid --format: ${value}. Expected table, json, or csv.`,
  );
}

function renderTrendOutput(
  result: ComplexityTrendResult,
  format: TrendOutputFormat,
  color: boolean,
): string {
  if (format === "json") {
    return renderTrendJson(result);
  }
  if (format === "csv") {
    return renderTrendCsv(result);
  }
  return renderTrendTable(result, { color });
}

export async function executeTrend(options: {
  filePath: string;
  repoPath?: string;
  since?: string;
  start?: string;
  end?: string;
  maxRevisions?: number;
  all?: boolean;
  follow?: boolean;
  format: TrendOutputFormat;
  outputPath?: string;
  color?: boolean;
}): Promise<void> {
  const result = await runWithScanCancelSignals((signal) =>
    runComplexityTrend({
      filePath: options.filePath,
      repoPath: options.repoPath,
      since: options.since,
      start: options.start,
      end: options.end,
      maxRevisions: options.maxRevisions,
      all: options.all,
      follow: options.follow,
      signal,
    }),
  );

  const truncationNote = formatTruncationNote(result);
  if (truncationNote !== undefined) {
    process.stderr.write(`${truncationNote}\n`);
  }

  for (const warning of result.meta.warnings) {
    process.stderr.write(`warning: ${warning.message}\n`);
  }

  const body = renderTrendOutput(result, options.format, options.color ?? false);
  if (options.outputPath !== undefined) {
    await validateOutputPath(options.outputPath);
    await writeFile(options.outputPath, body, "utf8");
    return;
  }

  process.stdout.write(body);
}

export function mapTrendError(error: unknown): never {
  if (error instanceof TrendUsageError || error instanceof TrendNotTrackedError) {
    throw new CliUsageError(error.message);
  }
  if (error instanceof ScanCancelExit) {
    process.stderr.write("warning: trend cancelled\n");
    throw error;
  }
  throw error;
}
