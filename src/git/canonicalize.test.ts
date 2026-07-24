import { describe, expect, it } from "vitest";
import type { CoChangePairCount, FileChangeStats } from "../types/index.js";
import {
  canonicalizeFileStats,
  canonicalizePairCounts,
} from "./canonicalize.js";
import { PathAliasMap } from "./rename.js";

function makeStats(
  filePath: string,
  overrides: Partial<FileChangeStats> = {},
): FileChangeStats {
  return {
    filePath,
    commitCount: 1,
    linesChanged: 10,
    authors: new Set(["Alice"]),
    lastModified: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
  };
}

function makePairCounts(
  entries: CoChangePairCount[],
): Map<string, CoChangePairCount> {
  const pairCounts = new Map<string, CoChangePairCount>();
  for (const entry of entries) {
    const [fileA, fileB] =
      entry.fileA < entry.fileB
        ? [entry.fileA, entry.fileB]
        : [entry.fileB, entry.fileA];
    pairCounts.set(`${fileA}|${fileB}`, { fileA, fileB, coChangeCount: entry.coChangeCount });
  }
  return pairCounts;
}

describe("canonicalizeFileStats", () => {
  it("merges stats for paths that resolve to the same canonical path", () => {
    const aliasMap = new PathAliasMap();
    aliasMap.link("old.ts", "new.ts");

    const fileStats = new Map<string, FileChangeStats>([
      ["old.ts", makeStats("old.ts", { commitCount: 2, linesChanged: 5 })],
      [
        "new.ts",
        makeStats("new.ts", {
          commitCount: 3,
          linesChanged: 7,
          authors: new Set(["Bob"]),
          lastModified: new Date("2024-06-01T00:00:00Z"),
        }),
      ],
    ]);

    const result = canonicalizeFileStats(fileStats, aliasMap);
    const merged = result.get("new.ts");

    expect(result.size).toBe(1);
    expect(merged?.commitCount).toBe(5);
    expect(merged?.linesChanged).toBe(12);
    expect(merged?.authors).toEqual(new Set(["Alice", "Bob"]));
    expect(merged?.lastModified).toEqual(new Date("2024-06-01T00:00:00Z"));
  });

  it("keeps the later lastModified when merging", () => {
    const aliasMap = new PathAliasMap();
    aliasMap.link("a.ts", "b.ts");

    const fileStats = new Map<string, FileChangeStats>([
      [
        "a.ts",
        makeStats("a.ts", {
          lastModified: new Date("2024-12-01T00:00:00Z"),
        }),
      ],
      [
        "b.ts",
        makeStats("b.ts", {
          lastModified: new Date("2024-01-01T00:00:00Z"),
        }),
      ],
    ]);

    const merged = canonicalizeFileStats(fileStats, aliasMap).get("b.ts");
    expect(merged?.lastModified).toEqual(new Date("2024-12-01T00:00:00Z"));
  });
});

describe("canonicalizePairCounts", () => {
  it("remaps both endpoints through the final alias map", () => {
    const aliasMap = new PathAliasMap();
    aliasMap.link("old.ts", "new.ts");

    const result = canonicalizePairCounts(
      makePairCounts([
        { fileA: "old.ts", fileB: "other.ts", coChangeCount: 2 },
      ]),
      aliasMap,
    );

    expect(result.size).toBe(1);
    expect(result.get("new.ts|other.ts")).toEqual({
      fileA: "new.ts",
      fileB: "other.ts",
      coChangeCount: 2,
    });
  });

  it("merges counts when pre-canonical pair keys collapse", () => {
    const aliasMap = new PathAliasMap();
    aliasMap.link("old.ts", "new.ts");

    const result = canonicalizePairCounts(
      makePairCounts([
        { fileA: "old.ts", fileB: "other.ts", coChangeCount: 2 },
        { fileA: "new.ts", fileB: "other.ts", coChangeCount: 3 },
      ]),
      aliasMap,
    );

    expect(result.size).toBe(1);
    expect(result.get("new.ts|other.ts")?.coChangeCount).toBe(5);
  });

  it("drops degenerate pairs when both endpoints remap to the same path", () => {
    const aliasMap = new PathAliasMap();
    aliasMap.link("old.ts", "new.ts");

    const result = canonicalizePairCounts(
      makePairCounts([
        { fileA: "old.ts", fileB: "new.ts", coChangeCount: 4 },
        { fileA: "other.ts", fileB: "third.ts", coChangeCount: 1 },
      ]),
      aliasMap,
    );

    expect(result.size).toBe(1);
    expect(result.get("other.ts|third.ts")).toEqual({
      fileA: "other.ts",
      fileB: "third.ts",
      coChangeCount: 1,
    });
  });

  it("merges pairs across a rename chain under the final canonical path", () => {
    const aliasMap = new PathAliasMap();
    aliasMap.link("a.ts", "b.ts");
    aliasMap.link("b.ts", "c.ts");

    const result = canonicalizePairCounts(
      makePairCounts([
        { fileA: "a.ts", fileB: "shared.ts", coChangeCount: 1 },
        { fileA: "b.ts", fileB: "shared.ts", coChangeCount: 2 },
        { fileA: "c.ts", fileB: "shared.ts", coChangeCount: 3 },
      ]),
      aliasMap,
    );

    expect(result.size).toBe(1);
    expect(result.get("c.ts|shared.ts")).toEqual({
      fileA: "c.ts",
      fileB: "shared.ts",
      coChangeCount: 6,
    });
  });

  it("orders endpoints lexicographically in the result", () => {
    const aliasMap = new PathAliasMap();

    const result = canonicalizePairCounts(
      makePairCounts([
        { fileA: "z.ts", fileB: "a.ts", coChangeCount: 1 },
      ]),
      aliasMap,
    );

    expect(result.get("a.ts|z.ts")).toEqual({
      fileA: "a.ts",
      fileB: "z.ts",
      coChangeCount: 1,
    });
  });
});
