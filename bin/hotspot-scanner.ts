#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command, CommanderError } from "commander";
import { BaselineError } from "#compare";
import {
  ConfigError,
  formatConfigPrintJson,
  formatConfigPrintText,
  InitError,
  loadHotspotScannerConfig,
  loadMergedScanConfigWithSources,
  mergeScanOptions,
  validateHotspotScannerConfigFile,
  writeInitConfig,
  type HotspotScannerConfig,
} from "#config";
import {
  createReporter,
  explainTargetFound,
  formatCompareExplain,
  formatExplainBlock,
  findCompareExplainMatches,
  normalizeExplainPath,
  parseExplainTarget,
} from "#report";
import type { ExplainTarget, ReportSection } from "#report";
import {
  DEFAULT_SINCE,
  DEFAULT_TOP,
  formatScanScopePreview,
  previewScanScope,
} from "#scan";
import { runDoctor, formatDoctorJsonReport, type DoctorFinding } from "#doctor";
import type { CompareResult, ScanResult } from "../src/types/index.js";
import {
  buildScanOptions,
  CliUsageError,
  DEFAULT_BASELINE_OUTPUT,
  emitBriefTimingStderr,
  executeCompareAndRender,
  executeScan,
  runWithScanCancelSignals,
  ScanCancelExit,
  writeBaselineJson,
  writeRenderedOutput,
} from "./scan-actions.js";
import { getCompletionScript } from "./completion-scripts.js";

export {
  CliUsageError,
  DEFAULT_BASELINE_OUTPUT,
  deriveCsvStem,
  validateBaselinePath,
  validateOutputPath,
  writeCsvBundle,
} from "./scan-actions.js";

export type OutputFormat = "table" | "json" | "markdown" | "csv";
export type DoctorOutputFormat = "text" | "json";
export type ConfigPrintFormat = "text" | "json";

export function resolvePackageVersion(): string {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  for (const relative of ["../package.json", "../../package.json"]) {
    const pkgPath = join(moduleDir, relative);
    if (!existsSync(pkgPath)) {
      continue;
    }
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      version?: string;
    };
    if (typeof pkg.version === "string") {
      return pkg.version;
    }
  }
  throw new Error("Could not resolve package.json version");
}

export class CliExitError extends Error {
  readonly exitCode: number;

  constructor(exitCode: number) {
    super(`CLI exited with code ${exitCode}`);
    this.name = "CliExitError";
    this.exitCode = exitCode;
  }
}

function formatDoctorFindings(findings: DoctorFinding[]): string {
  const lines = findings.map(
    (finding) => `${finding.status}: ${finding.message}`,
  );
  return `${lines.join("\n")}\n`;
}

export function parsePositiveInteger(value: string, flagName: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new CliUsageError(`${flagName} must be a positive integer`);
  }
  return parsed;
}

export function parseDoctorFormat(value: string): DoctorOutputFormat {
  if (value === "text" || value === "json") {
    return value;
  }
  throw new CliUsageError(
    `Invalid --format: ${value}. Expected text or json.`,
  );
}

export function parseConfigPrintFormat(value: string): ConfigPrintFormat {
  if (value === "text" || value === "json") {
    return value;
  }
  throw new CliUsageError(
    `Invalid --format: ${value}. Expected text or json.`,
  );
}

export function parseFormat(value: string): OutputFormat {
  if (
    value === "table" ||
    value === "json" ||
    value === "markdown" ||
    value === "csv"
  ) {
    return value;
  }
  throw new CliUsageError(
    `Invalid --format: ${value}. Expected table, json, markdown, or csv.`,
  );
}

export type WarningsMode = "summary" | "full" | "json";

