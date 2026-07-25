import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize, relative, resolve, sep } from "node:path";

const PACKAGE_JSON = "package.json";

const CONDITION_KEYS = new Set([
  "default",
  "import",
  "require",
  "types",
  "node",
]);

export interface PackageScope {
  packageDirRepoRelative: string;
  name: string | null;
  exports: unknown;
  imports: unknown;
  main: string | null;
}

interface PackageJson {
  name?: string;
  exports?: unknown;
  imports?: unknown;
  main?: string;
}

function normalizeRepoPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function readPackageJson(packageJsonPath: string): PackageJson | null {
  try {
    const raw = readFileSync(packageJsonPath, "utf8");
    return JSON.parse(raw) as PackageJson;
  } catch {
    return null;
  }
}

function findNearestPackageJsonPath(
  repoPath: string,
  importerRepoRelative: string,
): string | null {
  const repoRoot = resolve(repoPath);
  let currentDir = resolve(repoRoot, dirname(importerRepoRelative));

  while (
    currentDir === repoRoot ||
    currentDir.startsWith(`${repoRoot}${sep}`)
  ) {
    const candidate = join(currentDir, PACKAGE_JSON);
    if (existsSync(candidate)) {
      return candidate;
    }

    if (currentDir === repoRoot) {
      break;
    }

    currentDir = dirname(currentDir);
  }

  return null;
}

function targetToRepoRelative(
  target: string,
  packageDirRepoRelative: string,
  repoPath: string,
): string {
  const repoRootAbs = resolve(repoPath);
  const packageDirAbs = resolve(repoRootAbs, packageDirRepoRelative);
  const absolute = normalize(resolve(packageDirAbs, target));
  return normalizeRepoPath(relative(repoRootAbs, absolute));
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

function isSubpathExportMap(value: Record<string, unknown>): boolean {
  return Object.keys(value).some(
    (key) => key === "." || key.startsWith("./"),
  );
}

function isConditionMap(value: Record<string, unknown>): boolean {
  return Object.keys(value).some((key) => CONDITION_KEYS.has(key));
}

/** Expand string / array / conditional export target values to path strings. */
export function expandExportTargetValue(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    const targets: string[] = [];
    for (const element of value) {
      targets.push(...expandExportTargetValue(element));
    }
    return targets;
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;

    if (isSubpathExportMap(record)) {
      return [];
    }

    if (!isConditionMap(record)) {
      return [];
    }

    const targets: string[] = [];
    for (const [key, nested] of Object.entries(record)) {
      if (!CONDITION_KEYS.has(key)) {
        continue;
      }
      targets.push(...expandExportTargetValue(nested));
    }
    return targets;
  }

  return [];
}

function applyCaptureToTarget(target: unknown, captured: string): unknown {
  if (typeof target === "string") {
    return substituteTarget(target, captured);
  }

  if (Array.isArray(target)) {
    return target.map((element) => applyCaptureToTarget(element, captured));
  }

  if (target && typeof target === "object") {
    const record = target as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      result[key] = applyCaptureToTarget(value, captured);
    }
    return result;
  }

  return target;
}

function matchSubpathKey(
  exportsMap: Record<string, unknown>,
  subpath: string,
): unknown | null {
  if (Object.hasOwn(exportsMap, subpath)) {
    return exportsMap[subpath] ?? null;
  }

  for (const [pattern, target] of Object.entries(exportsMap)) {
    if (pattern === "." || pattern.startsWith("./")) {
      const captured = matchPathPattern(pattern, subpath);
      if (captured !== null) {
        return applyCaptureToTarget(target, captured);
      }
    }
  }

  return null;
}

/** Resolve a package subpath (`.`, `./foo`) to repo-relative base path candidates. */
export function resolveExportSubpath(
  scope: PackageScope,
  subpath: string,
  repoPath: string,
): string[] {
  const { exports } = scope;

  if (exports === undefined || exports === null) {
    return [];
  }

  let matchedValue: unknown;

  if (typeof exports === "string") {
    if (subpath !== ".") {
      return [];
    }
    matchedValue = exports;
  } else if (typeof exports === "object" && !Array.isArray(exports)) {
    const exportsMap = exports as Record<string, unknown>;
    matchedValue = matchSubpathKey(exportsMap, subpath);
    if (matchedValue === null) {
      return [];
    }
  } else {
    return [];
  }

  const pathTargets = expandExportTargetValue(matchedValue);
  const candidates: string[] = [];
  const seen = new Set<string>();

  for (const target of pathTargets) {
    const repoRelative = targetToRepoRelative(
      target,
      scope.packageDirRepoRelative,
      repoPath,
    );
    if (!seen.has(repoRelative)) {
      seen.add(repoRelative);
      candidates.push(repoRelative);
    }
  }

  return candidates;
}

/** Main fallback when `exports` is absent — package entry (`.`) only. */
export function resolveMainEntry(
  scope: PackageScope,
  repoPath: string,
): string[] {
  if (scope.exports !== undefined && scope.exports !== null) {
    return [];
  }

  if (scope.main) {
    return [
      targetToRepoRelative(scope.main, scope.packageDirRepoRelative, repoPath),
    ];
  }

  return [scope.packageDirRepoRelative];
}

