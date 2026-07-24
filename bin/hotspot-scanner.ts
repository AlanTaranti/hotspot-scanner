#!/usr/bin/env node
import { access, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import {
  compareScanResults,
  loadBaseline,
} from "#compare";
import { logWarning, maybeLogProgress } from "#diagnostics";
import { createReporter } from "#report";
import type { CsvBundle } from "#report";
import { DEFAULT_MIN_COCHANGE } from "#scoring";
import { DEFAULT_SINCE, DEFAULT_TOP, runScan } from "#scan";
import type { ScanGranularity } from "../src/types/index.js";

export type OutputFormat = "table" | "json" | "markdown" | "csv";

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

export function parsePositiveInteger(value: string, flagName: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new CliUsageError(`${flagName} must be a positive integer`);
  }
  return parsed;
}

export function parseFormat(value: string): OutputFormat {
  if (value === "table" || value === "json" || value === "markdown" || value === "csv") {
    return value;
  }
  throw new CliUsageError(
    `Invalid --format: ${value}. Expected table, json, markdown, or csv.`,
  );
}

export function parseGranularity(value: string): ScanGranularity {
  if (value === "file" || value === "function") {
    return value;
  }
  throw new CliUsageError(
    `Invalid --granularity: ${value}. Expected file or function.`,
  );
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

export async function validateBaselinePath(baselinePath: string): Promise<void> {
  if (baselinePath.length === 0) {
    throw new CliUsageError("--baseline path must not be empty");
  }

  let baselineStat;
  try {
    baselineStat = await stat(baselinePath);
  } catch {
    throw new CliUsageError(`--baseline file does not exist: ${baselinePath}`);
  }

  if (baselineStat.isDirectory()) {
    throw new CliUsageError(`--baseline path is a directory: ${baselinePath}`);
  }
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

export function deriveCsvStem(outputPath: string): string {
  if (outputPath.endsWith(".csv")) {
    return outputPath.slice(0, -4);
  }
  return outputPath;
}

export async function writeCsvBundle(
  stem: string,
  bundle: CsvBundle,
): Promise<void> {
  await Promise.all(
    Object.entries(bundle).map(([suffix, content]) =>
      writeFile(`${stem}.${suffix}`, ensureTrailingNewline(content), "utf8"),
    ),
  );
}

function writeReport(output: string, outputPath?: string): Promise<void> {
  const content = ensureTrailingNewline(output);
  if (outputPath) {
    return writeFile(outputPath, content, "utf8");
  }
  process.stdout.write(content);
  return Promise.resolve();
}

export function collectGlob(value: string, previous: string[]): string[] {
  if (value.length === 0) {
    throw new CliUsageError("--include and --exclude patterns must not be empty");
  }
  return previous.concat([value]);
}

export function validateScopePatterns(patterns: string[], flagName: string): void {
  for (const pattern of patterns) {
    if (pattern.length === 0) {
      throw new CliUsageError(`${flagName} patterns must not be empty`);
    }
  }
}

export function createCliProgram(): Command {
  const program = new Command();

  program
    .name("hotspot-scanner")
    .description("Local CLI for TS/JS maintenance hotspot analysis");

  program
    .command("scan")
    .description("Run hotspot and coupling analysis on a repository")
    .argument("<path>", "Repository path")
    .option("--since <period>", "Git history window", DEFAULT_SINCE)
    .option("--format <format>", "Output format: table|json|markdown|csv (csv requires --output)", "table")
    .option(
      "--granularity <mode>",
      "Ranking granularity: file or function",
      "file",
    )
    .option("--output <path>", "Write report to file instead of stdout (required for --format csv)")
    .option(
      "--baseline <path>",
      "Compare scan against baseline JSON from a prior run",
    )
    .option(
      "--top <n>",
      "Top N rows in table/markdown output (ignored for json/csv)",
      String(DEFAULT_TOP),
    )
    .option(
      "--min-cochange <n>",
      "Minimum co-change count for coupling pairs",
      String(DEFAULT_MIN_COCHANGE),
    )
    .option(
      "--include <glob>",
      "Include only paths matching glob (repeatable)",
      collectGlob,
      [] as string[],
    )
    .option(
      "--exclude <glob>",
      "Exclude paths matching glob (repeatable)",
      collectGlob,
      [] as string[],
    )
    .action(async (repoPath: string, options) => {
      const format = parseFormat(options.format);
      const granularity = parseGranularity(options.granularity);
      const top = parsePositiveInteger(options.top, "--top");
      const minCochange = parsePositiveInteger(
        options.minCochange,
        "--min-cochange",
      );
      const includePatterns = options.include as string[];
      const excludePatterns = options.exclude as string[];
      validateScopePatterns(includePatterns, "--include");
      validateScopePatterns(excludePatterns, "--exclude");

      const baselinePath = options.baseline as string | undefined;
      if (baselinePath !== undefined) {
        await validateBaselinePath(baselinePath);
      }

      const result = await runScan({
        repoPath,
        since: options.since,
        top,
        minCochange,
        format,
        granularity,
        include: includePatterns.length > 0 ? includePatterns : undefined,
        exclude: excludePatterns.length > 0 ? excludePatterns : undefined,
        onWarning: logWarning,
        onProgress: ({ commitsProcessed }) =>
          maybeLogProgress(commitsProcessed),
      });

      const reporter = createReporter();
      const outputPath = options.output as string | undefined;

      if (format === "csv" && outputPath === undefined) {
        throw new CliUsageError(
          "--format csv requires --output (writes a multi-file CSV bundle)",
        );
      }

      let output: string | CsvBundle;
      if (baselinePath !== undefined) {
        const baseline = await loadBaseline(baselinePath);
        const compareResult = compareScanResults(baseline, result);
        for (const warning of compareResult.meta.warnings) {
          logWarning(warning);
        }
        output = reporter.renderCompare(compareResult, { format, top });
      } else {
        output = reporter.render(result, { format, top });
      }

      if (format === "csv") {
        await validateOutputPath(outputPath!);
        await writeCsvBundle(deriveCsvStem(outputPath!), output as CsvBundle);
      } else {
        if (outputPath) {
          await validateOutputPath(outputPath);
        }
        await writeReport(output as string, outputPath);
      }
    });

  return program;
}

export async function runCli(argv: string[]): Promise<void> {
  if (argv.length <= 2) {
    throw new CliUsageError(createCliProgram().helpInformation());
  }

  const program = createCliProgram();
  await program.parseAsync(argv);
}

/* v8 ignore start */
async function main(): Promise<void> {
  try {
    await runCli(process.argv);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    const exitCode = error instanceof CliUsageError ? 2 : 1;
    process.exit(exitCode);
  }
}
/* v8 ignore stop */

/* v8 ignore start */
if (
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1]
) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
/* v8 ignore stop */
