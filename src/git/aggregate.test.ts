import { describe, expect, it } from "vitest";
import {
  aggregateCommits,
  aggregateOneCommit,
  createAggregateAccumulators,
  MEGA_COMMIT_UNIQUE_FILE_THRESHOLD,
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
  it("builds FileChangeStats and pairCounts from one pass", () => {
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

    expect(result.pairCounts.get("a.ts|b.ts")).toEqual({
      fileA: "a.ts",
      fileB: "b.ts",
      coChangeCount: 1,
    });
    expect(result.pairCounts.size).toBe(1);
    expect(result.megaCommitSkips).toEqual([]);

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
    expect(result.pairCounts.size).toBe(0);
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

  it("deduplicates paths within a commit for pair counts and commitCount", () => {
    const commits: ParsedCommit[] = [
      makeCommit("aaa", "Alice", date1, [
        { path: "a.ts", additions: 1, deletions: 0 },
        { path: "a.ts", additions: 2, deletions: 0 },
      ]),
    ];

    const result = aggregateCommits(commits, new PathAliasMap());
    expect(result.pairCounts.size).toBe(0);
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
    expect(accumulators.pairCounts.size).toBe(0);
  });

  it("increments all unordered pairs for multi-file commits", () => {
    const commits: ParsedCommit[] = [
      makeCommit("aaa", "Alice", date1, [
        { path: "a.ts", additions: 1, deletions: 0 },
        { path: "b.ts", additions: 1, deletions: 0 },
        { path: "c.ts", additions: 1, deletions: 0 },
      ]),
    ];

    const result = aggregateCommits(commits, new PathAliasMap());

    expect(result.pairCounts.size).toBe(3);
    expect(result.pairCounts.get("a.ts|b.ts")?.coChangeCount).toBe(1);
    expect(result.pairCounts.get("a.ts|c.ts")?.coChangeCount).toBe(1);
    expect(result.pairCounts.get("b.ts|c.ts")?.coChangeCount).toBe(1);
  });

  it("accumulates pair counts across commits", () => {
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

    expect(result.pairCounts.get("a.ts|b.ts")).toEqual({
      fileA: "a.ts",
      fileB: "b.ts",
      coChangeCount: 2,
    });
  });
});

describe("MEGA_COMMIT_UNIQUE_FILE_THRESHOLD", () => {
  it("exports threshold constant at 100", () => {
    expect(MEGA_COMMIT_UNIQUE_FILE_THRESHOLD).toBe(100);
  });

  it("aggregates pairs when unique in-scope file count equals threshold", () => {
    const commits: ParsedCommit[] = [
      makeCommit("mega-ok", "Alice", date1, makeFiles(100)),
    ];

    const result = aggregateCommits(commits, new PathAliasMap());

    expect(result.megaCommitSkips).toEqual([]);
    expect(result.pairCounts.size).toBe((100 * 99) / 2);
    expect(result.fileStats.size).toBe(100);
  });

  it("skips pair increments when unique in-scope file count exceeds threshold", () => {
    const commits: ParsedCommit[] = [
      makeCommit("mega-skip", "Alice", date1, makeFiles(101)),
    ];

    const result = aggregateCommits(commits, new PathAliasMap());

    expect(result.pairCounts.size).toBe(0);
    expect(result.megaCommitSkips).toEqual([
      { hash: "mega-skip", uniqueFileCount: 101 },
    ]);
  });

  it("still updates fileStats when mega-commit pairs are skipped", () => {
    const commits: ParsedCommit[] = [
      makeCommit("mega-skip", "Alice", date1, makeFiles(101)),
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

describe("megaCommitThreshold option", () => {
  const customThreshold = 50;

  it("aggregates pairs when unique in-scope file count equals custom threshold", () => {
    const commits: ParsedCommit[] = [
      makeCommit("mega-ok", "Alice", date1, makeFiles(customThreshold)),
    ];

    const result = aggregateCommits(commits, new PathAliasMap(), {
      megaCommitThreshold: customThreshold,
    });

    expect(result.megaCommitSkips).toEqual([]);
    expect(result.pairCounts.size).toBe((customThreshold * (customThreshold - 1)) / 2);
    expect(result.fileStats.size).toBe(customThreshold);
  });

  it("skips pair increments when unique in-scope file count exceeds custom threshold", () => {
    const commits: ParsedCommit[] = [
      makeCommit("mega-skip", "Alice", date1, makeFiles(customThreshold + 1)),
    ];

    const result = aggregateCommits(commits, new PathAliasMap(), {
      megaCommitThreshold: customThreshold,
    });

    expect(result.pairCounts.size).toBe(0);
    expect(result.megaCommitSkips).toEqual([
      { hash: "mega-skip", uniqueFileCount: customThreshold + 1 },
    ]);
  });

  it("still updates fileStats when custom threshold skips pairs", () => {
    const commits: ParsedCommit[] = [
      makeCommit("mega-skip", "Alice", date1, makeFiles(customThreshold + 1)),
    ];

    const result = aggregateCommits(commits, new PathAliasMap(), {
      megaCommitThreshold: customThreshold,
    });

    expect(result.fileStats.size).toBe(customThreshold + 1);
    expect(result.fileStats.get("file-0.ts")?.commitCount).toBe(1);
    expect(result.fileStats.get("file-0.ts")?.linesChanged).toBe(1);
    expect(result.fileStats.get("file-0.ts")?.authors).toEqual(
      new Set(["Alice"]),
    );
  });

  it("uses default threshold 100 when option omitted", () => {
    const commits: ParsedCommit[] = [
      makeCommit("default-threshold", "Alice", date1, makeFiles(100)),
    ];

    const result = aggregateCommits(commits, new PathAliasMap());

    expect(result.megaCommitSkips).toEqual([]);
    expect(result.pairCounts.size).toBe((100 * 99) / 2);
  });
});

describe("aggregateOneCommit path scope", () => {
  it("filters unique paths before mega-guard and pair increments", () => {
    const outOfScope = makeFiles(150, "out");
    const inScope = makeFiles(3, "in");
    const commits: ParsedCommit[] = [
      makeCommit("scoped", "Alice", date1, [...outOfScope, ...inScope]),
    ];

    const result = aggregateCommits(commits, new PathAliasMap(), {
      isPathInScope: (path) => path.startsWith("in-"),
    });

    expect(result.megaCommitSkips).toEqual([]);
    expect(result.pairCounts.size).toBe(3);
    expect(result.fileStats.size).toBe(3);
    expect(result.fileStats.has("in-0.ts")).toBe(true);
    expect(result.fileStats.has("out-0.ts")).toBe(false);
  });

  it("uses in-scope count for mega-guard so narrow scope avoids false skip", () => {
    const outOfScope = makeFiles(200, "out");
    const inScope = makeFiles(101, "in");
    const commits: ParsedCommit[] = [
      makeCommit("scoped-mega", "Alice", date1, [...outOfScope, ...inScope]),
    ];

    const result = aggregateCommits(commits, new PathAliasMap(), {
      isPathInScope: (path) => path.startsWith("in-"),
    });

    expect(result.pairCounts.size).toBe(0);
    expect(result.megaCommitSkips).toEqual([
      { hash: "scoped-mega", uniqueFileCount: 101 },
    ]);
    expect(result.fileStats.size).toBe(101);
  });

  it("adds no pair increments when fewer than 2 in-scope files", () => {
    const commits: ParsedCommit[] = [
      makeCommit("solo", "Alice", date1, [
        { path: "in/a.ts", additions: 1, deletions: 0 },
        { path: "out/b.ts", additions: 1, deletions: 0 },
      ]),
    ];

    const result = aggregateCommits(commits, new PathAliasMap(), {
      isPathInScope: (path) => path.startsWith("in/"),
    });

    expect(result.pairCounts.size).toBe(0);
    expect(result.fileStats.size).toBe(1);
  });
});
