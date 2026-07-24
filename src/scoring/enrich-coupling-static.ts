import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import type { CouplingPair } from "../types/index.js";

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"] as const;

const RELATIVE_SPECIFIER = String.raw`(\.\.?\/[^'"]+)`;

const STATIC_REFERENCE_PATTERNS = [
  new RegExp(String.raw`\bimport\s+['"]${RELATIVE_SPECIFIER}['"]`, "g"),
  new RegExp(String.raw`\bfrom\s+['"]${RELATIVE_SPECIFIER}['"]`, "g"),
  new RegExp(String.raw`\bimport\s*\(\s*['"]${RELATIVE_SPECIFIER}['"]\s*\)`, "g"),
  new RegExp(String.raw`\brequire\s*\(\s*['"]${RELATIVE_SPECIFIER}['"]\s*\)`, "g"),
];

function normalizeRepoPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function readSourceSafe(repoPath: string, relativePath: string): string | null {
  try {
    return readFileSync(join(repoPath, relativePath), "utf8");
  } catch {
    return null;
  }
}

export function extractRelativeSpecifiers(source: string): string[] {
  const specifiers = new Set<string>();

  for (const pattern of STATIC_REFERENCE_PATTERNS) {
    pattern.lastIndex = 0;

    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier) {
        specifiers.add(specifier);
      }
    }
  }

  return [...specifiers];
}

function buildResolutionCandidates(basePath: string): string[] {
  const normalizedBase = normalizeRepoPath(normalize(basePath));
  const extension = extname(normalizedBase);
  const candidates: string[] = [];

  if (extension) {
    candidates.push(normalizedBase);

    if (extension === ".js") {
      const withoutExtension = normalizedBase.slice(0, -".js".length);
      candidates.push(`${withoutExtension}.ts`, `${withoutExtension}.tsx`);
    }

    return candidates;
  }

  for (const suffix of SOURCE_EXTENSIONS) {
    candidates.push(`${normalizedBase}${suffix}`);
  }

  for (const suffix of SOURCE_EXTENSIONS) {
    candidates.push(`${normalizedBase}/index${suffix}`);
  }

  return candidates;
}

function resolveSpecifierToRepoPath(
  importerPath: string,
  specifier: string,
  repoPath: string,
): string | null {
  const importerDir = dirname(normalizeRepoPath(importerPath));
  const joined = normalizeRepoPath(normalize(join(importerDir, specifier)));

  for (const candidate of buildResolutionCandidates(joined)) {
    if (existsSync(join(repoPath, candidate))) {
      return candidate;
    }
  }

  return null;
}

function referencesPeer(
  filePath: string,
  peerPath: string,
  repoPath: string,
): boolean {
  const source = readSourceSafe(repoPath, filePath);
  if (source === null) {
    return false;
  }

  const normalizedPeer = normalizeRepoPath(peerPath);

  for (const specifier of extractRelativeSpecifiers(source)) {
    const resolved = resolveSpecifierToRepoPath(filePath, specifier, repoPath);
    if (resolved === normalizedPeer) {
      return true;
    }
  }

  return false;
}

function hasStaticDependencyBetween(
  fileA: string,
  fileB: string,
  repoPath: string,
): boolean {
  return (
    referencesPeer(fileA, fileB, repoPath) ||
    referencesPeer(fileB, fileA, repoPath)
  );
}

export function enrichCouplingStaticDeps(
  pairs: CouplingPair[],
  repoPath: string,
): CouplingPair[] {
  if (pairs.length === 0) {
    return [];
  }

  return pairs.map((pair) => ({
    ...pair,
    hasStaticDependency: hasStaticDependencyBetween(
      pair.fileA,
      pair.fileB,
      repoPath,
    ),
  }));
}
