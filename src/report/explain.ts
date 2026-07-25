import { normalize, relative, resolve, sep } from "node:path";
import type {
  FunctionHotspotScore,
  HotspotScore,
  ScanResult,
} from "../types/index.js";

const SCORE_DECIMALS = 4;

/** Parsed `--explain` target (grammar in feature context). */
export type ExplainTarget =
  | { kind: "file"; filePath: string }
  | { kind: "function"; filePath: string; functionName: string };

const FUNCTION_NAME_PATTERN =
  /^(?:[A-Za-z_$][\w$]*)(?:\.[A-Za-z_$][\w$]*)*$/;

function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function normalizeMatchKey(filePath: string): string {
  return toPosixPath(filePath).replace(/^\.\//, "");
}

function formatScore(value: number): string {
  return value.toFixed(SCORE_DECIMALS);
}

function isFunctionNameSuffix(suffix: string): boolean {
  return FUNCTION_NAME_PATTERN.test(suffix);
}

/** Parse `--explain <target>` grammar (last `:` + function-name pattern). */
export function parseExplainTarget(raw: string): ExplainTarget {
  const lastColon = raw.lastIndexOf(":");
  if (lastColon === -1) {
    return { kind: "file", filePath: raw };
  }

  const suffix = raw.slice(lastColon + 1);
  if (!isFunctionNameSuffix(suffix)) {
    return { kind: "file", filePath: raw };
  }

  return {
    kind: "function",
    filePath: raw.slice(0, lastColon),
    functionName: suffix,
  };
}

/** Repo-relative posix path for ranking lookup (strip `./`, repo-root prefix). */
export function normalizeExplainPath(
  filePath: string,
  repoPath: string,
): string {
  const posixInput = normalizeMatchKey(filePath);
  const repoRoot = resolve(repoPath);
  const resolved = normalize(resolve(repoRoot, posixInput));

  if (
    resolved === repoRoot ||
    resolved.startsWith(`${repoRoot}${sep}`)
  ) {
    return normalizeMatchKey(relative(repoRoot, resolved));
  }

  return posixInput;
}

function pathsMatch(storedPath: string, targetPath: string): boolean {
  return normalizeMatchKey(storedPath) === normalizeMatchKey(targetPath);
}

function formatFileHotspotBlock(
  hotspot: HotspotScore,
  rank: number,
): string[] {
  return [
    `=== Explain: ${hotspot.filePath} (rank ${rank}) ===`,
    `filePath: ${hotspot.filePath}`,
    `complexity: cyclomaticComplexity=${hotspot.cyclomaticComplexity}, functionCount=${hotspot.functionCount}`,
    `normalized complexity (c): ${formatScore(hotspot.complexityNormalized)}`,
    `churn: commitCount=${hotspot.commitCount}, linesChanged=${hotspot.linesChanged}, authorCount=${hotspot.authorCount}`,
    `normalized churn (h): ${formatScore(hotspot.churnNormalized)}`,
    `hotspotScore: ${formatScore(hotspot.hotspotScore)}`,
    "hotspotScore = 2·c·h / (c+h)",
  ];
}

function formatFunctionHotspotBlock(
  entry: FunctionHotspotScore,
  rank: number,
): string[] {
  return [
    `=== Explain: ${entry.filePath} — ${entry.functionName} (rank ${rank}, line ${entry.line}) ===`,
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

function findHotspotRank(
  hotspots: HotspotScore[],
  filePath: string,
): { entry: HotspotScore; rank: number } | undefined {
  const index = hotspots.findIndex((entry) =>
    pathsMatch(entry.filePath, filePath),
  );
  if (index === -1) {
    return undefined;
  }
  return { entry: hotspots[index]!, rank: index + 1 };
}

function findFunctionMatches(
  functions: FunctionHotspotScore[],
  filePath: string,
  functionName?: string,
): Array<{ entry: FunctionHotspotScore; rank: number }> {
  const matches: Array<{ entry: FunctionHotspotScore; rank: number }> = [];

  for (const [index, entry] of functions.entries()) {
    if (!pathsMatch(entry.filePath, filePath)) {
      continue;
    }
    if (functionName !== undefined && entry.functionName !== functionName) {
      continue;
    }
    matches.push({ entry, rank: index + 1 });
  }

  return matches;
}

function formatNotFound(
  granularity: ScanResult["meta"]["granularity"],
  target: ExplainTarget,
): string {
  const pathKey = normalizeMatchKey(target.filePath);
  if (granularity === "file") {
    return `explain: no hotspot ranking for ${pathKey}`;
  }
  if (target.kind === "function") {
    return `explain: no function ranking for ${pathKey}:${target.functionName}`;
  }
  return `explain: no function ranking for ${pathKey}`;
}

/** Human-readable score breakdown for a matched ranking row (stderr-only). */
export function formatExplainBlock(
  result: ScanResult,
  target: ExplainTarget,
): string {
  const granularity = result.meta.granularity;

  if (granularity === "file") {
    const match = findHotspotRank(result.hotspots, target.filePath);
    if (!match) {
      return formatNotFound(granularity, target);
    }
    return formatFileHotspotBlock(match.entry, match.rank).join("\n");
  }

  const functionName =
    target.kind === "function" ? target.functionName : undefined;
  const matches = findFunctionMatches(
    result.functions,
    target.filePath,
    functionName,
  );

  if (matches.length === 0) {
    return formatNotFound(granularity, target);
  }

  return matches
    .map(({ entry, rank }) => formatFunctionHotspotBlock(entry, rank).join("\n"))
    .join("\n\n");
}
