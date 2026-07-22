import { describe, expect, it } from "vitest";
import type { CoChangeEvent, FileChangeStats } from "../types/index.js";
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

describe("filterGitMinerResult", () => {
  const scope = createPathScope();

  it("removes out-of-scope fileStats entries", () => {
    const result = filterGitMinerResult(
      {
        fileStats: makeFileStats([
          ["src/app.ts", {}],
          ["node_modules/pkg/index.ts", {}],
        ]),
        coChangeEvents: [],
        warnings: [],
      },
      scope,
    );

    expect([...result.fileStats.keys()]).toEqual(["src/app.ts"]);
  });

  it("filters coChangeEvents to in-scope files only", () => {
    const events: CoChangeEvent[] = [
      {
        commitHash: "abc",
        filesChanged: ["src/a.ts", "src/b.ts", "node_modules/x.ts"],
      },
    ];

    const result = filterGitMinerResult(
      {
        fileStats: makeFileStats([["src/a.ts", {}], ["src/b.ts", {}]]),
        coChangeEvents: events,
        warnings: [],
      },
      scope,
    );

    expect(result.coChangeEvents).toEqual([
      { commitHash: "abc", filesChanged: ["src/a.ts", "src/b.ts"] },
    ]);
  });

  it("drops coChangeEvents with fewer than 2 in-scope files", () => {
    const result = filterGitMinerResult(
      {
        fileStats: makeFileStats([["src/a.ts", {}]]),
        coChangeEvents: [
          {
            commitHash: "partial",
            filesChanged: ["src/a.ts", "node_modules/x.ts"],
          },
        ],
        warnings: [],
      },
      scope,
    );

    expect(result.coChangeEvents).toEqual([]);
  });

  it("passes warnings through unchanged", () => {
    const result = filterGitMinerResult(
      {
        fileStats: new Map(),
        coChangeEvents: [],
        warnings: ["git warning"],
      },
      scope,
    );

    expect(result.warnings).toEqual(["git warning"]);
  });

  it("returns empty result when all paths excluded", () => {
    const result = filterGitMinerResult(
      {
        fileStats: makeFileStats([["dist/bundle.js", {}]]),
        coChangeEvents: [
          {
            commitHash: "x",
            filesChanged: ["dist/a.js", "dist/b.js"],
          },
        ],
        warnings: [],
      },
      scope,
    );

    expect(result.fileStats.size).toBe(0);
    expect(result.coChangeEvents).toEqual([]);
  });

  it("deduplicates in-scope files in coChangeEvents", () => {
    const result = filterGitMinerResult(
      {
        fileStats: makeFileStats([["src/a.ts", {}], ["src/b.ts", {}]]),
        coChangeEvents: [
          {
            commitHash: "dup",
            filesChanged: ["src/a.ts", "src/a.ts", "src/b.ts"],
          },
        ],
        warnings: [],
      },
      scope,
    );

    expect(result.coChangeEvents[0]!.filesChanged).toEqual([
      "src/a.ts",
      "src/b.ts",
    ]);
  });
});
