import { normalize, relative, resolve, sep } from "node:path";
import type { HotspotScore, ScanResult } from "../types/index.js";

const SCORE_DECIMALS = 4;

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

/** Parsed `--explain` target (file path only). */
export type ExplainTarget = { kind: "file"; filePath: string };

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

/** Parse `--explain <target>` as a file path; reject `path:function` grammar. */
export function parseExplainTarget(raw: string): ExplainTarget {
  const lastColon = raw.lastIndexOf(":");
  if (lastColon !== -1) {
    const suffix = raw.slice(lastColon + 1);
    if (isFunctionNameSuffix(suffix)) {
      throw new CliUsageError(
        "--explain does not support path:function; use a file path only",
      );
    }
  }

  return { kind: "file", filePath: raw };
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
    `ncloc: ${hotspot.ncloc}`,
    `normalized size (c): ${formatScore(hotspot.complexityNormalized)}`,
    `churn: commitCount=${hotspot.commitCount}, linesChanged=${hotspot.linesChanged}, authorCount=${hotspot.authorCount}`,
    `normalized churn (h): ${formatScore(hotspot.churnNormalized)}`,
    `hotspotScore: ${formatScore(hotspot.hotspotScore)}`,
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

function formatNotFound(target: ExplainTarget): string {
  const pathKey = normalizeMatchKey(target.filePath);
  return `explain: no hotspot ranking for ${pathKey}`;
}

/** Human-readable score breakdown for a matched ranking row (stderr-only). */
export function formatExplainBlock(
  result: ScanResult,
  target: ExplainTarget,
): string {
  const match = findHotspotRank(result.hotspots, target.filePath);
  if (!match) {
    return formatNotFound(target);
  }
  return formatFileHotspotBlock(match.entry, match.rank).join("\n");
}
