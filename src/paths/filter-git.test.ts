import { describe, expect, it } from "vitest";
import type { CoChangePairCount, FileChangeStats } from "../types/index.js";
import { filterGitMinerResult } from "./filter-git.js";
import { createPathScope } from "./scope.js";

function makeFileStats(
  entries: Array<[string, Partial<FileChangeStats>]>,
): Map<string, FileChangeStats> {
  const map = new Map<string, FileChangeStats>();
  for (const [filePath, partial] of entries) {
    map.set(filePath, {
      filePath,
      commitCount: partial.commitCount ?? 1,
      linesChanged: partial.linesChanged ?? 10,
      authors: partial.authors ?? new Set(["dev"]),
      lastModified: partial.lastModified ?? new Date("2026-01-01"),
    });
  }
  return map;
}

function makePairCounts(
  entries: Array<[string, string, number]>,
): Map<string, CoChangePairCount> {
  const map = new Map<string, CoChangePairCount>();
  for (const [fileA, fileB, coChangeCount] of entries) {
    const key = `${fileA}|${fileB}`;
    map.set(key, { fileA, fileB, coChangeCount });
  }
  return map;
}

const identityCanonicalize = (path: string) => path;

describe("filterGitMinerResult", () => {
  const scope = createPathScope();

  it("removes out-of-scope fileStats entries", () => {
    const result = filterGitMinerResult(
      {
        fileStats: makeFileStats([
          ["src/app.ts", {}],
          ["node_modules/pkg/index.ts", {}],
        ]),
        pairCounts: new Map(),
        warnings: [],
        canonicalizePath: identityCanonicalize,
      },
      scope,
    );

    expect([...result.fileStats.keys()]).toEqual(["src/app.ts"]);
  });

  it("keeps pairCounts when both endpoints are in scope", () => {
    const pairCounts = makePairCounts([["src/a.ts", "src/b.ts", 3]]);

    const result = filterGitMinerResult(
      {
        fileStats: makeFileStats([
          ["src/a.ts", {}],
          ["src/b.ts", {}],
        ]),
        pairCounts,
        warnings: [],
        canonicalizePath: identityCanonicalize,
      },
      scope,
    );

    expect([...result.pairCounts.values()]).toEqual([
      { fileA: "src/a.ts", fileB: "src/b.ts", coChangeCount: 3 },
    ]);
  });

  it("drops pairCounts when either endpoint is out of scope", () => {
    const result = filterGitMinerResult(
      {
        fileStats: makeFileStats([["src/a.ts", {}]]),
        pairCounts: makePairCounts([
          ["src/a.ts", "node_modules/x.ts", 2],
        ]),
        warnings: [],
        canonicalizePath: identityCanonicalize,
      },
      scope,
    );

    expect(result.pairCounts.size).toBe(0);
  });

  it("passes warnings through unchanged", () => {
    const result = filterGitMinerResult(
      {
        fileStats: new Map(),
        pairCounts: new Map(),
        warnings: ["git warning"],
        canonicalizePath: identityCanonicalize,
      },
      scope,
    );

    expect(result.warnings).toEqual(["git warning"]);
  });

  it("returns empty result when all paths excluded", () => {
    const result = filterGitMinerResult(
      {
        fileStats: makeFileStats([["dist/bundle.js", {}]]),
        pairCounts: makePairCounts([["dist/a.js", "dist/b.js", 1]]),
        warnings: [],
        canonicalizePath: identityCanonicalize,
      },
      scope,
    );

    expect(result.fileStats.size).toBe(0);
    expect(result.pairCounts.size).toBe(0);
  });

  it("preserves coChangeCount for in-scope pairs", () => {
    const result = filterGitMinerResult(
      {
        fileStats: makeFileStats([
          ["src/a.ts", {}],
          ["src/b.ts", {}],
        ]),
        pairCounts: makePairCounts([["src/a.ts", "src/b.ts", 7]]),
        warnings: [],
        canonicalizePath: identityCanonicalize,
      },
      scope,
    );

    expect(result.pairCounts.get("src/a.ts|src/b.ts")).toEqual({
      fileA: "src/a.ts",
      fileB: "src/b.ts",
      coChangeCount: 7,
    });
  });
});
