import { join } from "node:path";
import { getPackageVersion } from "../package-meta.js";
import { DEFAULT_SINCE, DEFAULT_TOP, runScan } from "../scan.js";
import { runComplexityTrend } from "../trend/run-trend.js";
import { TrendNotTrackedError } from "../trend/types.js";
import { selectAssessCandidates } from "./select-candidates.js";
import {
  ASSESS_RESULT_KIND,
  ASSESS_RESULT_VERSION,
  DEFAULT_MIN_HOTSPOT_SCORE,
  type AssessCandidate,
  type AssessOptions,
  type AssessPatternCounts,
  type AssessResult,
} from "./types.js";

export type RunAssessDeps = {
  runScan?: typeof runScan;
  runComplexityTrend?: typeof runComplexityTrend;
  getPackageVersion?: typeof getPackageVersion;
};

function emptyPatternCounts(): AssessPatternCounts {
  return {
    deteriorating: 0,
    refactored: 0,
    stable: 0,
    inconclusive: 0,
  };
}

function roundMs(durationMs: number): number {
  return Math.round(durationMs);
}

function classifyTrendFailure(error: unknown): {
  status: "skipped" | "error";
  message: string;
} {
  if (error instanceof TrendNotTrackedError) {
    return { status: "skipped", message: error.message };
  }

  if (error instanceof Error) {
    return { status: "error", message: error.message };
  }

  return { status: "error", message: String(error) };
}

function buildFailedCandidate(
  hotspot: {
    filePath: string;
    hotspotScore: number;
    ncloc?: number;
    commitCount?: number;
  },
  failure: { status: "skipped" | "error"; message: string },
): AssessCandidate {
  return {
    filePath: hotspot.filePath,
    hotspotScore: hotspot.hotspotScore,
    ncloc: hotspot.ncloc,
    commitCount: hotspot.commitCount,
    status: failure.status,
    message: failure.message,
  };
}

export async function runAssess(
  options: AssessOptions,
  deps: RunAssessDeps = {},
): Promise<AssessResult> {
  const runScanFn = deps.runScan ?? runScan;
  const runTrendFn = deps.runComplexityTrend ?? runComplexityTrend;
  const resolvePackageVersion = deps.getPackageVersion ?? getPackageVersion;

  const since = options.since ?? DEFAULT_SINCE;
  const top = options.top ?? DEFAULT_TOP;
  const minHotspotScore = options.minHotspotScore ?? DEFAULT_MIN_HOTSPOT_SCORE;
  const totalStart = performance.now();

  const scan = await runScanFn({
    repoPath: options.repoPath,
    configPath: options.configPath,
    since: options.since,
    include: options.include,
    exclude: options.exclude,
    top: options.top,
    concurrency: options.concurrency,
    includeTests: options.includeTests,
    sequential: options.sequential,
    signal: options.signal,
    onWarning: options.onWarning,
    onProgress: options.onProgress,
    onSpawnArgv: options.onSpawnArgv,
  });

  const scanMs = scan.meta.timings?.totalMs;
  const selected = selectAssessCandidates(scan.hotspots, {
    minHotspotScore,
    top,
  });

  const candidates: AssessCandidate[] = [];
  const patternCounts = emptyPatternCounts();
  let skippedCount = 0;
  let errorCount = 0;
  let trendMs = 0;

  for (let index = 0; index < selected.length; index++) {
    const hotspot = selected[index]!;
    options.onAssessProgress?.({
      index: index + 1,
      total: selected.length,
      filePath: hotspot.filePath,
    });

    const trendStart = performance.now();
    try {
      const trend = await runTrendFn({
        filePath: join(options.repoPath, hotspot.filePath),
        repoPath: options.repoPath,
        since: options.since,
        signal: options.signal,
      });

      trendMs += roundMs(performance.now() - trendStart);

      const growthPattern = trend.meta.growthPattern;
      patternCounts[growthPattern.kind] += 1;

      candidates.push({
        filePath: hotspot.filePath,
        hotspotScore: hotspot.hotspotScore,
        ncloc: hotspot.ncloc,
        commitCount: hotspot.commitCount,
        status: "ok",
        growthPattern,
        revisionCount: trend.points.length,
        truncated: trend.meta.truncated,
      });
    } catch (error) {
      trendMs += roundMs(performance.now() - trendStart);
      const failure = classifyTrendFailure(error);
      if (failure.status === "skipped") {
        skippedCount += 1;
      } else {
        errorCount += 1;
      }
      candidates.push(buildFailedCandidate(hotspot, failure));
    }
  }

  const result: AssessResult = {
    version: ASSESS_RESULT_VERSION,
    kind: ASSESS_RESULT_KIND,
    meta: {
      repoPath: options.repoPath,
      since,
      minHotspotScore,
      top,
      scannedHotspotCount: scan.hotspots.length,
      candidateCount: candidates.length,
      patternCounts,
      skippedCount,
      errorCount,
      scannerVersion: resolvePackageVersion(),
      timings: {
        totalMs: roundMs(performance.now() - totalStart),
        scanMs,
        trendMs,
      },
    },
    candidates,
  };

  if (scan.meta.warnings.length > 0) {
    result.meta.warnings = scan.meta.warnings;
  }

  return result;
}
