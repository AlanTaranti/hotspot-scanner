import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readFileSyncCalls = vi.hoisted(
  () => [] as Array<string | Buffer | URL | number>,
);

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    readFileSync: (
      path: Parameters<typeof actual.readFileSync>[0],
      options?: Parameters<typeof actual.readFileSync>[1],
    ) => {
      readFileSyncCalls.push(path);
      return actual.readFileSync(path, options);
    },
  };
});

import type { CouplingPair } from "../types/index.js";
import {
  buildStaticEdgeGraph,
  enrichCouplingStaticDeps,
  extractRelativeSpecifiers,
  extractStaticReferences,
  getStaticEdge,
} from "./enrich-coupling-static.js";
import { TsconfigPathMap } from "./tsconfig-path-map.js";

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

function countReadsForRepoPath(
  repoPath: string,
  relativePath: string,
): number {
  const absolute = join(repoPath, relativePath);
  return readFileSyncCalls.filter((path) => path === absolute).length;
}

function countPackageJsonReads(repoPath: string, relativePath: string): number {
  return countReadsForRepoPath(repoPath, relativePath);
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

beforeEach(() => {
  readFileSyncCalls.splice(0);
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

  it("reads a hub file at most once when it appears in many pairs", async () => {
    const hubPath = "src/hub.ts";
    const leafPaths = Array.from({ length: 5 }, (_, index) => `src/leaf-${index + 1}.ts`);

    const files: Record<string, string> = {
      [hubPath]: "export const hub = 1;\n",
    };
    for (const leafPath of leafPaths) {
      files[leafPath] =
        "import { hub } from './hub';\nexport const value = hub;\n";
    }

    const repoPath = await createTempRepo(files);

    const pairs = leafPaths.map((leafPath) => makePair(hubPath, leafPath));
    const enriched = enrichCouplingStaticDeps(pairs, repoPath);

    expect(enriched).toHaveLength(5);
    expect(countReadsForRepoPath(repoPath, hubPath)).toBe(1);
    for (const pair of enriched) {
      assertCouplingInvariants(pair);
    }
  });

  it("does not read source files when pairs are empty", async () => {
    const repoPath = await createTempRepo({
      "src/a.ts": "export const a = 1;\n",
    });

    expect(enrichCouplingStaticDeps([], repoPath)).toEqual([]);
    expect(readFileSyncCalls).toHaveLength(0);
  });

  it("preserves M14/M27 labels for direction, kinds, and alias in one enrich call", async () => {
    const repoPath = await createTempRepo({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "@app/*": ["src/*"],
          },
        },
      }),
      "src/a-to-b-consumer.ts":
        "import { v } from './a-to-b-provider';\nexport const x = v;\n",
      "src/a-to-b-provider.ts": "export const v = 1;\n",
      "src/b-to-a-only.ts": "export const x = 1;\n",
      "src/b-to-a-consumer.ts":
        "import { x } from './b-to-a-only';\nexport const y = x;\n",
      "src/cyclic-a.ts": "import { b } from './cyclic-b';\nexport const a = b;\n",
      "src/cyclic-b.ts": "import { a } from './cyclic-a';\nexport const b = a;\n",
      "src/type-src.ts": "import type { T } from './type-dst';\nexport type S = T;\n",
      "src/type-dst.ts": "export type T = number;\n",
      "src/reexport.ts": "export * from './reexport-target';\n",
      "src/reexport-target.ts": "export const value = 1;\n",
      "src/alias-consumer.ts":
        "import { value } from '@app/alias-target';\nexport const out = value;\n",
      "src/alias-target.ts": "export const value = 42;\n",
      "src/isolated-a.ts": "export const a = 1;\n",
      "src/isolated-b.ts": "export const b = 2;\n",
    });

    const input: CouplingPair[] = [
      {
        ...makePair("src/a-to-b-consumer.ts", "src/a-to-b-provider.ts"),
        coChangeCount: 4,
        couplingStrength: 0.8,
      },
      {
        ...makePair("src/b-to-a-only.ts", "src/b-to-a-consumer.ts"),
        coChangeCount: 3,
        couplingStrength: 0.6,
      },
      {
        ...makePair("src/cyclic-a.ts", "src/cyclic-b.ts"),
        coChangeCount: 5,
        couplingStrength: 1,
      },
      {
        ...makePair("src/type-src.ts", "src/type-dst.ts"),
        coChangeCount: 2,
        couplingStrength: 0.4,
      },
      {
        ...makePair("src/reexport.ts", "src/reexport-target.ts"),
        coChangeCount: 7,
        couplingStrength: 0.9,
      },
      {
        ...makePair("src/alias-consumer.ts", "src/alias-target.ts"),
        coChangeCount: 6,
        couplingStrength: 0.7,
      },
      {
        ...makePair("src/isolated-a.ts", "src/isolated-b.ts"),
        coChangeCount: 1,
        couplingStrength: 0.1,
      },
    ];

    const pairs = enrichCouplingStaticDeps(input, repoPath);

    expect(pairs).toHaveLength(7);
    expect(pairs.map((pair) => pair.fileA)).toEqual(input.map((pair) => pair.fileA));
    expect(pairs.map((pair) => pair.coChangeCount)).toEqual(
      input.map((pair) => pair.coChangeCount),
    );
    expect(pairs.map((pair) => pair.couplingStrength)).toEqual(
      input.map((pair) => pair.couplingStrength),
    );

    const byKey = (fileA: string, fileB: string) =>
      pairs.find((pair) => pair.fileA === fileA && pair.fileB === fileB)!;

    expect(
      byKey("src/a-to-b-consumer.ts", "src/a-to-b-provider.ts"),
    ).toMatchObject({
      hasStaticDependency: true,
      staticDependencyDirection: "a-to-b",
      hasRuntimeStaticDependency: true,
      hasTypeOnlyStaticDependency: false,
      hasReExportStaticDependency: false,
    });
    expect(byKey("src/b-to-a-only.ts", "src/b-to-a-consumer.ts")).toMatchObject({
      staticDependencyDirection: "b-to-a",
      hasRuntimeStaticDependency: true,
    });
    expect(byKey("src/cyclic-a.ts", "src/cyclic-b.ts")).toMatchObject({
      staticDependencyDirection: "both",
      hasRuntimeStaticDependency: true,
    });
    expect(byKey("src/type-src.ts", "src/type-dst.ts")).toMatchObject({
      staticDependencyDirection: "a-to-b",
      hasRuntimeStaticDependency: false,
      hasTypeOnlyStaticDependency: true,
      hasReExportStaticDependency: false,
    });
    expect(byKey("src/reexport.ts", "src/reexport-target.ts")).toMatchObject({
      staticDependencyDirection: "a-to-b",
      hasReExportStaticDependency: true,
      hasRuntimeStaticDependency: true,
      hasTypeOnlyStaticDependency: false,
    });
    expect(byKey("src/alias-consumer.ts", "src/alias-target.ts")).toMatchObject({
      staticDependencyDirection: "a-to-b",
      hasRuntimeStaticDependency: true,
    });
    expect(byKey("src/isolated-a.ts", "src/isolated-b.ts")).toMatchObject({
      hasStaticDependency: false,
      staticDependencyDirection: "none",
      hasRuntimeStaticDependency: false,
      hasTypeOnlyStaticDependency: false,
      hasReExportStaticDependency: false,
    });

    for (const pair of pairs) {
      assertCouplingInvariants(pair);
    }
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

  it("resolves in-repo package exports entry to a peer", async () => {
    const repoPath = await createTempRepo({
      "packages/provider/package.json": JSON.stringify({
        name: "@repo/provider",
        exports: { ".": "./src/index.ts" },
      }),
      "packages/provider/src/index.ts": "export const value = 42;\n",
      "packages/consumer/src/consumer.ts":
        "import { value } from '@repo/provider';\nexport const out = value;\n",
    });

    const pairs = enrichCouplingStaticDeps(
      [makePair("packages/consumer/src/consumer.ts", "packages/provider/src/index.ts")],
      repoPath,
    );

    expect(pairs[0]).toMatchObject({
      hasStaticDependency: true,
      staticDependencyDirection: "a-to-b",
      hasRuntimeStaticDependency: true,
      hasTypeOnlyStaticDependency: false,
      hasReExportStaticDependency: false,
      coChangeCount: 3,
      couplingStrength: 1,
    });
    assertCouplingInvariants(pairs[0]!);
  });

  it("resolves # imports mapping to a peer", async () => {
    const repoPath = await createTempRepo({
      "packages/consumer/package.json": JSON.stringify({
        name: "@repo/consumer",
        imports: {
          "#util": "./src/util.ts",
        },
      }),
      "packages/consumer/src/consumer.ts":
        "import { util } from '#util';\nexport const out = util;\n",
      "packages/consumer/src/util.ts": "export const util = 1;\n",
    });

    const pairs = enrichCouplingStaticDeps(
      [makePair("packages/consumer/src/consumer.ts", "packages/consumer/src/util.ts")],
      repoPath,
    );

    expect(pairs[0]).toMatchObject({
      hasStaticDependency: true,
      staticDependencyDirection: "a-to-b",
      hasRuntimeStaticDependency: true,
      hasTypeOnlyStaticDependency: false,
      hasReExportStaticDependency: false,
    });
    assertCouplingInvariants(pairs[0]!);
  });

  it("flags type-only edges via # imports", async () => {
    const repoPath = await createTempRepo({
      "package.json": JSON.stringify({
        imports: {
          "#types": "./src/types.ts",
        },
      }),
      "src/consumer.ts":
        "import type { T } from '#types';\nexport type Out = T;\n",
      "src/types.ts": "export type T = number;\n",
    });

    const pairs = enrichCouplingStaticDeps(
      [makePair("src/consumer.ts", "src/types.ts")],
      repoPath,
    );

    expect(pairs[0]).toMatchObject({
      hasStaticDependency: true,
      staticDependencyDirection: "a-to-b",
      hasRuntimeStaticDependency: false,
      hasTypeOnlyStaticDependency: true,
      hasReExportStaticDependency: false,
    });
    assertCouplingInvariants(pairs[0]!);
  });

  it("does not resolve external package names absent from the peer index", async () => {
    const repoPath = await createTempRepo({
      "src/consumer.ts":
        "import { sum } from 'lodash';\nexport const x = sum([1, 2]);\n",
      "src/unrelated.ts": "export const y = 3;\n",
    });

    const pairs = enrichCouplingStaticDeps(
      [makePair("src/consumer.ts", "src/unrelated.ts")],
      repoPath,
    );

    expect(pairs[0]?.hasStaticDependency).toBe(false);
    expect(pairs[0]?.staticDependencyDirection).toBe("none");
    assertCouplingInvariants(pairs[0]!);
  });

  describe("package-exports-coupling fixture", () => {
    const repoPath = join(
      process.cwd(),
      "tests/fixtures/repos/package-exports-coupling",
    );

    it("resolves cross-package exports entry to provider peer", () => {
      const pairs = enrichCouplingStaticDeps(
        [
          makePair(
            "packages/consumer/src/exports-consumer.ts",
            "packages/provider/src/index.ts",
          ),
        ],
        repoPath,
      );

      expect(pairs[0]).toMatchObject({
        hasStaticDependency: true,
        staticDependencyDirection: "a-to-b",
        hasRuntimeStaticDependency: true,
        hasTypeOnlyStaticDependency: false,
        hasReExportStaticDependency: false,
      });
      assertCouplingInvariants(pairs[0]!);
    });

    it("resolves # imports mapping to util peer", () => {
      const pairs = enrichCouplingStaticDeps(
        [
          makePair(
            "packages/consumer/src/imports-consumer.ts",
            "packages/consumer/src/util.ts",
          ),
        ],
        repoPath,
      );

      expect(pairs[0]).toMatchObject({
        hasStaticDependency: true,
        staticDependencyDirection: "a-to-b",
        hasRuntimeStaticDependency: true,
        hasTypeOnlyStaticDependency: false,
        hasReExportStaticDependency: false,
      });
      assertCouplingInvariants(pairs[0]!);
    });

    it("does not resolve external lodash import to provider peer", () => {
      const pairs = enrichCouplingStaticDeps(
        [
          makePair(
            "packages/consumer/src/isolated.ts",
            "packages/provider/src/index.ts",
          ),
        ],
        repoPath,
      );

      expect(pairs[0]).toMatchObject({
        hasStaticDependency: false,
        staticDependencyDirection: "none",
        hasRuntimeStaticDependency: false,
        hasTypeOnlyStaticDependency: false,
        hasReExportStaticDependency: false,
      });
      assertCouplingInvariants(pairs[0]!);
    });
  });

  it("reads package.json at most once when a hub package appears in many pairs", async () => {
    const hubPath = "packages/hub/src/index.ts";
    const packageJsonPath = "packages/hub/package.json";
    const leafPaths = Array.from(
      { length: 5 },
      (_, index) => `packages/leaf-${index + 1}/src/consumer.ts`,
    );

    const files: Record<string, string> = {
      [packageJsonPath]: JSON.stringify({
        name: "@repo/hub",
        exports: { ".": "./src/index.ts" },
      }),
      [hubPath]: "export const hub = 1;\n",
    };

    for (const leafPath of leafPaths) {
      files[leafPath] =
        "import { hub } from '@repo/hub';\nexport const value = hub;\n";
    }

    const repoPath = await createTempRepo(files);

    const pairs = leafPaths.map((leafPath) => makePair(hubPath, leafPath));
    const enriched = enrichCouplingStaticDeps(pairs, repoPath);

    expect(enriched).toHaveLength(5);
    expect(countReadsForRepoPath(repoPath, hubPath)).toBe(1);
    expect(countPackageJsonReads(repoPath, packageJsonPath)).toBe(1);
    for (const pair of enriched) {
      expect(pair.hasStaticDependency).toBe(true);
      expect(pair.staticDependencyDirection).toBe("b-to-a");
      assertCouplingInvariants(pair);
    }
  });
});

