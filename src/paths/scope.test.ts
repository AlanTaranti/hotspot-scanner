import { describe, expect, it } from "vitest";
import {
  createPathScope,
  DEFAULT_ARTIFACT_EXCLUDE_PATTERNS,
  DEFAULT_EXCLUDE_PATTERNS,
  DEFAULT_TEST_EXCLUDE_PATTERNS,
  isPathInScope,
  shouldPruneDirectory,
} from "./scope.js";

describe("DEFAULT_ARTIFACT_EXCLUDE_PATTERNS", () => {
  it("includes M7 and M30 monorepo patterns", () => {
    expect(DEFAULT_ARTIFACT_EXCLUDE_PATTERNS).toEqual([
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
    ]);
  });
});

describe("DEFAULT_TEST_EXCLUDE_PATTERNS", () => {
  it("includes locked test file globs and __tests__ directories", () => {
    expect(DEFAULT_TEST_EXCLUDE_PATTERNS).toEqual([
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.test.js",
      "**/*.test.jsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "**/*.spec.js",
      "**/*.spec.jsx",
      "**/__tests__/**",
    ]);
  });
});

describe("DEFAULT_EXCLUDE_PATTERNS", () => {
  it("concatenates artifact and test defaults", () => {
    expect(DEFAULT_EXCLUDE_PATTERNS).toEqual([
      ...DEFAULT_ARTIFACT_EXCLUDE_PATTERNS,
      ...DEFAULT_TEST_EXCLUDE_PATTERNS,
    ]);
  });
});

describe("createPathScope", () => {
  it("merges user exclude with defaults", () => {
    const scope = createPathScope({ exclude: ["generated/**"] });
    expect(scope.excludes).toContain("node_modules/**");
    expect(scope.excludes).toContain("generated/**");
  });

  it("treats empty include as undefined", () => {
    const scope = createPathScope({ include: [] });
    expect(scope.includes).toBeUndefined();
    expect(scope._includeMatchers).toBeUndefined();
  });

  it("omits test defaults when includeTests is true", () => {
    const scope = createPathScope({ includeTests: true });
    expect(scope.excludes).toEqual([...DEFAULT_ARTIFACT_EXCLUDE_PATTERNS]);
    for (const pattern of DEFAULT_TEST_EXCLUDE_PATTERNS) {
      expect(scope.excludes).not.toContain(pattern);
    }
  });

  it("keeps user exclude additive when includeTests is true", () => {
    const scope = createPathScope({
      includeTests: true,
      exclude: ["generated/**"],
    });
    expect(scope.excludes).toEqual([
      ...DEFAULT_ARTIFACT_EXCLUDE_PATTERNS,
      "generated/**",
    ]);
  });
});

