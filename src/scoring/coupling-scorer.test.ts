import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { CoChangeEvent, FileChangeStats } from "../types/index.js";
import { DEFAULT_MIN_COCHANGE } from "./index.js";
import { scoreCoupling } from "./coupling-scorer.js";

const fixtureDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures/scoring",
);

function buildFileStats(
  entries: Array<{ filePath: string; commitCount: number }>,
): Map<string, FileChangeStats> {
  const stats = new Map<string, FileChangeStats>();

  for (const entry of entries) {
    stats.set(entry.filePath, {
      filePath: entry.filePath,
      commitCount: entry.commitCount,
      linesChanged: 0,
      authors: new Set(),
      lastModified: new Date("2026-01-01T00:00:00.000Z"),
    });
  }

  return stats;
}

describe("scoreCoupling", () => {
  it("returns empty array for empty events", () => {
    expect(scoreCoupling([], new Map(), 3)).toEqual([]);
  });

  it("increments unordered pairs for N files in one commit", () => {
    const events: CoChangeEvent[] = [
      {
        commitHash: "c1",
        filesChanged: ["src/a.ts", "src/b.ts", "src/c.ts"],
      },
    ];
    const fileStats = buildFileStats([
      { filePath: "src/a.ts", commitCount: 5 },
      { filePath: "src/b.ts", commitCount: 5 },
      { filePath: "src/c.ts", commitCount: 5 },
    ]);

    const results = scoreCoupling(events, fileStats, 1);
    expect(results).toHaveLength(3);
    expect(results.every((pair) => pair.coChangeCount === 1)).toBe(true);
  });

  it("deduplicates paths within the same commit before pairing", () => {
    const events: CoChangeEvent[] = [
      {
        commitHash: "c1",
        filesChanged: ["src/a.ts", "src/b.ts", "src/a.ts"],
      },
    ];
    const fileStats = buildFileStats([
      { filePath: "src/a.ts", commitCount: 5 },
      { filePath: "src/b.ts", commitCount: 5 },
    ]);

    const results = scoreCoupling(events, fileStats, 1);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      fileA: "src/a.ts",
      fileB: "src/b.ts",
      coChangeCount: 1,
    });
  });

  it("excludes pairs below minCochange threshold", () => {
    const events: CoChangeEvent[] = [
      { commitHash: "c1", filesChanged: ["src/a.ts", "src/b.ts"] },
      { commitHash: "c2", filesChanged: ["src/a.ts", "src/b.ts"] },
    ];
    const fileStats = buildFileStats([
      { filePath: "src/a.ts", commitCount: 5 },
      { filePath: "src/b.ts", commitCount: 5 },
    ]);

    expect(scoreCoupling(events, fileStats, 3)).toHaveLength(0);
    expect(scoreCoupling(events, fileStats, 2)).toHaveLength(1);
  });

  it("excludes pairs with zero-commit denominator", () => {
    const events: CoChangeEvent[] = [
      { commitHash: "c1", filesChanged: ["src/a.ts", "src/orphan.ts"] },
      { commitHash: "c2", filesChanged: ["src/a.ts", "src/orphan.ts"] },
      { commitHash: "c3", filesChanged: ["src/a.ts", "src/orphan.ts"] },
    ];
    const fileStats = buildFileStats([
      { filePath: "src/a.ts", commitCount: 5 },
      { filePath: "src/orphan.ts", commitCount: 0 },
    ]);

    expect(scoreCoupling(events, fileStats, 1)).toEqual([]);
  });

  it("computes couplingStrength as coChangeCount / min(commitsA, commitsB)", () => {
    const events: CoChangeEvent[] = [
      { commitHash: "c1", filesChanged: ["src/a.ts", "src/b.ts"] },
      { commitHash: "c2", filesChanged: ["src/a.ts", "src/b.ts"] },
      { commitHash: "c3", filesChanged: ["src/a.ts", "src/b.ts"] },
    ];
    const fileStats = buildFileStats([
      { filePath: "src/a.ts", commitCount: 10 },
      { filePath: "src/b.ts", commitCount: 5 },
    ]);

    const [result] = scoreCoupling(events, fileStats, 3);
    expect(result?.couplingStrength).toBeCloseTo(3 / 5);
  });

  it("sorts by couplingStrength desc then fileA asc", () => {
    const events: CoChangeEvent[] = [
      { commitHash: "c1", filesChanged: ["src/b.ts", "src/c.ts"] },
      { commitHash: "c2", filesChanged: ["src/b.ts", "src/c.ts"] },
      { commitHash: "c3", filesChanged: ["src/b.ts", "src/c.ts"] },
      { commitHash: "c4", filesChanged: ["src/a.ts", "src/d.ts"] },
      { commitHash: "c5", filesChanged: ["src/a.ts", "src/d.ts"] },
      { commitHash: "c6", filesChanged: ["src/a.ts", "src/d.ts"] },
    ];
    const fileStats = buildFileStats([
      { filePath: "src/a.ts", commitCount: 6 },
      { filePath: "src/b.ts", commitCount: 6 },
      { filePath: "src/c.ts", commitCount: 3 },
      { filePath: "src/d.ts", commitCount: 3 },
    ]);

    const results = scoreCoupling(events, fileStats, 3);
    expect(results[0]?.fileA).toBe("src/a.ts");
    expect(results[1]?.fileA).toBe("src/b.ts");
    expect(results[0]?.couplingStrength).toBe(results[1]?.couplingStrength);
  });

  it("matches fixture expected ranking order with DEFAULT_MIN_COCHANGE", () => {
    const fixture = JSON.parse(
      readFileSync(join(fixtureDir, "coupling-pairs.json"), "utf8"),
    ) as {
      fileStats: Array<{ filePath: string; commitCount: number }>;
      coChangeEvents: CoChangeEvent[];
      expectedOrder: Array<{ fileA: string; fileB: string }>;
    };

    const results = scoreCoupling(
      fixture.coChangeEvents,
      buildFileStats(fixture.fileStats),
      DEFAULT_MIN_COCHANGE,
    );

    expect(
      results.map((pair) => ({ fileA: pair.fileA, fileB: pair.fileB })),
    ).toEqual(fixture.expectedOrder);
  });

  it("boundary: count 2 excluded, count 3 included when minCochange=3", () => {
    const events: CoChangeEvent[] = [
      { commitHash: "c1", filesChanged: ["src/a.ts", "src/b.ts"] },
      { commitHash: "c2", filesChanged: ["src/a.ts", "src/b.ts"] },
      { commitHash: "c3", filesChanged: ["src/c.ts", "src/d.ts"] },
      { commitHash: "c4", filesChanged: ["src/c.ts", "src/d.ts"] },
      { commitHash: "c5", filesChanged: ["src/c.ts", "src/d.ts"] },
    ];
    const fileStats = buildFileStats([
      { filePath: "src/a.ts", commitCount: 5 },
      { filePath: "src/b.ts", commitCount: 5 },
      { filePath: "src/c.ts", commitCount: 5 },
      { filePath: "src/d.ts", commitCount: 5 },
    ]);

    const results = scoreCoupling(events, fileStats, 3);
    expect(results).toHaveLength(1);
    expect(results[0]?.fileA).toBe("src/c.ts");
    expect(results[0]?.coChangeCount).toBe(3);
  });
});