describe("buildStaticEdgeGraph", () => {
  function buildGraph(
    repoPath: string,
    peerPaths: string[],
  ): ReturnType<typeof buildStaticEdgeGraph> {
    const pathMap = new TsconfigPathMap(repoPath);
    return buildStaticEdgeGraph(new Set(peerPaths), repoPath, pathMap);
  }

  it("records a one-way runtime edge from importer to peer", async () => {
    const repoPath = await createTempRepo({
      "src/consumer.ts":
        "import { low } from './provider';\nexport const value = low();\n",
      "src/provider.ts": "export function low(): number { return 1; }\n",
    });

    const graph = buildGraph(repoPath, ["src/consumer.ts", "src/provider.ts"]);

    expect(getStaticEdge(graph, "src/consumer.ts", "src/provider.ts")).toEqual({
      hasRuntimeStaticDependency: true,
      hasTypeOnlyStaticDependency: false,
      hasReExportStaticDependency: false,
    });
    expect(getStaticEdge(graph, "src/provider.ts", "src/consumer.ts")).toBeUndefined();
  });

  it("records edges in both directions when files reference each other", async () => {
    const repoPath = await createTempRepo({
      "src/a.ts": "import { b } from './b';\nexport const a = b;\n",
      "src/b.ts": "import { a } from './a';\nexport const b = a;\n",
    });

    const graph = buildGraph(repoPath, ["src/a.ts", "src/b.ts"]);

    expect(getStaticEdge(graph, "src/a.ts", "src/b.ts")).toEqual({
      hasRuntimeStaticDependency: true,
      hasTypeOnlyStaticDependency: false,
      hasReExportStaticDependency: false,
    });
    expect(getStaticEdge(graph, "src/b.ts", "src/a.ts")).toEqual({
      hasRuntimeStaticDependency: true,
      hasTypeOnlyStaticDependency: false,
      hasReExportStaticDependency: false,
    });
  });

  it("OR-aggregates runtime, type-only, and re-export kind flags on the same edge", async () => {
    const repoPath = await createTempRepo({
      "src/a.ts": [
        "import { value } from './b';",
        "import type { B } from './b';",
        "export * from './b';",
        "export const a = value;",
      ].join("\n"),
      "src/b.ts": "export type B = { value: number };\nexport const value = 1;\n",
    });

    const graph = buildGraph(repoPath, ["src/a.ts", "src/b.ts"]);

    expect(getStaticEdge(graph, "src/a.ts", "src/b.ts")).toEqual({
      hasRuntimeStaticDependency: true,
      hasTypeOnlyStaticDependency: true,
      hasReExportStaticDependency: true,
    });
  });

  it("flags type-only and re-export edges without runtime dependency", async () => {
    const repoPath = await createTempRepo({
      "src/a.ts": "export type { B } from './b';\n",
      "src/b.ts": "export type B = { value: number };\n",
    });

    const graph = buildGraph(repoPath, ["src/a.ts", "src/b.ts"]);

    expect(getStaticEdge(graph, "src/a.ts", "src/b.ts")).toEqual({
      hasRuntimeStaticDependency: false,
      hasTypeOnlyStaticDependency: true,
      hasReExportStaticDependency: true,
    });
  });

  it("produces no outbound edges when the source file is missing", async () => {
    const repoPath = await createTempRepo({
      "src/exists.ts": "export const ok = true;\n",
    });

    const graph = buildGraph(repoPath, ["src/missing.ts", "src/exists.ts"]);

    expect(graph.has("src/missing.ts")).toBe(false);
    expect(getStaticEdge(graph, "src/missing.ts", "src/exists.ts")).toBeUndefined();
  });

  it("resolves relative and tsconfig alias specifiers to peer targets", async () => {
    const repoPath = await createTempRepo({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "@app/*": ["src/*"],
          },
        },
      }),
      "src/relative-consumer.ts":
        "import { value } from './provider';\nexport const out = value;\n",
      "src/alias-consumer.ts":
        "import { value } from '@app/provider';\nexport const out = value;\n",
      "src/provider.ts": "export const value = 42;\n",
    });

    const graph = buildGraph(repoPath, [
      "src/relative-consumer.ts",
      "src/alias-consumer.ts",
      "src/provider.ts",
    ]);

    expect(
      getStaticEdge(graph, "src/relative-consumer.ts", "src/provider.ts"),
    ).toEqual({
      hasRuntimeStaticDependency: true,
      hasTypeOnlyStaticDependency: false,
      hasReExportStaticDependency: false,
    });
    expect(
      getStaticEdge(graph, "src/alias-consumer.ts", "src/provider.ts"),
    ).toEqual({
      hasRuntimeStaticDependency: true,
      hasTypeOnlyStaticDependency: false,
      hasReExportStaticDependency: false,
    });
  });

  it("resolves package exports and # imports specifiers to peer targets", async () => {
    const repoPath = await createTempRepo({
      "packages/provider/package.json": JSON.stringify({
        name: "@repo/provider",
        exports: { ".": "./src/index.ts" },
      }),
      "packages/provider/src/index.ts": "export const value = 42;\n",
      "packages/consumer/package.json": JSON.stringify({
        name: "@repo/consumer",
        imports: { "#util": "./src/util.ts" },
      }),
      "packages/consumer/src/exports-consumer.ts":
        "import { value } from '@repo/provider';\nexport const out = value;\n",
      "packages/consumer/src/imports-consumer.ts":
        "import { util } from '#util';\nexport const out = util;\n",
      "packages/consumer/src/util.ts": "export const util = 1;\n",
    });

    const graph = buildGraph(repoPath, [
      "packages/consumer/src/exports-consumer.ts",
      "packages/consumer/src/imports-consumer.ts",
      "packages/provider/src/index.ts",
      "packages/consumer/src/util.ts",
    ]);

    expect(
      getStaticEdge(
        graph,
        "packages/consumer/src/exports-consumer.ts",
        "packages/provider/src/index.ts",
      ),
    ).toEqual({
      hasRuntimeStaticDependency: true,
      hasTypeOnlyStaticDependency: false,
      hasReExportStaticDependency: false,
    });
    expect(
      getStaticEdge(
        graph,
        "packages/consumer/src/imports-consumer.ts",
        "packages/consumer/src/util.ts",
      ),
    ).toEqual({
      hasRuntimeStaticDependency: true,
      hasTypeOnlyStaticDependency: false,
      hasReExportStaticDependency: false,
    });
  });
});