describe("isPathInScope", () => {
  const defaultScope = createPathScope();

  it("excludes default paths", () => {
    expect(isPathInScope("node_modules/pkg/index.ts", defaultScope)).toBe(
      false,
    );
    expect(isPathInScope(".git/config", defaultScope)).toBe(false);
    expect(isPathInScope("dist/bundle.js", defaultScope)).toBe(false);
    expect(isPathInScope("coverage/lcov.info", defaultScope)).toBe(false);
    expect(isPathInScope("build/output.js", defaultScope)).toBe(false);
  });

  it("excludes nested monorepo build and snapshot paths", () => {
    expect(
      isPathInScope("apps/web/.next/static/chunk.js", defaultScope),
    ).toBe(false);
    expect(isPathInScope("apps/site/out/page.html", defaultScope)).toBe(false);
    expect(isPathInScope("services/api/vendor/lib.go", defaultScope)).toBe(
      false,
    );
    expect(
      isPathInScope("packages/ui/storybook-static/index.html", defaultScope),
    ).toBe(false);
    expect(
      isPathInScope(
        "packages/ui/src/__snapshots__/Button.test.ts.snap",
        defaultScope,
      ),
    ).toBe(false);
  });

  it("excludes nested M48 toolchain artifact paths", () => {
    expect(
      isPathInScope("apps/web/.turbo/cache/abc123", defaultScope),
    ).toBe(false);
    expect(isPathInScope("apps/web/.vercel/output.json", defaultScope)).toBe(
      false,
    );
    expect(
      isPathInScope("packages/lib/.cache/eslint/output.json", defaultScope),
    ).toBe(false);
    expect(
      isPathInScope("packages/app/.nuxt/dist/server.mjs", defaultScope),
    ).toBe(false);
    expect(
      isPathInScope("apps/site/.output/public/index.html", defaultScope),
    ).toBe(false);
    expect(
      isPathInScope(
        "packages/ui/.parcel-cache/data.abc123",
        defaultScope,
      ),
    ).toBe(false);
    expect(isPathInScope("tools/tmp/scratch.ts", defaultScope)).toBe(false);
  });

  it("excludes test files and __tests__ paths by default", () => {
    expect(isPathInScope("src/foo.test.ts", defaultScope)).toBe(false);
    expect(isPathInScope("a.spec.tsx", defaultScope)).toBe(false);
    expect(isPathInScope("src/__tests__/helpers.ts", defaultScope)).toBe(
      false,
    );
  });

  it("includes eligible paths outside excludes", () => {
    expect(isPathInScope("src/app.ts", defaultScope)).toBe(true);
    expect(isPathInScope("lib/utils.ts", defaultScope)).toBe(true);
    expect(isPathInScope("src/testing/helpers.ts", defaultScope)).toBe(true);
  });

  it("includes test paths when includeTests is true", () => {
    const scope = createPathScope({ includeTests: true });
    expect(isPathInScope("src/foo.test.ts", scope)).toBe(true);
    expect(isPathInScope("a.spec.tsx", scope)).toBe(true);
    expect(isPathInScope("src/__tests__/helpers.ts", scope)).toBe(true);
  });

  it("still applies user exclude when includeTests is true", () => {
    const scope = createPathScope({
      includeTests: true,
      exclude: ["src/foo.test.ts"],
    });
    expect(isPathInScope("src/foo.test.ts", scope)).toBe(false);
    expect(isPathInScope("a.spec.tsx", scope)).toBe(true);
  });

  it("narrows with include patterns", () => {
    const scope = createPathScope({ include: ["src/**"] });
    expect(isPathInScope("src/app.ts", scope)).toBe(true);
    expect(isPathInScope("lib/utils.ts", scope)).toBe(false);
  });

  it("exclude wins over include", () => {
    const scope = createPathScope({
      include: ["**"],
      exclude: ["src/generated/**"],
    });
    expect(isPathInScope("src/app.ts", scope)).toBe(true);
    expect(isPathInScope("src/generated/foo.ts", scope)).toBe(false);
  });

  it("normalizes posix paths and strips leading ./", () => {
    expect(isPathInScope("./src/app.ts", defaultScope)).toBe(true);
  });

  it("applies user exclude additively", () => {
    const scope = createPathScope({ exclude: ["generated/**"] });
    expect(isPathInScope("generated/lib.ts", scope)).toBe(false);
    expect(isPathInScope("src/app.ts", scope)).toBe(true);
  });
});

describe("shouldPruneDirectory", () => {
  const defaultScope = createPathScope();

  it("returns true for excluded directory segments", () => {
    expect(shouldPruneDirectory("node_modules", defaultScope)).toBe(true);
    expect(shouldPruneDirectory(".git", defaultScope)).toBe(true);
    expect(shouldPruneDirectory("dist", defaultScope)).toBe(true);
  });

  it("prunes nested monorepo directories", () => {
    expect(shouldPruneDirectory("apps/web/.next", defaultScope)).toBe(true);
    expect(shouldPruneDirectory("apps/site/out", defaultScope)).toBe(true);
    expect(shouldPruneDirectory("services/api/vendor", defaultScope)).toBe(
      true,
    );
    expect(
      shouldPruneDirectory("packages/ui/storybook-static", defaultScope),
    ).toBe(true);
    expect(
      shouldPruneDirectory("packages/ui/src/__snapshots__", defaultScope),
    ).toBe(true);
  });

  it("prunes nested M48 toolchain artifact directories", () => {
    expect(shouldPruneDirectory("apps/web/.turbo", defaultScope)).toBe(true);
    expect(shouldPruneDirectory("apps/web/.vercel", defaultScope)).toBe(true);
    expect(shouldPruneDirectory("packages/lib/.cache", defaultScope)).toBe(
      true,
    );
    expect(shouldPruneDirectory("packages/app/.nuxt", defaultScope)).toBe(
      true,
    );
    expect(shouldPruneDirectory("apps/site/.output", defaultScope)).toBe(true);
    expect(
      shouldPruneDirectory("packages/ui/.parcel-cache", defaultScope),
    ).toBe(true);
    expect(shouldPruneDirectory("tools/tmp", defaultScope)).toBe(true);
  });

  it("prunes __tests__ directories", () => {
    expect(shouldPruneDirectory("__tests__", defaultScope)).toBe(true);
    expect(shouldPruneDirectory("src/__tests__", defaultScope)).toBe(true);
  });

  it("returns false for in-scope directories", () => {
    expect(shouldPruneDirectory("src", defaultScope)).toBe(false);
    expect(shouldPruneDirectory("lib", defaultScope)).toBe(false);
  });

  it("does not prune nested in-scope paths under src", () => {
    expect(shouldPruneDirectory("src/pkg", defaultScope)).toBe(false);
  });
});
