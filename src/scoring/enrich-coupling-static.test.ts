import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import type { CouplingPair } from "../types/index.js";
import {
  enrichCouplingStaticDeps,
  extractRelativeSpecifiers,
  extractStaticReferences,
} from "./enrich-coupling-static.js";

const tempDirs: string[] = [];

async function createTempRepo(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "enrich-coupling-static-"));
  tempDirs.push(dir);

  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = join(dir, relativePath);
    await mkdir(join(absolutePath, ".."), { recursive: true });
    await writeFile(absolutePath, content, "utf8");
  }

  return dir;
}

function makePair(fileA: string, fileB: string): CouplingPair {
  return {
    fileA,
    fileB,
    coChangeCount: 3,
    couplingStrength: 1,
    hasStaticDependency: false,
    staticDependencyDirection: "none",
    hasRuntimeStaticDependency: false,
    hasTypeOnlyStaticDependency: false,
    hasReExportStaticDependency: false,
  };
}

function assertCouplingInvariants(pair: CouplingPair): void {
  expect(pair.hasStaticDependency).toBe(
    pair.hasRuntimeStaticDependency || pair.hasTypeOnlyStaticDependency,
  );

  if (pair.hasReExportStaticDependency) {
    expect(pair.hasStaticDependency).toBe(true);
  }

  if (pair.staticDependencyDirection === "none") {
    expect(pair.hasStaticDependency).toBe(false);
    expect(pair.hasRuntimeStaticDependency).toBe(false);
    expect(pair.hasTypeOnlyStaticDependency).toBe(false);
    expect(pair.hasReExportStaticDependency).toBe(false);
  } else {
    expect(pair.hasStaticDependency).toBe(true);
  }
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("extractRelativeSpecifiers", () => {
  it("collects import, export, dynamic import, and require specifiers", () => {
    const source = [
      "import './side-effect';",
      "import { foo } from './foo';",
      "import type { Bar } from '../types/bar';",
      "export * from './re-export';",
      "export type { Baz } from './type-export';",
      "const mod = await import('./dynamic');",
      "const req = require('../legacy.cjs');",
      "import lodash from 'lodash';",
    ].join("\n");

    expect(extractRelativeSpecifiers(source)).toEqual([
      "./side-effect",
      "./foo",
      "../types/bar",
      "./re-export",
      "./type-export",
      "./dynamic",
      "../legacy.cjs",
    ]);
  });
});

describe("extractStaticReferences", () => {
  it("classifies runtime, type-only, and re-export edges including non-relative specifiers", () => {
    const source = [
      "import './side-effect';",
      "import { foo } from './foo';",
      "import type { Bar } from '@types/bar';",
      "export * from './re-export';",
      "export type { Baz } from './type-export';",
      "const mod = await import('@app/dynamic');",
      "const req = require('legacy-pkg');",
      "import lodash from 'lodash';",
    ].join("\n");

    expect(extractStaticReferences(source)).toEqual(
      expect.arrayContaining([
        { specifier: "./type-export", isTypeOnly: true, isReExport: true },
        { specifier: "./re-export", isTypeOnly: false, isReExport: true },
        { specifier: "@types/bar", isTypeOnly: true, isReExport: false },
        { specifier: "./side-effect", isTypeOnly: false, isReExport: false },
        { specifier: "./foo", isTypeOnly: false, isReExport: false },
        { specifier: "@app/dynamic", isTypeOnly: false, isReExport: false },
        { specifier: "legacy-pkg", isTypeOnly: false, isReExport: false },
        { specifier: "lodash", isTypeOnly: false, isReExport: false },
      ]),
    );
  });
});

describe("enrichCouplingStaticDeps", () => {
  it("sets hasStaticDependency true when one file imports the other", async () => {
    const repoPath = await createTempRepo({
      "src/consumer.ts":
        "import { low } from './provider';\nexport const value = low();\n",
      "src/provider.ts": "export function low(): number { return 1; }\n",
    });

    const pairs = enrichCouplingStaticDeps(
      [makePair("src/consumer.ts", "src/provider.ts")],
      repoPath,
    );

    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.hasStaticDependency).toBe(true);
    expect(pairs[0]?.staticDependencyDirection).toBe("a-to-b");
    expect(pairs[0]?.hasRuntimeStaticDependency).toBe(true);
    assertCouplingInvariants(pairs[0]!);
  });

  it("sets hasStaticDependency false when files are not statically linked", async () => {
    const repoPath = await createTempRepo({
      "src/a.ts": "export const a = 1;\n",
      "src/b.ts": "export const b = 2;\n",
    });

    const pairs = enrichCouplingStaticDeps(
      [makePair("src/a.ts", "src/b.ts")],
      repoPath,
    );

    expect(pairs[0]?.hasStaticDependency).toBe(false);
    expect(pairs[0]?.staticDependencyDirection).toBe("none");
    assertCouplingInvariants(pairs[0]!);
  });

  it("returns false without throwing when a coupled file is missing", async () => {
    const repoPath = await createTempRepo({
      "src/exists.ts": "export const ok = true;\n",
    });

    const pairs = enrichCouplingStaticDeps(
      [makePair("src/exists.ts", "src/missing.ts")],
      repoPath,
    );

    expect(pairs[0]?.hasStaticDependency).toBe(false);
    assertCouplingInvariants(pairs[0]!);
  });

  it("does not treat bare package imports as a static dependency to an unrelated peer", async () => {
    const repoPath = await createTempRepo({
      "src/pkg-only.ts":
        "import lodash from 'lodash';\nexport const x = lodash.sum([1, 2]);\n",
      "src/unrelated.ts": "export const y = 3;\n",
    });

    const pairs = enrichCouplingStaticDeps(
      [makePair("src/pkg-only.ts", "src/unrelated.ts")],
      repoPath,
    );

    expect(pairs[0]?.hasStaticDependency).toBe(false);
    assertCouplingInvariants(pairs[0]!);
  });

  it("resolves extensionless and index module paths", async () => {
    const repoPath = await createTempRepo({
      "src/consumer.ts":
        "import { value } from './lib';\nexport const out = value;\n",
      "src/lib/index.ts": "export const value = 42;\n",
    });

    const pairs = enrichCouplingStaticDeps(
      [makePair("src/consumer.ts", "src/lib/index.ts")],
      repoPath,
    );

    expect(pairs[0]?.hasStaticDependency).toBe(true);
    expect(pairs[0]?.staticDependencyDirection).toBe("a-to-b");
    assertCouplingInvariants(pairs[0]!);
  });

  it("preserves other pair fields while enriching", async () => {
    const repoPath = await createTempRepo({
      "src/a.ts": "import './b';\n",
      "src/b.ts": "export const b = 1;\n",
    });

    const input = {
      fileA: "src/a.ts",
      fileB: "src/b.ts",
      coChangeCount: 5,
      couplingStrength: 0.75,
      hasStaticDependency: false,
      staticDependencyDirection: "none" as const,
      hasRuntimeStaticDependency: false,
      hasTypeOnlyStaticDependency: false,
      hasReExportStaticDependency: false,
    };

    const pairs = enrichCouplingStaticDeps([input], repoPath);

    expect(pairs[0]).toEqual({
      ...input,
      hasStaticDependency: true,
      staticDependencyDirection: "a-to-b",
      hasRuntimeStaticDependency: true,
      hasTypeOnlyStaticDependency: false,
      hasReExportStaticDependency: false,
    });
    assertCouplingInvariants(pairs[0]!);
  });

  it("resolves .js import specifiers to .ts peers", async () => {
    const repoPath = await createTempRepo({
      "src/consumer.ts":
        "import { value } from './provider.js';\nexport const out = value;\n",
      "src/provider.ts": "export const value = 42;\n",
    });

    const pairs = enrichCouplingStaticDeps(
      [makePair("src/consumer.ts", "src/provider.ts")],
      repoPath,
    );

    expect(pairs[0]?.hasStaticDependency).toBe(true);
    assertCouplingInvariants(pairs[0]!);
  });

  it("ignores unresolvable relative specifiers", async () => {
    const repoPath = await createTempRepo({
      "src/a.ts": "import './missing';\nexport const a = 1;\n",
      "src/b.ts": "export const b = 2;\n",
    });

    const pairs = enrichCouplingStaticDeps(
      [makePair("src/a.ts", "src/b.ts")],
      repoPath,
    );

    expect(pairs[0]?.hasStaticDependency).toBe(false);
    assertCouplingInvariants(pairs[0]!);
  });

  it("returns an empty array for empty input", async () => {
    const repoPath = await createTempRepo({});
    expect(enrichCouplingStaticDeps([], repoPath)).toEqual([]);
  });

  it("sets direction b-to-a when only fileB references fileA", async () => {
    const repoPath = await createTempRepo({
      "src/a.ts": "export const a = 1;\n",
      "src/b.ts": "import { a } from './a';\nexport const b = a;\n",
    });

    const pairs = enrichCouplingStaticDeps(
      [makePair("src/a.ts", "src/b.ts")],
      repoPath,
    );

    expect(pairs[0]?.staticDependencyDirection).toBe("b-to-a");
    expect(pairs[0]?.hasRuntimeStaticDependency).toBe(true);
    assertCouplingInvariants(pairs[0]!);
  });

  it("sets direction both when files reference each other", async () => {
    const repoPath = await createTempRepo({
      "src/a.ts": "import { b } from './b';\nexport const a = b;\n",
      "src/b.ts": "import { a } from './a';\nexport const b = a;\n",
    });

    const pairs = enrichCouplingStaticDeps(
      [makePair("src/a.ts", "src/b.ts")],
      repoPath,
    );

    expect(pairs[0]?.staticDependencyDirection).toBe("both");
    expect(pairs[0]?.hasRuntimeStaticDependency).toBe(true);
    assertCouplingInvariants(pairs[0]!);
  });

  it("flags type-only-only pairs without runtime dependency", async () => {
    const repoPath = await createTempRepo({
      "src/a.ts": "import type { B } from './b';\nexport type A = B;\n",
      "src/b.ts": "export type B = { value: number };\n",
    });

    const pairs = enrichCouplingStaticDeps(
      [makePair("src/a.ts", "src/b.ts")],
      repoPath,
    );

    expect(pairs[0]?.hasStaticDependency).toBe(true);
    expect(pairs[0]?.hasTypeOnlyStaticDependency).toBe(true);
    expect(pairs[0]?.hasRuntimeStaticDependency).toBe(false);
    expect(pairs[0]?.hasReExportStaticDependency).toBe(false);
    expect(pairs[0]?.staticDependencyDirection).toBe("a-to-b");
    assertCouplingInvariants(pairs[0]!);
  });

  it("flags re-export edges with runtime dependency", async () => {
    const repoPath = await createTempRepo({
      "src/a.ts": "export * from './b';\n",
      "src/b.ts": "export const value = 1;\n",
    });

    const pairs = enrichCouplingStaticDeps(
      [makePair("src/a.ts", "src/b.ts")],
      repoPath,
    );

    expect(pairs[0]?.hasStaticDependency).toBe(true);
    expect(pairs[0]?.hasReExportStaticDependency).toBe(true);
    expect(pairs[0]?.hasRuntimeStaticDependency).toBe(true);
    expect(pairs[0]?.hasTypeOnlyStaticDependency).toBe(false);
    expect(pairs[0]?.staticDependencyDirection).toBe("a-to-b");
    assertCouplingInvariants(pairs[0]!);
  });

  it("flags type-only re-export edges", async () => {
    const repoPath = await createTempRepo({
      "src/a.ts": "export type { B } from './b';\n",
      "src/b.ts": "export type B = { value: number };\n",
    });

    const pairs = enrichCouplingStaticDeps(
      [makePair("src/a.ts", "src/b.ts")],
      repoPath,
    );

    expect(pairs[0]?.hasStaticDependency).toBe(true);
    expect(pairs[0]?.hasReExportStaticDependency).toBe(true);
    expect(pairs[0]?.hasTypeOnlyStaticDependency).toBe(true);
    expect(pairs[0]?.hasRuntimeStaticDependency).toBe(false);
    assertCouplingInvariants(pairs[0]!);
  });

  it("sets both kind flags when runtime and type-only edges are present", async () => {
    const repoPath = await createTempRepo({
      "src/a.ts": [
        "import { value } from './b';",
        "import type { B } from './b';",
        "export const a = value;",
      ].join("\n"),
      "src/b.ts": "export type B = { value: number };\nexport const value = 1;\n",
    });

    const pairs = enrichCouplingStaticDeps(
      [makePair("src/a.ts", "src/b.ts")],
      repoPath,
    );

    expect(pairs[0]?.hasRuntimeStaticDependency).toBe(true);
    expect(pairs[0]?.hasTypeOnlyStaticDependency).toBe(true);
    assertCouplingInvariants(pairs[0]!);
  });

  it("resolves tsconfig paths alias when peer matches", async () => {
    const repoPath = await createTempRepo({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "@app/*": ["src/*"],
          },
        },
      }),
      "src/consumer.ts":
        "import { value } from '@app/provider';\nexport const out = value;\n",
      "src/provider.ts": "export const value = 42;\n",
    });

    const pairs = enrichCouplingStaticDeps(
      [makePair("src/consumer.ts", "src/provider.ts")],
      repoPath,
    );

    expect(pairs[0]?.hasStaticDependency).toBe(true);
    expect(pairs[0]?.staticDependencyDirection).toBe("a-to-b");
    expect(pairs[0]?.hasRuntimeStaticDependency).toBe(true);
    assertCouplingInvariants(pairs[0]!);
  });

  it("does not create an edge when alias resolves to a non-peer path", async () => {
    const repoPath = await createTempRepo({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          paths: {
            "@app/*": ["src/*"],
          },
        },
      }),
      "src/consumer.ts":
        "import { value } from '@app/other';\nexport const out = value;\n",
      "src/provider.ts": "export const value = 42;\n",
      "src/other.ts": "export const value = 99;\n",
    });

    const pairs = enrichCouplingStaticDeps(
      [makePair("src/consumer.ts", "src/provider.ts")],
      repoPath,
    );

    expect(pairs[0]?.hasStaticDependency).toBe(false);
    assertCouplingInvariants(pairs[0]!);
  });

  it("preserves input pair order and ranking fields across multiple pairs", async () => {
    const repoPath = await createTempRepo({
      "src/a.ts": "import './b';\n",
      "src/b.ts": "export const b = 1;\n",
      "src/c.ts": "export const c = 2;\n",
      "src/d.ts": "export const d = 3;\n",
    });

    const input: CouplingPair[] = [
      {
        ...makePair("src/c.ts", "src/d.ts"),
        coChangeCount: 9,
        couplingStrength: 0.5,
      },
      {
        ...makePair("src/a.ts", "src/b.ts"),
        coChangeCount: 2,
        couplingStrength: 0.25,
      },
    ];

    const pairs = enrichCouplingStaticDeps(input, repoPath);

    expect(pairs.map((pair) => pair.fileA)).toEqual(["src/c.ts", "src/a.ts"]);
    expect(pairs[0]?.coChangeCount).toBe(9);
    expect(pairs[0]?.couplingStrength).toBe(0.5);
    expect(pairs[1]?.coChangeCount).toBe(2);
    expect(pairs[1]?.couplingStrength).toBe(0.25);
    expect(pairs[0]?.hasStaticDependency).toBe(false);
    expect(pairs[1]?.hasStaticDependency).toBe(true);
    for (const pair of pairs) {
      assertCouplingInvariants(pair);
    }
  });
});
