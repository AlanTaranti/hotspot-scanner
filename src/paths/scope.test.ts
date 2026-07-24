import { describe, expect, it } from "vitest";
import {
  createPathScope,
  DEFAULT_EXCLUDE_PATTERNS,
  isPathInScope,
  shouldPruneDirectory,
} from "./scope.js";

describe("DEFAULT_EXCLUDE_PATTERNS", () => {
  it("includes M7 and M30 monorepo patterns", () => {
    expect(DEFAULT_EXCLUDE_PATTERNS).toEqual([
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

  it("includes eligible paths outside excludes", () => {
    expect(isPathInScope("src/app.ts", defaultScope)).toBe(true);
    expect(isPathInScope("lib/utils.ts", defaultScope)).toBe(true);
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

  it("returns false for in-scope directories", () => {
    expect(shouldPruneDirectory("src", defaultScope)).toBe(false);
    expect(shouldPruneDirectory("lib", defaultScope)).toBe(false);
  });

  it("does not prune nested in-scope paths under src", () => {
    expect(shouldPruneDirectory("src/pkg", defaultScope)).toBe(false);
  });
});
