import { describe, expect, it } from "vitest";
import {
  aggregateCommits,
  aggregateOneCommit,
  createAggregateAccumulators,
} from "./aggregate.js";
import type { ParsedCommit } from "./parse.js";
import { PathAliasMap } from "./rename.js";

const date1 = new Date("2024-01-01T00:00:00Z");
const date2 = new Date("2024-02-01T00:00:00Z");

function makeCommit(
  hash: string,
  author: string,
  date: Date,
  files: ParsedCommit["files"],
): ParsedCommit {
  return { hash, author, date, files };
}

function makeFiles(count: number, prefix = "file"): ParsedCommit["files"] {
  return Array.from({ length: count }, (_, index) => ({
    path: `${prefix}-${index}.ts`,
    additions: 1,
    deletions: 0,
  }));
}

describe("aggregateCommits", () => {
  it("builds FileChangeStats from one pass", () => {
    const commits: ParsedCommit[] = [
      makeCommit("aaa", "Alice", date1, [
        { path: "a.ts", additions: 3, deletions: 1 },
        { path: "b.ts", additions: 2, deletions: 0 },
      ]),
      makeCommit("bbb", "Bob", date2, [
        { path: "a.ts", additions: 1, deletions: 1 },
      ]),
    ];

    const aliasMap = new PathAliasMap();
    const result = aggregateCommits(commits, aliasMap);

    const aStats = result.fileStats.get("a.ts");
    expect(aStats?.commitCount).toBe(2);
    expect(aStats?.linesChanged).toBe(6);
    expect(aStats?.authors).toEqual(new Set(["Alice", "Bob"]));
    expect(aStats?.lastModified).toEqual(date2);
  });

  it("skips commits with zero files", () => {
    const commits: ParsedCommit[] = [
      makeCommit("aaa", "Alice", date1, []),
      makeCommit("bbb", "Alice", date2, [
        { path: "a.ts", additions: 1, deletions: 0 },
      ]),
    ];

    const result = aggregateCommits(commits, new PathAliasMap());
    expect(result.fileStats.size).toBe(1);
  });

  it("does not add linesChanged for binary files", () => {
    const commits: ParsedCommit[] = [
      makeCommit("aaa", "Alice", date1, [
        { path: "logo.png", additions: null, deletions: null },
      ]),
    ];

    const result = aggregateCommits(commits, new PathAliasMap());
    expect(result.fileStats.get("logo.png")?.commitCount).toBe(1);
    expect(result.fileStats.get("logo.png")?.linesChanged).toBe(0);
  });

  it("deduplicates paths within a commit for commitCount", () => {
    const commits: ParsedCommit[] = [
      makeCommit("aaa", "Alice", date1, [
        { path: "a.ts", additions: 1, deletions: 0 },
        { path: "a.ts", additions: 2, deletions: 0 },
      ]),
    ];

    const result = aggregateCommits(commits, new PathAliasMap());
    expect(result.fileStats.get("a.ts")?.commitCount).toBe(1);
    expect(result.fileStats.get("a.ts")?.linesChanged).toBe(3);
  });

  it("canonicalizes renamed paths during aggregation", () => {
    const aliasMap = new PathAliasMap();
    const accumulators = createAggregateAccumulators();

    aggregateOneCommit(
      makeCommit("aaa", "Alice", date1, [
        {
          path: "b.ts",
          additions: 1,
          deletions: 0,
          renameFrom: "a.ts",
        },
      ]),
      aliasMap,
      accumulators,
    );

    aggregateOneCommit(
      makeCommit("bbb", "Alice", date2, [
        { path: "b.ts", additions: 2, deletions: 0 },
      ]),
      aliasMap,
      accumulators,
    );

    expect(accumulators.fileStats.get("b.ts")?.commitCount).toBe(2);
  });

  it("aggregates stats for multi-file commits", () => {
    const commits: ParsedCommit[] = [
      makeCommit("aaa", "Alice", date1, [
        { path: "a.ts", additions: 1, deletions: 0 },
        { path: "b.ts", additions: 1, deletions: 0 },
        { path: "c.ts", additions: 1, deletions: 0 },
      ]),
    ];

    const result = aggregateCommits(commits, new PathAliasMap());

    expect(result.fileStats.size).toBe(3);
    expect(result.fileStats.get("a.ts")?.commitCount).toBe(1);
    expect(result.fileStats.get("b.ts")?.commitCount).toBe(1);
    expect(result.fileStats.get("c.ts")?.commitCount).toBe(1);
  });

  it("accumulates file stats across commits", () => {
    const commits: ParsedCommit[] = [
      makeCommit("aaa", "Alice", date1, [
        { path: "a.ts", additions: 1, deletions: 0 },
        { path: "b.ts", additions: 1, deletions: 0 },
      ]),
      makeCommit("bbb", "Bob", date2, [
        { path: "a.ts", additions: 1, deletions: 0 },
        { path: "b.ts", additions: 1, deletions: 0 },
      ]),
    ];

    const result = aggregateCommits(commits, new PathAliasMap());

    expect(result.fileStats.get("a.ts")?.commitCount).toBe(2);
    expect(result.fileStats.get("b.ts")?.commitCount).toBe(2);
  });
});

describe("large commits", () => {
  it("aggregates fileStats for commits with many files", () => {
    const commits: ParsedCommit[] = [
      makeCommit("mega", "Alice", date1, makeFiles(101)),
    ];

    const result = aggregateCommits(commits, new PathAliasMap());

    expect(result.fileStats.size).toBe(101);
    expect(result.fileStats.get("file-0.ts")?.commitCount).toBe(1);
    expect(result.fileStats.get("file-0.ts")?.linesChanged).toBe(1);
    expect(result.fileStats.get("file-0.ts")?.authors).toEqual(
      new Set(["Alice"]),
    );
  });
});

describe("aggregateOneCommit path scope", () => {
  it("filters out-of-scope paths from fileStats", () => {
    const outOfScope = makeFiles(150, "out");
    const inScope = makeFiles(3, "in");
    const commits: ParsedCommit[] = [
      makeCommit("scoped", "Alice", date1, [...outOfScope, ...inScope]),
    ];

    const result = aggregateCommits(commits, new PathAliasMap(), {
      isPathInScope: (path) => path.startsWith("in-"),
    });

    expect(result.fileStats.size).toBe(3);
    expect(result.fileStats.has("in-0.ts")).toBe(true);
    expect(result.fileStats.has("out-0.ts")).toBe(false);
  });

  it("aggregates in-scope fileStats even when commit has many out-of-scope files", () => {
    const outOfScope = makeFiles(200, "out");
    const inScope = makeFiles(101, "in");
    const commits: ParsedCommit[] = [
      makeCommit("scoped-mega", "Alice", date1, [...outOfScope, ...inScope]),
    ];

    const result = aggregateCommits(commits, new PathAliasMap(), {
      isPathInScope: (path) => path.startsWith("in-"),
    });

    expect(result.fileStats.size).toBe(101);
  });

  it("includes only in-scope files when one file is in scope", () => {
    const commits: ParsedCommit[] = [
      makeCommit("solo", "Alice", date1, [
        { path: "in/a.ts", additions: 1, deletions: 0 },
        { path: "out/b.ts", additions: 1, deletions: 0 },
      ]),
    ];

    const result = aggregateCommits(commits, new PathAliasMap(), {
      isPathInScope: (path) => path.startsWith("in/"),
    });

    expect(result.fileStats.size).toBe(1);
    expect(result.fileStats.has("in/a.ts")).toBe(true);
  });
});