function matchImportsKey(
  importsMap: Record<string, unknown>,
  specifier: string,
): string[] {
  if (Object.hasOwn(importsMap, specifier)) {
    const target = importsMap[specifier];
    return typeof target === "string" ? [target] : expandExportTargetValue(target);
  }

  const targets: string[] = [];

  for (const [pattern, target] of Object.entries(importsMap)) {
    const captured = matchPathPattern(pattern, specifier);
    if (captured === null) {
      continue;
    }

    const resolvedTarget = applyCaptureToTarget(target, captured);
    if (typeof resolvedTarget === "string") {
      targets.push(resolvedTarget);
    } else {
      targets.push(...expandExportTargetValue(resolvedTarget));
    }
  }

  return targets;
}

function parsePackageSpecifier(specifier: string): {
  packageName: string;
  subpath: string;
} {
  if (specifier.startsWith("@")) {
    const scopeSlash = specifier.indexOf("/", 1);
    if (scopeSlash === -1) {
      return { packageName: specifier, subpath: "." };
    }

    const subpathSlash = specifier.indexOf("/", scopeSlash + 1);
    if (subpathSlash === -1) {
      return { packageName: specifier, subpath: "." };
    }

    return {
      packageName: specifier.slice(0, subpathSlash),
      subpath: `./${specifier.slice(subpathSlash + 1)}`,
    };
  }

  const slashIndex = specifier.indexOf("/");
  if (slashIndex === -1) {
    return { packageName: specifier, subpath: "." };
  }

  return {
    packageName: specifier.slice(0, slashIndex),
    subpath: `./${specifier.slice(slashIndex + 1)}`,
  };
}

function buildScope(
  packageJsonPath: string,
  repoPath: string,
): PackageScope | null {
  const parsed = readPackageJson(packageJsonPath);
  if (!parsed) {
    return null;
  }

  const repoRootAbs = resolve(repoPath);
  const packageDirAbs = dirname(resolve(packageJsonPath));
  const packageDirRepoRelative = normalizeRepoPath(
    relative(repoRootAbs, packageDirAbs),
  );

  return {
    packageDirRepoRelative,
    name: typeof parsed.name === "string" ? parsed.name : null,
    exports: parsed.exports,
    imports: parsed.imports,
    main: typeof parsed.main === "string" ? parsed.main : null,
  };
}

export class PackageExportsMap {
  private readonly scopeCache = new Map<string, PackageScope | null>();
  private readonly nameIndex = new Map<string, PackageScope>();
  private readonly packageDirIndex = new Map<string, PackageScope>();

  constructor(private readonly repoPath: string) {}

  loadScopeForImporter(importerRepoRelative: string): PackageScope | null {
    const packageJsonPath = findNearestPackageJsonPath(
      this.repoPath,
      importerRepoRelative,
    );
    if (!packageJsonPath) {
      return null;
    }

    if (this.scopeCache.has(packageJsonPath)) {
      return this.scopeCache.get(packageJsonPath) ?? null;
    }

    const scope = buildScope(packageJsonPath, this.repoPath);
    this.scopeCache.set(packageJsonPath, scope);
    return scope;
  }

  /** Index in-repo packages discovered from coupling peer paths. */
  indexPeers(peerPaths: ReadonlySet<string>): void {
    for (const peerPath of peerPaths) {
      const scope = this.loadScopeForImporter(peerPath);
      if (!scope) {
        continue;
      }

      this.packageDirIndex.set(scope.packageDirRepoRelative, scope);

      if (scope.name) {
        this.nameIndex.set(scope.name, scope);
      }
    }
  }

  resolveImportSpecifier(
    importerRepoRelative: string,
    specifier: string,
  ): string[] {
    if (!specifier.startsWith("#")) {
      return [];
    }

    const scope = this.loadScopeForImporter(importerRepoRelative);
    if (!scope?.imports || typeof scope.imports !== "object" || Array.isArray(scope.imports)) {
      return [];
    }

    const pathTargets = matchImportsKey(
      scope.imports as Record<string, unknown>,
      specifier,
    );
    const candidates: string[] = [];
    const seen = new Set<string>();

    for (const target of pathTargets) {
      const repoRelative = targetToRepoRelative(
        target,
        scope.packageDirRepoRelative,
        this.repoPath,
      );
      if (!seen.has(repoRelative)) {
        seen.add(repoRelative);
        candidates.push(repoRelative);
      }
    }

    return candidates;
  }

  /** Resolve bare/scoped package names via the peer name index. */
  resolvePackageSpecifier(
    _importerRepoRelative: string,
    specifier: string,
  ): string[] {
    if (
      specifier.startsWith(".") ||
      specifier.startsWith("#") ||
      specifier.length === 0
    ) {
      return [];
    }

    const { packageName, subpath } = parsePackageSpecifier(specifier);
    const scope = this.nameIndex.get(packageName);

    if (!scope) {
      return [];
    }

    const exportCandidates = resolveExportSubpath(
      scope,
      subpath,
      this.repoPath,
    );
    if (exportCandidates.length > 0) {
      return exportCandidates;
    }

    if (subpath === ".") {
      return resolveMainEntry(scope, this.repoPath);
    }

    return [];
  }
}
