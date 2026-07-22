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

describe("aggregateCommits", () => {
  it("builds FileChangeStats and CoChangeEvent from one pass", () => {
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

    expect(result.coChangeEvents).toEqual([
      { commitHash: "aaa", filesChanged: ["a.ts", "b.ts"] },
      { commitHash: "bbb", filesChanged: ["a.ts"] },
    ]);

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
    expect(result.coChangeEvents).toHaveLength(1);
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

  it("deduplicates paths within a commit for co-change and commitCount", () => {
    const commits: ParsedCommit[] = [
      makeCommit("aaa", "Alice", date1, [
        { path: "a.ts", additions: 1, deletions: 0 },
        { path: "a.ts", additions: 2, deletions: 0 },
      ]),
    ];

    const result = aggregateCommits(commits, new PathAliasMap());
    expect(result.coChangeEvents[0]!.filesChanged).toEqual(["a.ts"]);
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
    expect(accumulators.coChangeEvents).toHaveLength(2);
  });
});
