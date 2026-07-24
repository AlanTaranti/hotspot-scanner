import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize, relative, resolve, sep } from "node:path";

const CONFIG_NAMES = ["tsconfig.json", "jsconfig.json"] as const;

export interface PathAliasResolver {
  repoPath: string;
  /** Repo-relative directory containing the winning config file. */
  configDirRepoRelative: string;
  /** Repo-relative baseUrl when set; otherwise null. */
  baseUrlRepoRelative: string | null;
  /** Path pattern → target mappings (single `*` patterns only). */
  paths: ReadonlyArray<{ pattern: string; targets: readonly string[] }>;
}

function normalizeRepoPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function stripJsonc(text: string): string {
  const withoutBlock = text.replace(/\/\*[\s\S]*?\*\//g, "");
  return withoutBlock.replace(/\/\/.*$/gm, "");
}

interface TsconfigJson {
  extends?: string;
  compilerOptions?: {
    baseUrl?: string;
    paths?: Record<string, string[]>;
  };
}

function readConfigFile(configPath: string): TsconfigJson | null {
  try {
    const raw = readFileSync(configPath, "utf8");
    return JSON.parse(stripJsonc(raw)) as TsconfigJson;
  } catch {
    return null;
  }
}

function mergeCompilerOptions(
  parent: TsconfigJson["compilerOptions"],
  child: TsconfigJson["compilerOptions"],
): TsconfigJson["compilerOptions"] {
  if (!parent) {
    return child;
  }
  if (!child) {
    return parent;
  }

  return {
    ...parent,
    ...child,
    baseUrl: child.baseUrl ?? parent.baseUrl,
    paths: child.paths ?? parent.paths,
  };
}

function loadCompilerOptions(
  configPath: string,
  visited: Set<string>,
): TsconfigJson["compilerOptions"] | null {
  const absoluteConfigPath = resolve(configPath);
  if (visited.has(absoluteConfigPath)) {
    return null;
  }
  visited.add(absoluteConfigPath);

  const parsed = readConfigFile(absoluteConfigPath);
  if (!parsed) {
    return null;
  }

  let merged = parsed.compilerOptions ?? {};

  if (parsed.extends) {
    const configDir = dirname(absoluteConfigPath);
    const parentPath = resolve(configDir, parsed.extends);
    const parentOptions = loadCompilerOptions(parentPath, visited);
    if (parentOptions) {
      merged = mergeCompilerOptions(parentOptions, merged) ?? merged;
    }
  }

  return merged;
}

function findNearestConfigPath(
  repoPath: string,
  importerRepoRelative: string,
): string | null {
  const repoRoot = resolve(repoPath);
  let currentDir = resolve(repoRoot, dirname(importerRepoRelative));

  while (
    currentDir === repoRoot ||
    currentDir.startsWith(`${repoRoot}${sep}`)
  ) {
    for (const configName of CONFIG_NAMES) {
      const candidate = join(currentDir, configName);
      if (existsSync(candidate)) {
        return candidate;
      }
    }

    if (currentDir === repoRoot) {
      break;
    }

    currentDir = dirname(currentDir);
  }

  return null;
}

function buildResolver(
  configPath: string,
  repoPath: string,
): PathAliasResolver | null {
  const compilerOptions = loadCompilerOptions(configPath, new Set());
  if (!compilerOptions) {
    return null;
  }

  const configDirAbs = dirname(resolve(configPath));
  const repoRootAbs = resolve(repoPath);
  const configDirRepoRelative = normalizeRepoPath(
    relative(repoRootAbs, configDirAbs),
  );

  let baseUrlRepoRelative: string | null = null;
  if (compilerOptions.baseUrl) {
    const baseUrlAbs = resolve(configDirAbs, compilerOptions.baseUrl);
    baseUrlRepoRelative = normalizeRepoPath(relative(repoRootAbs, baseUrlAbs));
  }

  const paths = Object.entries(compilerOptions.paths ?? {}).map(
    ([pattern, targets]) => ({
      pattern,
      targets,
    }),
  );

  return {
    repoPath,
    configDirRepoRelative,
    baseUrlRepoRelative,
    paths,
  };
}

function matchPathPattern(pattern: string, specifier: string): string | null {
  const starIndex = pattern.indexOf("*");
  if (starIndex === -1) {
    return pattern === specifier ? "" : null;
  }
  if (pattern.indexOf("*", starIndex + 1) !== -1) {
    return null;
  }

  const prefix = pattern.slice(0, starIndex);
  const suffix = pattern.slice(starIndex + 1);

  if (!specifier.startsWith(prefix)) {
    return null;
  }
  if (suffix && !specifier.endsWith(suffix)) {
    return null;
  }

  return specifier.slice(
    prefix.length,
    suffix ? specifier.length - suffix.length : undefined,
  );
}

function substituteTarget(target: string, captured: string): string {
  if (!target.includes("*")) {
    return target;
  }
  return target.replace("*", captured);
}

function mappingToRepoRelative(
  target: string,
  captured: string,
  resolver: PathAliasResolver,
): string {
  const substituted = substituteTarget(target, captured);
  const repoRootAbs = resolve(resolver.repoPath);
  const configDirAbs = resolve(repoRootAbs, resolver.configDirRepoRelative);
  const baseAbs = resolver.baseUrlRepoRelative
    ? resolve(repoRootAbs, resolver.baseUrlRepoRelative)
    : configDirAbs;
  const absolute = normalize(resolve(baseAbs, substituted));
  return normalizeRepoPath(relative(repoRootAbs, absolute));
}

function baseUrlCandidate(
  specifier: string,
  resolver: PathAliasResolver,
): string | null {
  if (!resolver.baseUrlRepoRelative || specifier.startsWith("@")) {
    return null;
  }

  const repoRootAbs = resolve(resolver.repoPath);
  const baseAbs = resolve(repoRootAbs, resolver.baseUrlRepoRelative);
  const absolute = normalize(resolve(baseAbs, specifier));
  return normalizeRepoPath(relative(repoRootAbs, absolute));
}

export function resolveAliasSpecifier(
  resolver: PathAliasResolver | null,
  _importerRepoRelative: string,
  specifier: string,
): string[] {
  if (!resolver || specifier.startsWith(".")) {
    return [];
  }

  const candidates: string[] = [];
  const seen = new Set<string>();
  let pathMatched = false;

  const addCandidate = (candidate: string) => {
    if (!seen.has(candidate)) {
      seen.add(candidate);
      candidates.push(candidate);
    }
  };

  for (const mapping of resolver.paths) {
    const captured = matchPathPattern(mapping.pattern, specifier);
    if (captured === null) {
      continue;
    }

    pathMatched = true;
    for (const target of mapping.targets) {
      addCandidate(mappingToRepoRelative(target, captured, resolver));
    }
  }

  if (!pathMatched) {
    const baseCandidate = baseUrlCandidate(specifier, resolver);
    if (baseCandidate) {
      addCandidate(baseCandidate);
    }
  }

  return candidates;
}

export class TsconfigPathMap {
  private readonly resolverCache = new Map<string, PathAliasResolver | null>();

  constructor(private readonly repoPath: string) {}

  loadPathMapForImporter(
    importerRepoRelative: string,
  ): PathAliasResolver | null {
    const configPath = findNearestConfigPath(this.repoPath, importerRepoRelative);
    if (!configPath) {
      return null;
    }

    if (this.resolverCache.has(configPath)) {
      return this.resolverCache.get(configPath) ?? null;
    }

    const resolver = buildResolver(configPath, this.repoPath);
    this.resolverCache.set(configPath, resolver);
    return resolver;
  }

  resolveAliasSpecifier(
    resolver: PathAliasResolver | null,
    importerRepoRelative: string,
    specifier: string,
  ): string[] {
    return resolveAliasSpecifier(resolver, importerRepoRelative, specifier);
  }
}

export function loadPathMapForImporter(
  pathMap: TsconfigPathMap,
  importerRepoRelative: string,
): PathAliasResolver | null {
  return pathMap.loadPathMapForImporter(importerRepoRelative);
}
