import type {
  CompareResult,
  FunctionHotspotScore,
  HotspotScore,
  RankChange,
} from "../types/index.js";
import type { ExplainTarget } from "./explain.js";
import { normalizeExplainPath } from "./explain.js";

const SCORE_DECIMALS = 4;

export type CompareExplainClassification = "new" | "removed" | "rank-changed";

export interface CompareExplainMatch {
  classification: CompareExplainClassification;
  entity: HotspotScore | FunctionHotspotScore;
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

function toNewMatch(
  entity: HotspotScore | FunctionHotspotScore,
): CompareExplainMatch {
  return { classification: "new", entity };
}

function toRemovedMatch(
  entity: HotspotScore | FunctionHotspotScore,
): CompareExplainMatch {
  return { classification: "removed", entity };
}

function toRankChangedMatch<T extends HotspotScore | FunctionHotspotScore>(
  change: RankChange<T>,
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

function findFunctionMatchesInSection(
  entries: FunctionHotspotScore[],
  targetPath: string,
  functionName?: string,
): FunctionHotspotScore[] {
  return entries.filter((entry) => {
    if (!pathsMatch(entry.filePath, targetPath)) {
      return false;
    }
    if (functionName !== undefined && entry.functionName !== functionName) {
      return false;
    }
    return true;
  });
}

function findFunctionDeltaMatches(
  section: CompareResult["functions"],
  targetPath: string,
  functionName?: string,
  allClassifications = false,
): CompareExplainMatch[] {
  const newMatches = findFunctionMatchesInSection(
    section.new,
    targetPath,
    functionName,
  ).map(toNewMatch);
  const removedMatches = findFunctionMatchesInSection(
    section.removed,
    targetPath,
    functionName,
  ).map(toRemovedMatch);
  const rankChangedMatches = section.rankChanged
    .filter(
      (change) =>
        pathsMatch(change.entity.filePath, targetPath) &&
        (functionName === undefined ||
          change.entity.functionName === functionName),
    )
    .map(toRankChangedMatch);

  if (allClassifications) {
    return [...newMatches, ...removedMatches, ...rankChangedMatches];
  }

  if (newMatches.length > 0) {
    return newMatches;
  }
  if (removedMatches.length > 0) {
    return removedMatches;
  }
  return rankChangedMatches;
}

/** Lookup compare delta sections for an `--explain` target (full compare arrays). */
export function findCompareExplainMatches(
  result: CompareResult,
  target: ExplainTarget,
  repoPath: string,
): CompareExplainMatch[] {
  const targetPath = normalizeExplainPath(target.filePath, repoPath);

  if (result.granularity === "file") {
    return findFileHotspotMatches(result.hotspots, targetPath);
  }

  const functionName =
    target.kind === "function" ? target.functionName : undefined;
  const allClassifications = target.kind === "file";

  return findFunctionDeltaMatches(
    result.functions,
    targetPath,
    functionName,
    allClassifications,
  );
}

function formatHotspotScoreFields(hotspot: HotspotScore): string[] {
  return [
    `filePath: ${hotspot.filePath}`,
    `complexity: cyclomaticComplexity=${hotspot.cyclomaticComplexity}, functionCount=${hotspot.functionCount}`,
    `normalized complexity (c): ${formatScore(hotspot.complexityNormalized)}`,
    `churn: commitCount=${hotspot.commitCount}, linesChanged=${hotspot.linesChanged}, authorCount=${hotspot.authorCount}`,
    `normalized churn (h): ${formatScore(hotspot.churnNormalized)}`,
    `hotspotScore: ${formatScore(hotspot.hotspotScore)}`,
    "hotspotScore = 2·c·h / (c+h)",
  ];
}

function formatFunctionScoreFields(entry: FunctionHotspotScore): string[] {
  return [
    `filePath: ${entry.filePath}`,
    `functionName: ${entry.functionName}`,
    `line: ${entry.line}`,
    `complexity: ${entry.complexity}`,
    `normalized complexity (c): ${formatScore(entry.complexityNormalized)}`,
    `churn: commitCount=${entry.commitCount}, linesChanged=${entry.linesChanged}, authorCount=${entry.authorCount}`,
    `normalized churn (h): ${formatScore(entry.churnNormalized)}`,
    `hotspotScore: ${formatScore(entry.hotspotScore)}`,
    "hotspotScore = 2·c·h / (c+h)",
  ];
}

function formatMatchIdentity(match: CompareExplainMatch): string {
  if ("functionName" in match.entity) {
    return `${match.entity.filePath} — ${match.entity.functionName}`;
  }
  return match.entity.filePath;
}

function formatCompareExplainMatch(match: CompareExplainMatch): string {
  const identity = formatMatchIdentity(match);
  const lines = [
    `=== Compare Explain: ${identity} (${match.classification}) ===`,
    `classification: ${match.classification}`,
  ];

  if (match.classification === "rank-changed") {
    lines.push(`baselineRank: ${match.baselineRank}`);
    lines.push(`currentRank: ${match.currentRank}`);
    lines.push(`rankDelta: ${match.rankDelta}`);
  }

  if ("functionName" in match.entity) {
    lines.push(...formatFunctionScoreFields(match.entity));
  } else {
    lines.push(...formatHotspotScoreFields(match.entity));
  }

  return lines.join("\n");
}

/** Format compare explain blocks for stderr. Returns empty string when there are no matches. */
export function formatCompareExplain(matches: CompareExplainMatch[]): string {
  if (matches.length === 0) {
    return "";
  }

  return matches.map(formatCompareExplainMatch).join("\n\n");
}
