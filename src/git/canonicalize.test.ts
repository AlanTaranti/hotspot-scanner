import { describe, expect, it } from "vitest";
import type { CoChangeEvent, FileChangeStats } from "../types/index.js";
import {
  canonicalizeCoChangeEvents,
  canonicalizeFileStats,
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

describe("canonicalizeCoChangeEvents", () => {
  it("deduplicates and sorts canonical paths per commit", () => {
    const aliasMap = new PathAliasMap();
    aliasMap.link("old.ts", "new.ts");

    const events: CoChangeEvent[] = [
      {
        commitHash: "abc",
        filesChanged: ["old.ts", "new.ts", "other.ts"],
      },
    ];

    expect(canonicalizeCoChangeEvents(events, aliasMap)).toEqual([
      { commitHash: "abc", filesChanged: ["new.ts", "other.ts"] },
    ]);
  });
});
