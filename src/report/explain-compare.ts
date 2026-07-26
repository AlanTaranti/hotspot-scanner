import type {
  CompareResult,
  HotspotScore,
  RankChange,
} from "../types/index.js";
import type { ExplainTarget } from "./explain.js";
import { normalizeExplainPath } from "./explain.js";

const SCORE_DECIMALS = 4;

export type CompareExplainClassification = "new" | "removed" | "rank-changed";

export interface CompareExplainMatch {
  classification: CompareExplainClassification;
  entity: HotspotScore;
  baselineRank?: number;
  currentRank?: number;
  rankDelta?: number;
}

function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function normalizeMatchKey(filePath: string): string {
  return toPosixPath(filePath).replace(/^\.\//, "");
}

function formatScore(value: number): string {
  return value.toFixed(SCORE_DECIMALS);
}

function pathsMatch(storedPath: string, targetPath: string): boolean {
  return normalizeMatchKey(storedPath) === normalizeMatchKey(targetPath);
}

function toNewMatch(entity: HotspotScore): CompareExplainMatch {
  return { classification: "new", entity };
}

function toRemovedMatch(entity: HotspotScore): CompareExplainMatch {
  return { classification: "removed", entity };
}

function toRankChangedMatch(
  change: RankChange<HotspotScore>,
): CompareExplainMatch {
  return {
    classification: "rank-changed",
    entity: change.entity,
    baselineRank: change.baselineRank,
    currentRank: change.currentRank,
    rankDelta: change.rankDelta,
  };
}

function findFileHotspotMatches(
  section: CompareResult["hotspots"],
  targetPath: string,
): CompareExplainMatch[] {
  const inNew = section.new.find((entry) =>
    pathsMatch(entry.filePath, targetPath),
  );
  if (inNew) {
    return [toNewMatch(inNew)];
  }

  const inRemoved = section.removed.find((entry) =>
    pathsMatch(entry.filePath, targetPath),
  );
  if (inRemoved) {
    return [toRemovedMatch(inRemoved)];
  }

  const inRankChanged = section.rankChanged.find((change) =>
    pathsMatch(change.entity.filePath, targetPath),
  );
  if (inRankChanged) {
    return [toRankChangedMatch(inRankChanged)];
  }

  return [];
}

/** Lookup compare delta sections for an `--explain` target (full compare arrays). */
export function findCompareExplainMatches(
  result: CompareResult,
  target: ExplainTarget,
  repoPath: string,
): CompareExplainMatch[] {
  const targetPath = normalizeExplainPath(target.filePath, repoPath);
  return findFileHotspotMatches(result.hotspots, targetPath);
}

function formatHotspotScoreFields(hotspot: HotspotScore): string[] {
  return [
    `filePath: ${hotspot.filePath}`,
    `ncloc: ${hotspot.ncloc}`,
    `normalized size (c): ${formatScore(hotspot.complexityNormalized)}`,
    `churn: commitCount=${hotspot.commitCount}, linesChanged=${hotspot.linesChanged}, authorCount=${hotspot.authorCount}`,
    `normalized churn (h): ${formatScore(hotspot.churnNormalized)}`,
    `hotspotScore: ${formatScore(hotspot.hotspotScore)}`,
    "hotspotScore = 2·c·h / (c+h)",
  ];
}

function formatCompareExplainMatch(match: CompareExplainMatch): string {
  const lines = [
    `=== Compare Explain: ${match.entity.filePath} (${match.classification}) ===`,
    `classification: ${match.classification}`,
  ];

  if (match.classification === "rank-changed") {
    lines.push(`baselineRank: ${match.baselineRank}`);
    lines.push(`currentRank: ${match.currentRank}`);
    lines.push(`rankDelta: ${match.rankDelta}`);
  }

  lines.push(...formatHotspotScoreFields(match.entity));

  return lines.join("\n");
}

/** Format compare explain blocks for stderr. Returns empty string when there are no matches. */
export function formatCompareExplain(matches: CompareExplainMatch[]): string {
  if (matches.length === 0) {
    return "";
  }

  return matches.map(formatCompareExplainMatch).join("\n\n");
}
