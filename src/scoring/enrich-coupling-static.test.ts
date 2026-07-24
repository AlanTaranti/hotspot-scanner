import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import type { CouplingPair } from "../types/index.js";
import {
  enrichCouplingStaticDeps,
  extractRelativeSpecifiers,
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
  };
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
    };

    const pairs = enrichCouplingStaticDeps([input], repoPath);

    expect(pairs[0]).toEqual({
      ...input,
      hasStaticDependency: true,
    });
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
  });

  it("returns an empty array for empty input", async () => {
    const repoPath = await createTempRepo({});
    expect(enrichCouplingStaticDeps([], repoPath)).toEqual([]);
  });
});
