import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import type {
  CouplingPair,
  StaticDependencyDirection,
} from "../types/index.js";
import { TsconfigPathMap } from "./tsconfig-path-map.js";

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"] as const;

const RELATIVE_SPECIFIER = String.raw`(\.\.?\/[^'"]+)`;

const STATIC_REFERENCE_PATTERNS = [
  new RegExp(String.raw`\bimport\s+['"]${RELATIVE_SPECIFIER}['"]`, "g"),
  new RegExp(String.raw`\bfrom\s+['"]${RELATIVE_SPECIFIER}['"]`, "g"),
  new RegExp(
    String.raw`\bimport\s*\(\s*['"]${RELATIVE_SPECIFIER}['"]\s*\)`,
    "g",
  ),
  new RegExp(
    String.raw`\brequire\s*\(\s*['"]${RELATIVE_SPECIFIER}['"]\s*\)`,
    "g",
  ),
];

const SPECIFIER_CAPTURE = String.raw`([^'"]+)`;

interface StaticReference {
  specifier: string;
  isTypeOnly: boolean;
  isReExport: boolean;
}

interface StaticEdgeKinds {
  hasRuntimeStaticDependency: boolean;
  hasTypeOnlyStaticDependency: boolean;
  hasReExportStaticDependency: boolean;
}

const STRUCTURED_REFERENCE_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  isTypeOnly: boolean;
  isReExport: boolean;
}> = [
  {
    pattern: new RegExp(
      String.raw`\bexport\s+type\s+[\s\S]*?\bfrom\s+['"]${SPECIFIER_CAPTURE}['"]`,
      "g",
    ),
    isTypeOnly: true,
    isReExport: true,
  },
  {
    pattern: new RegExp(
      String.raw`\bexport\s+\*\s+from\s+['"]${SPECIFIER_CAPTURE}['"]`,
      "g",
    ),
    isTypeOnly: false,
    isReExport: true,
  },
  {
    pattern: new RegExp(
      String.raw`\bexport\s+\{[^}]*\}\s+from\s+['"]${SPECIFIER_CAPTURE}['"]`,
      "g",
    ),
    isTypeOnly: false,
    isReExport: true,
  },
  {
    pattern: new RegExp(
      String.raw`\bimport\s+type\s+[\s\S]*?\bfrom\s+['"]${SPECIFIER_CAPTURE}['"]`,
      "g",
    ),
    isTypeOnly: true,
    isReExport: false,
  },
  {
    pattern: new RegExp(
      String.raw`\bimport\s*\(\s*['"]${SPECIFIER_CAPTURE}['"]\s*\)`,
      "g",
    ),
    isTypeOnly: false,
    isReExport: false,
  },
  {
    pattern: new RegExp(
      String.raw`\brequire\s*\(\s*['"]${SPECIFIER_CAPTURE}['"]\s*\)`,
      "g",
    ),
    isTypeOnly: false,
    isReExport: false,
  },
  {
    pattern: new RegExp(
      String.raw`\bimport\s+['"]${SPECIFIER_CAPTURE}['"]`,
      "g",
    ),
    isTypeOnly: false,
    isReExport: false,
  },
  {
    pattern: new RegExp(
      String.raw`\bimport\s+(?!type\b)[\s\S]*?\bfrom\s+['"]${SPECIFIER_CAPTURE}['"]`,
      "g",
    ),
    isTypeOnly: false,
    isReExport: false,
  },
];

function normalizeRepoPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function isSourceFile(filePath: string): boolean {
  const extension = extname(filePath);
  return SOURCE_EXTENSIONS.includes(
    extension as (typeof SOURCE_EXTENSIONS)[number],
  );
}

function readSourceSafe(repoPath: string, relativePath: string): string | null {
  if (!isSourceFile(relativePath)) {
    return null;
  }

  try {
    return readFileSync(join(repoPath, relativePath), "utf8");
  } catch {
    return null;
  }
}

