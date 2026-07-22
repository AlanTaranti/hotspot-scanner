#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { logWarning, maybeLogProgress } from "#diagnostics";
import { createReporter } from "#report";
import { DEFAULT_MIN_COCHANGE } from "#scoring";
import { DEFAULT_SINCE, DEFAULT_TOP, runScan } from "#scan";

export type OutputFormat = "table" | "json";

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
  if (value === "table" || value === "json") {
    return value;
  }
  throw new CliUsageError(
    `Invalid --format: ${value}. Expected table or json.`,
  );
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
    .option("--format <format>", "Output format: table|json", "table")
    .option("--top <n>", "Top N results per ranking", String(DEFAULT_TOP))
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
      const top = parsePositiveInteger(options.top, "--top");
      const minCochange = parsePositiveInteger(
        options.minCochange,
        "--min-cochange",
      );
      const includePatterns = options.include as string[];
      const excludePatterns = options.exclude as string[];
      validateScopePatterns(includePatterns, "--include");
      validateScopePatterns(excludePatterns, "--exclude");

      const result = await runScan({
        repoPath,
        since: options.since,
        top,
        minCochange,
        format,
        include: includePatterns.length > 0 ? includePatterns : undefined,
        exclude: excludePatterns.length > 0 ? excludePatterns : undefined,
        onWarning: logWarning,
        onProgress: ({ commitsProcessed }) =>
          maybeLogProgress(commitsProcessed),
      });

      const output = createReporter().render(result, { format, top });
      process.stdout.write(output.endsWith("\n") ? output : `${output}\n`);
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
