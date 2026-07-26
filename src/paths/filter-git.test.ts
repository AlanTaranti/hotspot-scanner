import { describe, expect, it } from "vitest";
import type { FileChangeStats } from "../types/index.js";
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
        warnings: [],
        canonicalizePath: identityCanonicalize,
      },
      scope,
    );

    expect([...result.fileStats.keys()]).toEqual(["src/app.ts"]);
  });

  it("passes warnings through unchanged", () => {
    const result = filterGitMinerResult(
      {
        fileStats: new Map(),
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
        warnings: [],
        canonicalizePath: identityCanonicalize,
      },
      scope,
    );

    expect(result.fileStats.size).toBe(0);
  });
});
