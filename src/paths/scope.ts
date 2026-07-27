import picomatch from "picomatch";

export const DEFAULT_ARTIFACT_EXCLUDE_PATTERNS = [
  "node_modules/**",
  ".git/**",
  "dist/**",
  "coverage/**",
  "build/**",
  "**/.next/**",
  "**/out/**",
  "**/vendor/**",
  "**/storybook-static/**",
  "**/__snapshots__/**",
  "**/.turbo/**",
  "**/.vercel/**",
  "**/.cache/**",
  "**/.nuxt/**",
  "**/.output/**",
  "**/.parcel-cache/**",
  "**/tmp/**",
] as const;

export const DEFAULT_TEST_EXCLUDE_PATTERNS = [
  "**/*.test.ts",
  "**/*.test.tsx",
  "**/*.test.js",
  "**/*.test.jsx",
  "**/*.spec.ts",
  "**/*.spec.tsx",
  "**/*.spec.js",
  "**/*.spec.jsx",
  "**/__tests__/**",
  "**/*.test.mjs",
  "**/*.test.cjs",
  "**/*.spec.mjs",
  "**/*.spec.cjs",
  "**/*.test.mts",
  "**/*.test.cts",
  "**/*.spec.mts",
  "**/*.spec.cts",
] as const;

export const DEFAULT_EXCLUDE_PATTERNS = [
  ...DEFAULT_ARTIFACT_EXCLUDE_PATTERNS,
  ...DEFAULT_TEST_EXCLUDE_PATTERNS,
] as const;

export interface PathScope {
  includes: string[] | undefined;
  excludes: string[];
  /** Compiled matchers — internal use by isPathInScope / shouldPruneDirectory */
  _includeMatchers: picomatch.Matcher[] | undefined;
  _excludeMatchers: picomatch.Matcher[];
}

export interface PathScopeOptions {
  include?: string[];
  exclude?: string[];
  /** When true, omit DEFAULT_TEST_EXCLUDE_PATTERNS. Default false. */
  includeTests?: boolean;
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

export function createPathScope(options?: PathScopeOptions): PathScope {
  const userExcludes = options?.exclude ?? [];
  const builtIn = options?.includeTests
    ? DEFAULT_ARTIFACT_EXCLUDE_PATTERNS
    : DEFAULT_EXCLUDE_PATTERNS;
  const allExcludes = [...builtIn, ...userExcludes];
  const includes = options?.include;

  return {
    includes: includes && includes.length > 0 ? includes : undefined,
    excludes: allExcludes,
    _includeMatchers:
      includes && includes.length > 0
        ? includes.map((pattern) => picomatch(pattern))
        : undefined,
    _excludeMatchers: allExcludes.map((pattern) => picomatch(pattern)),
  };
}

export function isPathInScope(filePath: string, scope: PathScope): boolean {
  const normalized = normalizePath(filePath);

  for (const matcher of scope._excludeMatchers) {
    if (matcher(normalized)) {
      return false;
    }
  }

  if (scope._includeMatchers && scope._includeMatchers.length > 0) {
    return scope._includeMatchers.some((matcher) => matcher(normalized));
  }

  return true;
}

/** True when a directory entry should not be descended into during walk. */
export function shouldPruneDirectory(
  dirRelativePath: string,
  scope: PathScope,
): boolean {
  const normalized = normalizePath(dirRelativePath);

  for (const matcher of scope._excludeMatchers) {
    if (matcher(normalized) || matcher(`${normalized}/**`)) {
      return true;
    }
  }

  return false;
}
