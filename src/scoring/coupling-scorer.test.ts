import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { CoChangePairCount, FileChangeStats } from "../types/index.js";
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

function buildPairCounts(
  entries: Array<{ fileA: string; fileB: string; coChangeCount: number }>,
): Map<string, CoChangePairCount> {
  const pairCounts = new Map<string, CoChangePairCount>();

  for (const entry of entries) {
    const [fileA, fileB] =
      entry.fileA < entry.fileB
        ? [entry.fileA, entry.fileB]
        : [entry.fileB, entry.fileA];
    pairCounts.set(`${fileA}|${fileB}`, {
      fileA,
      fileB,
      coChangeCount: entry.coChangeCount,
    });
  }

  return pairCounts;
}

describe("scoreCoupling", () => {
  it("returns empty array for empty pair counts", () => {
    expect(scoreCoupling(new Map(), new Map(), 3)).toEqual([]);
    expect(scoreCoupling([], new Map(), 3)).toEqual([]);
  });

  it("scores unordered pairs from pre-aggregated counts", () => {
    const pairCounts = buildPairCounts([
      { fileA: "src/a.ts", fileB: "src/b.ts", coChangeCount: 1 },
      { fileA: "src/a.ts", fileB: "src/c.ts", coChangeCount: 1 },
      { fileA: "src/b.ts", fileB: "src/c.ts", coChangeCount: 1 },
    ]);
    const fileStats = buildFileStats([
      { filePath: "src/a.ts", commitCount: 5 },
      { filePath: "src/b.ts", commitCount: 5 },
      { filePath: "src/c.ts", commitCount: 5 },
    ]);

    const results = scoreCoupling(pairCounts, fileStats, 1);
    expect(results).toHaveLength(3);
    expect(results.every((pair) => pair.coChangeCount === 1)).toBe(true);
  });

  it("scores a single pair count entry", () => {
    const pairCounts = buildPairCounts([
      { fileA: "src/a.ts", fileB: "src/b.ts", coChangeCount: 1 },
    ]);
    const fileStats = buildFileStats([
      { filePath: "src/a.ts", commitCount: 5 },
      { filePath: "src/b.ts", commitCount: 5 },
    ]);

    const results = scoreCoupling(pairCounts, fileStats, 1);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      fileA: "src/a.ts",
      fileB: "src/b.ts",
      coChangeCount: 1,
    });
  });

  it("excludes pairs below minCochange threshold", () => {
    const pairCounts = buildPairCounts([
      { fileA: "src/a.ts", fileB: "src/b.ts", coChangeCount: 2 },
    ]);
    const fileStats = buildFileStats([
      { filePath: "src/a.ts", commitCount: 5 },
      { filePath: "src/b.ts", commitCount: 5 },
    ]);

    expect(scoreCoupling(pairCounts, fileStats, 3)).toHaveLength(0);
    expect(scoreCoupling(pairCounts, fileStats, 2)).toHaveLength(1);
  });

  it("excludes pairs with zero-commit denominator", () => {
    const pairCounts = buildPairCounts([
      { fileA: "src/a.ts", fileB: "src/orphan.ts", coChangeCount: 3 },
    ]);
    const fileStats = buildFileStats([
      { filePath: "src/a.ts", commitCount: 5 },
      { filePath: "src/orphan.ts", commitCount: 0 },
    ]);

    expect(scoreCoupling(pairCounts, fileStats, 1)).toEqual([]);
  });

  it("computes couplingStrength as coChangeCount / min(commitsA, commitsB)", () => {
    const pairCounts = buildPairCounts([
      { fileA: "src/a.ts", fileB: "src/b.ts", coChangeCount: 3 },
    ]);
    const fileStats = buildFileStats([
      { filePath: "src/a.ts", commitCount: 10 },
      { filePath: "src/b.ts", commitCount: 5 },
    ]);

    const [result] = scoreCoupling(pairCounts, fileStats, 3);
    expect(result?.couplingStrength).toBeCloseTo(3 / 5);
  });

  it("sorts by couplingStrength desc then fileA asc", () => {
    const pairCounts = buildPairCounts([
      { fileA: "src/b.ts", fileB: "src/c.ts", coChangeCount: 3 },
      { fileA: "src/a.ts", fileB: "src/d.ts", coChangeCount: 3 },
    ]);
    const fileStats = buildFileStats([
      { filePath: "src/a.ts", commitCount: 6 },
      { filePath: "src/b.ts", commitCount: 6 },
      { filePath: "src/c.ts", commitCount: 3 },
      { filePath: "src/d.ts", commitCount: 3 },
    ]);

    const results = scoreCoupling(pairCounts, fileStats, 3);
    expect(results[0]?.fileA).toBe("src/a.ts");
    expect(results[1]?.fileA).toBe("src/b.ts");
    expect(results[0]?.couplingStrength).toBe(results[1]?.couplingStrength);
  });

  it("matches fixture expected ranking order with DEFAULT_MIN_COCHANGE", () => {
    const fixture = JSON.parse(
      readFileSync(join(fixtureDir, "coupling-pairs.json"), "utf8"),
    ) as {
      fileStats: Array<{ filePath: string; commitCount: number }>;
      pairCounts: Array<{
        fileA: string;
        fileB: string;
        coChangeCount: number;
      }>;
      expectedOrder: Array<{ fileA: string; fileB: string }>;
    };

    const results = scoreCoupling(
      buildPairCounts(fixture.pairCounts),
      buildFileStats(fixture.fileStats),
      DEFAULT_MIN_COCHANGE,
    );

    expect(
      results.map((pair) => ({ fileA: pair.fileA, fileB: pair.fileB })),
    ).toEqual(fixture.expectedOrder);
  });

  it("boundary: count 2 excluded, count 3 included when minCochange=3", () => {
    const pairCounts = buildPairCounts([
      { fileA: "src/a.ts", fileB: "src/b.ts", coChangeCount: 2 },
      { fileA: "src/c.ts", fileB: "src/d.ts", coChangeCount: 3 },
    ]);
    const fileStats = buildFileStats([
      { filePath: "src/a.ts", commitCount: 5 },
      { filePath: "src/b.ts", commitCount: 5 },
      { filePath: "src/c.ts", commitCount: 5 },
      { filePath: "src/d.ts", commitCount: 5 },
    ]);

    const results = scoreCoupling(pairCounts, fileStats, 3);
    expect(results).toHaveLength(1);
    expect(results[0]?.fileA).toBe("src/c.ts");
    expect(results[0]?.coChangeCount).toBe(3);
  });

  it("accepts iterable pair counts without a Map", () => {
    const pairCounts: CoChangePairCount[] = [
      { fileA: "src/a.ts", fileB: "src/b.ts", coChangeCount: 3 },
    ];
    const fileStats = buildFileStats([
      { filePath: "src/a.ts", commitCount: 10 },
      { filePath: "src/b.ts", commitCount: 5 },
    ]);

    const results = scoreCoupling(pairCounts, fileStats, 3);
    expect(results).toHaveLength(1);
    expect(results[0]?.couplingStrength).toBeCloseTo(3 / 5);
  });
});