export function parseWarningsMode(value: string): WarningsMode {
  if (value === "summary" || value === "full" || value === "json") {
    return value;
  }
  throw new CliUsageError(
    `Invalid --warnings: ${value}. Expected summary, full, or json.`,
  );
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

/** Reject path:function explain targets (file paths only). */
export function validateExplainTarget(raw: string): void {
  try {
    parseExplainTarget(raw);
  } catch (error) {
    if (error instanceof Error && error.name === "CliUsageError") {
      throw new CliUsageError(error.message);
    }
    throw error;
  }
}

function normalizeExplainTarget(
  target: ExplainTarget,
  repoPath: string,
): ExplainTarget {
  return {
    kind: "file",
    filePath: normalizeExplainPath(target.filePath, repoPath),
  };
}

function writeExplainBlock(
  result: ScanResult,
  explainRaw: string,
  repoPath: string,
): boolean {
  const target = normalizeExplainTarget(
    parseExplainTarget(explainRaw),
    repoPath,
  );
  const block = formatExplainBlock(result, target);
  process.stderr.write(ensureTrailingNewline(block));
  return explainTargetFound(result, target);
}

function writeCompareExplainBlock(
  compareResult: CompareResult,
  explainRaw: string,
  repoPath: string,
): boolean {
  const target = normalizeExplainTarget(
    parseExplainTarget(explainRaw),
    repoPath,
  );
  const matches = findCompareExplainMatches(compareResult, target, repoPath);
  const block = formatCompareExplain(matches);
  if (block === "") {
    process.stderr.write(
      ensureTrailingNewline(`explain: no compare delta for ${explainRaw}`),
    );
    return false;
  }
  process.stderr.write(ensureTrailingNewline(block));
  return true;
}

function hasCompareSinceMismatch(compareResult: CompareResult): boolean {
  return compareResult.meta.warnings.some(
    (warning) => warning.code === "COMPARE_SINCE_MISMATCH",
  );
}

function enforceStrictCompare(compareResult: CompareResult, strict: boolean): void {
  if (strict && hasCompareSinceMismatch(compareResult)) {
    throw new CliExitError(1);
  }
}

export function collectGlob(value: string, previous: string[]): string[] {
  if (value.length === 0) {
    throw new CliUsageError(
      "--include and --exclude patterns must not be empty",
    );
  }
  return previous.concat([value]);
}

const VALID_ONLY_SECTIONS: readonly ReportSection[] = ["hotspots"];

export function parseOnlySectionCli(value: string): ReportSection {
  if (value.length === 0) {
    throw new CliUsageError("--only section must not be empty");
  }
  if (!VALID_ONLY_SECTIONS.includes(value as ReportSection)) {
    throw new CliUsageError(
      `Invalid --only: ${value}. Expected hotspots.`,
    );
  }
  return value as ReportSection;
}

export function collectOnlySection(
  value: string,
  previous: ReportSection[],
): ReportSection[] {
  return [...previous, parseOnlySectionCli(value)];
}

export function resolveTableColor(opts: {
  format: OutputFormat;
  outputPath?: string;
  noColor: boolean;
  envNoColor: string | undefined;
  stdoutIsTTY: boolean | undefined;
}): boolean {
  if (opts.format !== "table") {
    return false;
  }
  if (opts.noColor) {
    return false;
  }
  if (opts.envNoColor !== undefined && opts.envNoColor.length > 0) {
    return false;
  }
  if (opts.outputPath !== undefined) {
    return false;
  }
  if (opts.stdoutIsTTY !== true) {
    return false;
  }
  return true;
}

export function validateScopePatterns(
  patterns: string[],
  flagName: string,
): void {
  for (const pattern of patterns) {
    if (pattern.length === 0) {
      throw new CliUsageError(`${flagName} patterns must not be empty`);
    }
  }
}

function isExplicitCliOption(cmd: Command, optionName: string): boolean {
  return cmd.getOptionValueSource(optionName) === "cli";
}

const SEQUENTIAL_OPTION_HELP =
  "Run git mining and complexity analysis sequentially (disables concurrent stage overlap; lowers peak memory)";
const NO_OVERLAP_OPTION_HELP =
  "Alias for --sequential — run git and complexity one after the other";
const WARNINGS_OPTION_HELP =
  "Stderr warning presentation: summary|full|json (meta.warnings always full)";
const FAIL_ON_EXPLAIN_MISS_OPTION_HELP =
  "Exit 1 when --explain target is not found (requires --explain)";
const CSV_SINGLE_FILE_OPTION_HELP =
  "Write one CSV to exact --output instead of stem bundle (scan: hotspots; compare: hotspots.new; requires --format csv)";

export function resolveSequentialCliOption(options: {
  sequential?: boolean;
  noOverlap?: boolean;
  overlap?: boolean;
}): boolean {
  return Boolean(
    options.sequential || options.noOverlap || options.overlap === false,
  );
}

export function buildCliConfigOverrides(
  cmd: Command,
  options: Record<string, unknown>,
): HotspotScannerConfig {
  const cli: HotspotScannerConfig = {};

  if (isExplicitCliOption(cmd, "since")) {
    cli.since = options.since as string;
  }
  if (isExplicitCliOption(cmd, "top")) {
    cli.top = parsePositiveInteger(options.top as string, "--top");
  }
  if (isExplicitCliOption(cmd, "concurrency")) {
    cli.concurrency = parsePositiveInteger(
      options.concurrency as string,
      "--concurrency",
    );
  }
  if (isExplicitCliOption(cmd, "include")) {
    const includePatterns = options.include as string[];
    validateScopePatterns(includePatterns, "--include");
    cli.include = includePatterns;
  }
  if (isExplicitCliOption(cmd, "exclude")) {
    const excludePatterns = options.exclude as string[];
    validateScopePatterns(excludePatterns, "--exclude");
    cli.exclude = excludePatterns;
  }

  return cli;
}

export function createCliProgram(): Command {
  const program = new Command();

  program
    .name("hotspot-scanner")
    .description(
      "Local CLI for TS/JS maintenance hotspot analysis (init, doctor, scan)",
    )
    .version(resolvePackageVersion(), "-V, --version");

  const config = program
    .command("config")
    .description("Validate and inspect hotspot-scanner configuration");

  config
    .command("validate")
    .description(
      "Validate .hotspot-scanner.json (file path or directory with parent walk)",
    )
    .argument(
      "[path]",
      "Config file or directory to search (default: current working directory)",
      ".",
    )
    .action(async (pathOrDir: string) => {
      const { path } = await validateHotspotScannerConfigFile(pathOrDir);
      process.stdout.write(`Config file is valid: ${path}\n`);
    });

  config
    .command("print")
    .description(
      "Print effective merged scan options with cli/config/default source tags",
    )
    .argument(
      "[path]",
      "Repository path for config discovery (default: current working directory)",
      ".",
    )
    .option("--since <period>", "Git history window", DEFAULT_SINCE)
    .option(
      "-f, --format <format>",
      "Output format: text or json",
      "text",
    )
    .option(
      "-t, --top <n>",
      "Top N rows in table/markdown output (ignored for json/csv)",
      String(DEFAULT_TOP),
    )
    .option(
      "--concurrency <n>",
      "Complexity worker pool size (positive integer)",
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
    .option(
      "--config <path>",
      "Load config from explicit file (skip parent walk)",
    )
    .action(async function (repoPath: string, options) {
      const cmd = this as Command;
      const format = parseConfigPrintFormat(options.format as string);
      const configPath = isExplicitCliOption(cmd, "config")
        ? (options.config as string)
        : undefined;
      const cliOverrides = buildCliConfigOverrides(cmd, options);
      const merged = await loadMergedScanConfigWithSources({
        repoPath,
        configPath,
        cli: cliOverrides,
      });
      const output =
        format === "json"
          ? formatConfigPrintJson(merged)
          : formatConfigPrintText(merged);
      process.stdout.write(output);
    });

  program
    .command("init")
    .description("Write exemplar .hotspot-scanner.json to a directory")
    .argument(
      "[directory]",
      "Target directory (default: current working directory)",
      ".",
    )
    .option("--force", "Overwrite existing config file")
    .action(async (directory: string, options) => {
      const { path } = await writeInitConfig({
        targetDir: directory,
        force: Boolean(options.force),
      });
      process.stdout.write(`Wrote config to ${path}\n`);
    });

  program
    .command("doctor")
    .description("Check Node, git, repository, and config readiness")
    .argument(
      "[path]",
      "Repository path (default: current working directory)",
      ".",
    )
    .option(
      "-f, --format <format>",
      "Output format: text or json",
      "text",
    )
    .option(
      "--config <path>",
      "Load config from explicit file (skip parent walk)",
    )
    .option(
      "--include-tests",
      "Include test files in scope inventory (lift built-in test excludes)",
    )
    .action(async function (targetPath: string, options) {
      const cmd = this as Command;
      const format = parseDoctorFormat(options.format as string);
      const configPath = isExplicitCliOption(cmd, "config")
        ? (options.config as string)
        : undefined;
      const includeTests = isExplicitCliOption(cmd, "includeTests")
        ? true
        : undefined;
      const result = await runDoctor({
        targetPath,
        configPath,
        ...(includeTests !== undefined ? { includeTests } : {}),
      });
      const output =
        format === "json"
          ? formatDoctorJsonReport(result)
          : formatDoctorFindings(result.findings);
      process.stdout.write(output);
      if (result.exitCode !== 0) {
        throw new CliExitError(result.exitCode);
      }
    });

  program
    .command("scan")
    .description(
      "Run hotspot analysis on a repository (discovers .hotspot-scanner.json upward; use --config for explicit path)",
    )
    .argument("[path]", "Repository path (default: .)", ".")
    .option("--since <period>", "Git history window", DEFAULT_SINCE)
    .option(
      "-f, --format <format>",
      "Output format: table|json|markdown|csv (csv requires --output)",
      "table",
    )
    .option(
      "-o, --output <path>",
      "Write report to file instead of stdout (required for --format csv)",
    )
    .option(
      "--baseline <path>",
      "Compare scan against baseline JSON from a prior run",
    )
    .option(
      "-t, --top <n>",
      "Top N rows in table/markdown output (ignored for json/csv)",
      String(DEFAULT_TOP),
    )
    .option(
      "--concurrency <n>",
      "Complexity worker pool size (positive integer)",
    )
    .option("--sequential", SEQUENTIAL_OPTION_HELP)
    .option("--no-overlap", NO_OVERLAP_OPTION_HELP)
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
    .option(
      "--include-tests",
      "Include test files in scan scope (lift built-in test excludes)",
    )
    .option(
      "--config <path>",
      "Load config from explicit file (skip parent walk)",
    )
    .option(
      "--quiet",
      "Suppress progress and info-level diagnostics (warnings/errors remain)",
    )
    .option("--verbose", "Trace git spawn argv on stderr")
    .option("--no-progress", "Suppress progress lines on stderr")
    .option("--warnings <mode>", WARNINGS_OPTION_HELP, "summary")
    .option(
      "--dry-run",
      "Preview effective scan scope without running git history or NCLOC analysis",
    )
    .option(
      "--only <section>",
      "Include only report sections: hotspots (repeatable)",
      collectOnlySection,
      [] as ReportSection[],
    )
    .option(
      "--no-triage-hints",
      "Suppress triage hints in scan table and markdown output",
    )
    .option("--no-color", "Disable ANSI colors in table output")
    .option(
      "--explain <target>",
      "After the report, print a score breakdown for <path> to stderr",
    )
    .option(
      "--fail-on-explain-miss",
      FAIL_ON_EXPLAIN_MISS_OPTION_HELP,
    )
    .option(
      "--csv-single-file",
      CSV_SINGLE_FILE_OPTION_HELP,
    )
    .option(
      "--strict",
      "Exit 1 when compare reports COMPARE_SINCE_MISMATCH (after report write)",
    )
    .addHelpText(
      "after",
      `
Note: JSON output with --only omits sections and is not suitable as a --baseline.

Examples:
  $ hotspot-scanner scan
    Scan current directory (default path .)

  $ hotspot-scanner scan -f json -o report.json
    Write JSON report to file

  $ hotspot-scanner scan -f table -t 10
    Table output using short aliases for top

  $ hotspot-scanner scan --baseline prior.json -f json
    Compare against a prior JSON baseline (optional)
`,
    )
    .action(async function (repoPath: string, options) {
      const cmd = this as Command;
      const configPath = isExplicitCliOption(cmd, "config")
        ? (options.config as string)
        : undefined;
      const cliOverrides = buildCliConfigOverrides(cmd, options);
      const baselinePath = options.baseline as string | undefined;
      const explainTarget = options.explain as string | undefined;
      const failOnExplainMiss = Boolean(options.failOnExplainMiss);
      const strict = Boolean(options.strict);
      const csvSingleFile = Boolean(options.csvSingleFile);

      if (options.dryRun) {
        if (baselinePath !== undefined) {
          throw new CliUsageError("--baseline cannot be used with --dry-run");
        }
        const preview = await previewScanScope(
          buildScanOptions(
            repoPath,
            cliOverrides,
            {},
            configPath,
            options.includeTests as boolean | undefined,
          ),
        );
        process.stdout.write(formatScanScopePreview(preview));
        return;
      }

      const format = parseFormat(options.format);
      const { config: fileConfig } = await loadHotspotScannerConfig(repoPath, {
        configPath,
      });
      const merged = mergeScanOptions({
        config: fileConfig,
        cli: cliOverrides,
      });
      const top = merged.top;

      if (explainTarget !== undefined) {
        validateExplainTarget(explainTarget);
      } else if (failOnExplainMiss) {
        throw new CliUsageError("--fail-on-explain-miss requires --explain");
      }

      const outputPath = options.output as string | undefined;
      const onlySections = options.only as ReportSection[];
      const only = onlySections.length > 0 ? onlySections : undefined;
      const triageHints = options.triageHints !== false;
      const color = resolveTableColor({
        format,
        outputPath,
        noColor: options.color === false,
        envNoColor: process.env.NO_COLOR,
        stdoutIsTTY: process.stdout.isTTY,
      });
      const reporterOptions = { format, top, only, triageHints, color };
      const sequential = resolveSequentialCliOption(options);
      const warningsMode = parseWarningsMode(options.warnings as string);

      if (csvSingleFile && format !== "csv") {
        throw new CliUsageError("--csv-single-file requires --format csv");
      }

      if (format === "csv" && outputPath === undefined) {
        throw new CliUsageError(
          "--format csv requires --output (writes a multi-file CSV bundle)\nHint: add --output <stem> to write the CSV bundle to disk.",
        );
      }

      let result: ScanResult | undefined;
      let compareResult: CompareResult | undefined;
      if (baselinePath !== undefined) {
        compareResult = await runWithScanCancelSignals((signal) =>
          executeCompareAndRender({
            repoPath,
            baselinePath,
            cliOverrides,
            configPath,
            outputPath,
            reporterOptions,
            quiet: options.quiet as boolean,
            noProgress: options.progress === false,
            includeTests: options.includeTests as boolean | undefined,
            verbose: options.verbose as boolean,
            warningsMode,
            sequential,
            csvSingleFile,
            signal,
          }),
        );
        emitBriefTimingStderr(
          compareResult.meta.current.timings,
          options.quiet as boolean,
        );
      } else {
        const scanOutcome = await runWithScanCancelSignals((signal) =>
          executeScan({
            repoPath,
            cliOverrides,
            configPath,
            quiet: options.quiet as boolean,
            noProgress: options.progress === false,
            includeTests: options.includeTests as boolean | undefined,
            verbose: options.verbose as boolean,
            warningsMode,
            sequential,
            signal,
          }),
        );
        result = scanOutcome.result;

        const reporter = createReporter();
        const output = reporter.render(result, reporterOptions);
        scanOutcome.emitWarningTeaser();
        await writeRenderedOutput(output, format, outputPath, {
          quiet: options.quiet as boolean,
          ...(csvSingleFile ? { csvSingleFile: true } : {}),
        });
        scanOutcome.flushWarnings();
        emitBriefTimingStderr(result.meta.timings, options.quiet as boolean);
      }

      if (explainTarget !== undefined) {
        const found =
          compareResult !== undefined
            ? writeCompareExplainBlock(compareResult, explainTarget, repoPath)
            : writeExplainBlock(result!, explainTarget, repoPath);
        if (failOnExplainMiss && !found) {
          throw new CliExitError(1);
        }
      }

      if (compareResult !== undefined) {
        enforceStrictCompare(compareResult, strict);
      }
    });

  const baseline = program
    .command("baseline")
    .description("Baseline file workflows");

  baseline
    .command("save")
    .description("Run a scan and write ScanResult JSON as a baseline")
    .argument("[path]", "Repository path (default: .)", ".")
    .option(
      "-o, --output <path>",
      "Baseline file path",
      DEFAULT_BASELINE_OUTPUT,
    )
    .option("--since <period>", "Git history window", DEFAULT_SINCE)
    .option(
      "-t, --top <n>",
      "Top N rows in table/markdown output (ignored for baseline JSON)",
      String(DEFAULT_TOP),
    )
    .option(
      "--concurrency <n>",
      "Complexity worker pool size (positive integer)",
    )
    .option("--sequential", SEQUENTIAL_OPTION_HELP)
    .option("--no-overlap", NO_OVERLAP_OPTION_HELP)
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
    .option(
      "--include-tests",
      "Include test files in scan scope (lift built-in test excludes)",
    )
    .option(
      "--config <path>",
      "Load config from explicit file (skip parent walk)",
    )
    .option(
      "--quiet",
      "Suppress progress and info-level diagnostics (warnings/errors remain)",
    )
    .option("--verbose", "Trace git spawn argv on stderr")
    .option("--no-progress", "Suppress progress lines on stderr")
    .option("--warnings <mode>", WARNINGS_OPTION_HELP, "summary")
    .addHelpText(
      "after",
      `
Writes a full ScanResult JSON file suitable for hotspot-scanner compare --baseline.
Default output is ${DEFAULT_BASELINE_OUTPUT} in the current working directory.
Existing files are overwritten without prompt.

Examples:
  $ hotspot-scanner baseline save
    Save baseline for current directory to ./hotspot-baseline.json

  $ hotspot-scanner baseline save . -o ci/baseline.json
    Save baseline to a custom path
`,
    )
    .action(async function (repoPath: string, options) {
      const cmd = this as Command;
      const configPath = isExplicitCliOption(cmd, "config")
        ? (options.config as string)
        : undefined;
      const cliOverrides = buildCliConfigOverrides(cmd, options);
      const outputPath = options.output as string;
      const sequential = resolveSequentialCliOption(options);
      const warningsMode = parseWarningsMode(options.warnings as string);

      const { result, emitWarningTeaser, flushWarnings } = await executeScan({
        repoPath,
        cliOverrides,
        configPath,
        quiet: options.quiet as boolean,
        noProgress: options.progress === false,
        includeTests: options.includeTests as boolean | undefined,
        verbose: options.verbose as boolean,
        warningsMode,
        sequential,
      });

      emitWarningTeaser();
      await writeBaselineJson(result, outputPath);
      flushWarnings();
    });

  program
    .command("compare")
    .description("Compare current scan against a baseline JSON file")
    .argument("[path]", "Repository path (default: .)", ".")
    .requiredOption(
      "--baseline <path>",
      "Baseline ScanResult JSON from a prior run (required)",
    )
    .option("--since <period>", "Git history window", DEFAULT_SINCE)
    .option(
      "-f, --format <format>",
      "Output format: table|json|markdown|csv (csv requires --output)",
      "table",
    )
    .option(
      "-o, --output <path>",
      "Write report to file instead of stdout (required for --format csv)",
    )
    .option(
      "-t, --top <n>",
      "Top N rows in table/markdown output (ignored for json/csv)",
      String(DEFAULT_TOP),
    )
    .option(
      "--concurrency <n>",
      "Complexity worker pool size (positive integer)",
    )
    .option("--sequential", SEQUENTIAL_OPTION_HELP)
    .option("--no-overlap", NO_OVERLAP_OPTION_HELP)
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
    .option(
      "--include-tests",
      "Include test files in scan scope (lift built-in test excludes)",
    )
    .option(
      "--config <path>",
      "Load config from explicit file (skip parent walk)",
    )
    .option(
      "--quiet",
      "Suppress progress and info-level diagnostics (warnings/errors remain)",
    )
    .option("--verbose", "Trace git spawn argv on stderr")
    .option("--no-progress", "Suppress progress lines on stderr")
    .option("--warnings <mode>", WARNINGS_OPTION_HELP, "summary")
    .option(
      "--only <section>",
      "Include only report sections: hotspots (repeatable)",
      collectOnlySection,
      [] as ReportSection[],
    )
    .option(
      "--no-triage-hints",
      "Suppress triage hints in compare table and markdown output",
    )
    .option("--no-color", "Disable ANSI colors in table output")
    .option(
      "--explain <target>",
      "After the report, print compare delta breakdown for <path> to stderr",
    )
    .option(
      "--fail-on-explain-miss",
      FAIL_ON_EXPLAIN_MISS_OPTION_HELP,
    )
    .option(
      "--csv-single-file",
      CSV_SINGLE_FILE_OPTION_HELP,
    )
    .option(
      "--strict",
      "Exit 1 when compare reports COMPARE_SINCE_MISMATCH (after report write)",
    )
    .addHelpText(
      "after",
      `
Requires --baseline pointing to a ScanResult JSON file (e.g. from baseline save).

Examples:
  $ hotspot-scanner compare --baseline ./hotspot-baseline.json
    Compare current directory against default baseline path

  $ hotspot-scanner compare . --baseline prior.json -f json
    Compare with JSON output to stdout

  $ hotspot-scanner compare . --baseline prior.json -f csv -o report.csv
    Write compare CSV bundle to disk
`,
    )
    .action(async function (repoPath: string, options) {
      const cmd = this as Command;
      const configPath = isExplicitCliOption(cmd, "config")
        ? (options.config as string)
        : undefined;
      const cliOverrides = buildCliConfigOverrides(cmd, options);
      const baselinePath = options.baseline as string;
      const explainTarget = options.explain as string | undefined;
      const failOnExplainMiss = Boolean(options.failOnExplainMiss);
      const strict = Boolean(options.strict);
      const csvSingleFile = Boolean(options.csvSingleFile);
      const format = parseFormat(options.format);
      const { config: fileConfig } = await loadHotspotScannerConfig(repoPath, {
        configPath,
      });
      const merged = mergeScanOptions({
        config: fileConfig,
        cli: cliOverrides,
      });
      const top = merged.top;

      if (explainTarget !== undefined) {
        validateExplainTarget(explainTarget);
      } else if (failOnExplainMiss) {
        throw new CliUsageError("--fail-on-explain-miss requires --explain");
      }

      const outputPath = options.output as string | undefined;
      const onlySections = options.only as ReportSection[];
      const only = onlySections.length > 0 ? onlySections : undefined;
      const triageHints = options.triageHints !== false;
      const color = resolveTableColor({
        format,
        outputPath,
        noColor: options.color === false,
        envNoColor: process.env.NO_COLOR,
        stdoutIsTTY: process.stdout.isTTY,
      });
      const reporterOptions = { format, top, only, triageHints, color };
      const sequential = resolveSequentialCliOption(options);
      const warningsMode = parseWarningsMode(options.warnings as string);

      if (csvSingleFile && format !== "csv") {
        throw new CliUsageError("--csv-single-file requires --format csv");
      }

      if (format === "csv" && outputPath === undefined) {
        throw new CliUsageError(
          "--format csv requires --output (writes a multi-file CSV bundle)\nHint: add --output <stem> to write the CSV bundle to disk.",
        );
      }

      const compareResult = await runWithScanCancelSignals((signal) =>
        executeCompareAndRender({
          repoPath,
          baselinePath,
          cliOverrides,
          configPath,
          outputPath,
          reporterOptions,
          quiet: options.quiet as boolean,
          noProgress: options.progress === false,
          includeTests: options.includeTests as boolean | undefined,
          verbose: options.verbose as boolean,
          warningsMode,
          sequential,
          csvSingleFile,
          signal,
        }),
      );
      emitBriefTimingStderr(
        compareResult.meta.current.timings,
        options.quiet as boolean,
      );

      if (explainTarget !== undefined) {
        const found = writeCompareExplainBlock(
          compareResult,
          explainTarget,
          repoPath,
        );
        if (failOnExplainMiss && !found) {
          throw new CliExitError(1);
        }
      }

      enforceStrictCompare(compareResult, strict);
    });

  program
    .command("completion")
    .description("Print shell completion script to stdout")
    .argument("<shell>", "Shell: bash | zsh | fish")
    .addHelpText(
      "after",
      `
Supported shells: bash, zsh, fish

Examples:
  $ hotspot-scanner completion bash >> ~/.bashrc
  $ hotspot-scanner completion zsh > ~/.zfunc/_hotspot-scanner
  $ source (hotspot-scanner completion fish | psub)
`,
    )
    .action((shell: string) => {
      const script = getCompletionScript(shell);
      process.stdout.write(ensureTrailingNewline(script));
    });

  return program;
}

const KNOWN_COMMANDS = new Set([
  "init",
  "config",
  "doctor",
  "scan",
  "baseline",
  "compare",
  "completion",
]);

function looksLikePathToken(token: string): boolean {
  if (token === "." || token.startsWith("./") || isAbsolute(token)) {
    return true;
  }
  try {
    return statSync(token).isDirectory();
  } catch {
    return false;
  }
}

export function maybeRewritePathToScan(argv: string[]): string[] {
  if (argv.length <= 2) {
    return argv;
  }
  const first = argv[2]!;
  if (KNOWN_COMMANDS.has(first)) {
    return argv;
  }
  if (
    first === "-h" ||
    first === "--help" ||
    first === "-V" ||
    first === "--version"
  ) {
    return argv;
  }
  if (first.startsWith("-")) {
    return argv;
  }
  if (!looksLikePathToken(first)) {
    return argv;
  }
  return [argv[0]!, argv[1]!, "scan", ...argv.slice(2)];
}

export async function runCli(argv: string[]): Promise<void> {
  if (argv.length <= 2) {
    throw new CliUsageError(createCliProgram().helpInformation());
  }

  const program = createCliProgram();
  program.exitOverride();
  try {
    await program.parseAsync(maybeRewritePathToScan(argv));
  } catch (error) {
    if (error instanceof CommanderError && error.exitCode === 0) {
      return;
    }
    throw error;
  }
}

export function resolveCliExitCode(error: unknown): number {
  if (error instanceof CliExitError || error instanceof ScanCancelExit) {
    return error.exitCode;
  }
  if (
    error instanceof CliUsageError ||
    error instanceof ConfigError ||
    error instanceof InitError ||
    error instanceof BaselineError
  ) {
    return 2;
  }
  return 1;
}

/* v8 ignore start */
async function main(): Promise<void> {
  try {
    await runCli(process.argv);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (!(error instanceof CliExitError) && !(error instanceof ScanCancelExit)) {
      console.error(message);
    }
    process.exit(resolveCliExitCode(error));
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
