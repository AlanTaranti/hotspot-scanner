import { stat } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { analyzeIndentation } from "../complexity/indentation.js";
import { countNcloc } from "../complexity/ncloc.js";
import {
  listFileRevisions,
  showFileAtRevision,
} from "../git/file-history.js";
import { getPackageVersion } from "../package-meta.js";
import { resolveMonorepoScanPath } from "../paths/resolve-repo.js";
import { DEFAULT_SINCE } from "../scan.js";
import { uniformSample } from "./sample.js";
import { sparkline } from "./sparkline.js";
import {
  DEFAULT_MAX_REVISIONS,
  type ComplexityTrendOptions,
  type ComplexityTrendPoint,
  type ComplexityTrendResult,
  type ComplexityTrendWarning,
  TrendNotTrackedError,
  TrendUsageError,
  TREND_WARNING_CODES,
} from "./types.js";

function validateRangeOptions(options: ComplexityTrendOptions): void {
  const hasSince = options.since !== undefined;
  const hasStart = options.start !== undefined;
  const hasEnd = options.end !== undefined;

  if (hasSince && (hasStart || hasEnd)) {
    throw new TrendUsageError(
      "Cannot combine --since with --start/--end. Use one time-range mode.",
    );
  }

  if (hasStart !== hasEnd) {
    throw new TrendUsageError(
      "--start and --end must be provided together.",
    );
  }
}

async function assertFilePath(filePath: string): Promise<string> {
  const absolutePath = resolve(filePath);
  let fileStat;
  try {
    fileStat = await stat(absolutePath);
  } catch {
    throw new TrendUsageError(`File not found: ${filePath}`);
  }

  if (fileStat.isDirectory()) {
    throw new TrendUsageError(`Expected a file path, got directory: ${filePath}`);
  }

  return absolutePath;
}

function buildTimeOptions(
  options: ComplexityTrendOptions,
): Pick<ComplexityTrendOptions, "since" | "start" | "end"> {
  if (options.start !== undefined && options.end !== undefined) {
    return { start: options.start, end: options.end };
  }

  return { since: options.since ?? DEFAULT_SINCE };
}

export async function runComplexityTrend(
  options: ComplexityTrendOptions,
): Promise<ComplexityTrendResult> {
  validateRangeOptions(options);

  const absoluteFilePath = await assertFilePath(options.filePath);
  const repoLookupPath = options.repoPath ?? dirname(absoluteFilePath);
  const resolved = await resolveMonorepoScanPath(repoLookupPath);
  const repoPath = resolved.repoPath;
  const filePath = relative(repoPath, absoluteFilePath).split("\\").join("/");

  if (filePath.startsWith("..")) {
    throw new TrendUsageError(
      `File is outside the git repository: ${options.filePath}`,
    );
  }

  const follow = options.follow ?? true;
  const timeOptions = buildTimeOptions(options);
  const allRevisions = await listFileRevisions({
    repoPath,
    filePath,
    since: timeOptions.since,
    start: timeOptions.start,
    end: timeOptions.end,
    follow,
    signal: options.signal,
  });

  const warnings: ComplexityTrendWarning[] = [];
  const revisionCount = allRevisions.length;

  if (revisionCount === 0) {
    const tracked = await listFileRevisions({
      repoPath,
      filePath,
      follow,
      signal: options.signal,
    });

    if (tracked.length === 0) {
      throw new TrendNotTrackedError(filePath);
    }

    warnings.push({
      code: TREND_WARNING_CODES.EMPTY_HISTORY,
      message: "No revisions matched the selected time range.",
    });

    return buildResult({
      filePath,
      points: [],
      warnings,
      follow,
      timeOptions,
      revisionCount: 0,
      truncated: false,
      maxRevisions: options.all ? null : (options.maxRevisions ?? DEFAULT_MAX_REVISIONS),
      includeScannerVersion: options.includeScannerVersion,
    });
  }

  const maxRevisions = options.all
    ? null
    : (options.maxRevisions ?? DEFAULT_MAX_REVISIONS);
  const truncated = maxRevisions !== null && revisionCount > maxRevisions;
  const selectedRevisions =
    maxRevisions === null
      ? allRevisions
      : uniformSample(allRevisions, maxRevisions);

  const points: ComplexityTrendPoint[] = [];

  for (let index = 0; index < selectedRevisions.length; index += 1) {
    const revision = selectedRevisions[index]!;
    options.onProgress?.({
      revisionsProcessed: index + 1,
      total: selectedRevisions.length,
    });

    try {
      const source = await showFileAtRevision({
        repoPath,
        rev: revision.rev,
        pathAtRev: revision.pathAtRev,
        signal: options.signal,
      });
      const indent = analyzeIndentation(source);
      points.push({
        rev: revision.rev,
        date: revision.date,
        ncloc: countNcloc(source),
        ...indent,
      });
    } catch (error) {
      warnings.push({
        code: TREND_WARNING_CODES.SHOW_FAILED,
        message: `Skipped revision ${revision.rev}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }

  return buildResult({
    filePath,
    points,
    warnings,
    follow,
    timeOptions,
    revisionCount,
    truncated,
    maxRevisions,
    includeScannerVersion: options.includeScannerVersion,
  });
}

function buildResult(input: {
  filePath: string;
  points: ComplexityTrendPoint[];
  warnings: ComplexityTrendWarning[];
  follow: boolean;
  timeOptions: Pick<ComplexityTrendOptions, "since" | "start" | "end">;
  revisionCount: number;
  truncated: boolean;
  maxRevisions: number | null;
  includeScannerVersion?: boolean;
}): ComplexityTrendResult {
  const meanSeries = input.points.map((point) => point.mean);
  const nclocSeries = input.points.map((point) => point.ncloc);

  return {
    version: "1.0",
    kind: "complexity-trend",
    filePath: input.filePath,
    points: input.points,
    meta: {
      since: input.timeOptions.since,
      start: input.timeOptions.start,
      end: input.timeOptions.end,
      follow: input.follow,
      revisionCount: input.revisionCount,
      truncated: input.truncated,
      maxRevisions: input.maxRevisions,
      sparklines: {
        mean: sparkline(meanSeries),
        ncloc: sparkline(nclocSeries),
      },
      scannerVersion:
        input.includeScannerVersion === false
          ? undefined
          : getPackageVersion(),
      warnings: input.warnings,
    },
  };
}

export function formatTruncationNote(result: ComplexityTrendResult): string | undefined {
  if (!result.meta.truncated || result.meta.maxRevisions === null) {
    return undefined;
  }

  return `${result.points.length} of ${result.meta.revisionCount} revisions (uniform sample); pass --all for full history`;
}