export function extractStaticReferences(source: string): StaticReference[] {
  const references: StaticReference[] = [];

  for (const { pattern, isTypeOnly, isReExport } of STRUCTURED_REFERENCE_PATTERNS) {
    pattern.lastIndex = 0;

    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier) {
        references.push({ specifier, isTypeOnly, isReExport });
      }
    }
  }

  return references;
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

function resolutionBases(
  importerPath: string,
  specifier: string,
  pathMap: TsconfigPathMap,
): string[] {
  if (specifier.startsWith(".")) {
    const importerDir = dirname(normalizeRepoPath(importerPath));
    return [normalizeRepoPath(normalize(join(importerDir, specifier)))];
  }

  const resolver = pathMap.loadPathMapForImporter(importerPath);
  return pathMap.resolveAliasSpecifier(resolver, importerPath, specifier);
}

function resolvesToPeer(
  importerPath: string,
  specifier: string,
  peerPath: string,
  repoPath: string,
  pathMap: TsconfigPathMap,
): boolean {
  const normalizedPeer = normalizeRepoPath(peerPath);

  for (const basePath of resolutionBases(importerPath, specifier, pathMap)) {
    for (const candidate of buildResolutionCandidates(basePath)) {
      if (
        candidate === normalizedPeer &&
        existsSync(join(repoPath, candidate))
      ) {
        return true;
      }
    }
  }

  return false;
}

function collectEdgesToPeer(
  filePath: string,
  peerPath: string,
  repoPath: string,
  pathMap: TsconfigPathMap,
): StaticReference[] {
  const source = readSourceSafe(repoPath, filePath);
  if (source === null) {
    return [];
  }

  const edges: StaticReference[] = [];

  for (const reference of extractStaticReferences(source)) {
    if (resolvesToPeer(filePath, reference.specifier, peerPath, repoPath, pathMap)) {
      edges.push(reference);
    }
  }

  return edges;
}

function aggregateEdgeKinds(
  edges: StaticReference[],
): StaticEdgeKinds & { hasStaticDependency: boolean } {
  const hasRuntimeStaticDependency = edges.some((edge) => !edge.isTypeOnly);
  const hasTypeOnlyStaticDependency = edges.some((edge) => edge.isTypeOnly);
  const hasReExportStaticDependency = edges.some((edge) => edge.isReExport);
  const hasStaticDependency =
    hasRuntimeStaticDependency || hasTypeOnlyStaticDependency;

  return {
    hasStaticDependency,
    hasRuntimeStaticDependency,
    hasTypeOnlyStaticDependency,
    hasReExportStaticDependency,
  };
}

function computeDirection(
  hasAToB: boolean,
  hasBToA: boolean,
): StaticDependencyDirection {
  if (hasAToB && hasBToA) {
    return "both";
  }
  if (hasAToB) {
    return "a-to-b";
  }
  if (hasBToA) {
    return "b-to-a";
  }
  return "none";
}

function enrichPair(
  pair: CouplingPair,
  repoPath: string,
  pathMap: TsconfigPathMap,
): CouplingPair {
  const edgesAToB = collectEdgesToPeer(
    pair.fileA,
    pair.fileB,
    repoPath,
    pathMap,
  );
  const edgesBToA = collectEdgesToPeer(
    pair.fileB,
    pair.fileA,
    repoPath,
    pathMap,
  );
  const allEdges = [...edgesAToB, ...edgesBToA];
  const kinds = aggregateEdgeKinds(allEdges);

  return {
    ...pair,
    ...kinds,
    staticDependencyDirection: computeDirection(
      edgesAToB.length > 0,
      edgesBToA.length > 0,
    ),
  };
}

export function enrichCouplingStaticDeps(
  pairs: CouplingPair[],
  repoPath: string,
): CouplingPair[] {
  if (pairs.length === 0) {
    return [];
  }

  const pathMap = new TsconfigPathMap(repoPath);

  return pairs.map((pair) => enrichPair(pair, repoPath, pathMap));
}
