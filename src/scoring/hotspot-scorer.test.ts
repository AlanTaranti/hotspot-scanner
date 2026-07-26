import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ComplexityResult, FileChangeStats } from "../types/index.js";
import { scoreHotspots } from "./hotspot-scorer.js";

const fixtureDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures/scoring",
);

function buildFileStats(
  entries: Array<{
    filePath: string;
    commitCount: number;
    linesChanged?: number;
    authors?: string[];
  }>,
): Map<string, FileChangeStats> {
  const stats = new Map<string, FileChangeStats>();

  for (const entry of entries) {
    stats.set(entry.filePath, {
      filePath: entry.filePath,
      commitCount: entry.commitCount,
      linesChanged: entry.linesChanged ?? 0,
      authors: new Set(entry.authors ?? []),
      lastModified: new Date("2026-01-01T00:00:00.000Z"),
    });
  }

  return stats;
}

describe("scoreHotspots", () => {
  it("returns empty array for empty complexity input", () => {
    expect(scoreHotspots(new Map(), [])).toEqual([]);
  });

  it("treats missing fileStats as churn 0", () => {
    const complexity: ComplexityResult[] = [
      { filePath: "src/a.ts", ncloc: 10 },
      { filePath: "src/b.ts", ncloc: 5 },
    ];
    const fileStats = buildFileStats([
      { filePath: "src/a.ts", commitCount: 10 },
    ]);
    const results = scoreHotspots(fileStats, complexity);

    const missingChurn = results.find((entry) => entry.filePath === "src/b.ts");
    expect(missingChurn?.churnNormalized).toBe(0);
    expect(missingChurn?.hotspotScore).toBe(0);
    expect(missingChurn?.commitCount).toBe(0);
    expect(missingChurn?.linesChanged).toBe(0);
    expect(missingChurn?.authorCount).toBe(0);
  });

  it("populates all raw fields from complexity and fileStats", () => {
    const complexity: ComplexityResult[] = [
      { filePath: "src/a.ts", ncloc: 10 },
    ];
    const fileStats = buildFileStats([
      {
        filePath: "src/a.ts",
        commitCount: 20,
        linesChanged: 150,
        authors: ["alice", "bob", "carol"],
      },
    ]);
    const [result] = scoreHotspots(fileStats, complexity);

    expect(result).toMatchObject({
      ncloc: 10,
      commitCount: 20,
      linesChanged: 150,
      authorCount: 3,
    });
  });

  it("sets authorCount from authors Set size", () => {
    const complexity: ComplexityResult[] = [
      { filePath: "src/a.ts", ncloc: 5 },
    ];
    const fileStats = buildFileStats([
      {
        filePath: "src/a.ts",
        commitCount: 5,
        authors: ["dev1", "dev2"],
      },
    ]);
    const [result] = scoreHotspots(fileStats, complexity);

    expect(result?.authorCount).toBe(2);
  });

  it("never leaves raw fields undefined", () => {
    const complexity: ComplexityResult[] = [
      { filePath: "src/a.ts", ncloc: 10 },
      { filePath: "src/b.ts", ncloc: 5 },
    ];
    const fileStats = buildFileStats([
      { filePath: "src/a.ts", commitCount: 10 },
    ]);
    const results = scoreHotspots(fileStats, complexity);

    for (const entry of results) {
      expect(entry.ncloc).toBeDefined();
      expect(entry.commitCount).toBeDefined();
      expect(entry.linesChanged).toBeDefined();
      expect(entry.authorCount).toBeDefined();
    }
  });

  it("computes hotspotScore as harmonic mean of normalized values", () => {
    const complexity: ComplexityResult[] = [
      { filePath: "src/a.ts", ncloc: 10 },
      { filePath: "src/b.ts", ncloc: 5 },
    ];
    const fileStats = buildFileStats([
      { filePath: "src/a.ts", commitCount: 20 },
      { filePath: "src/b.ts", commitCount: 5 },
    ]);
    const results = scoreHotspots(fileStats, complexity);

    for (const entry of results) {
      const { complexityNormalized: c, churnNormalized: h } = entry;
      const expected = c + h === 0 ? 0 : (2 * c * h) / (c + h);
      expect(entry.hotspotScore).toBeCloseTo(expected);
    }
  });

  it("ranks balanced file above spiky file with controlled inputs", () => {
    const complexity: ComplexityResult[] = [
      { filePath: "src/balanced.ts", ncloc: 50 },
      { filePath: "src/spiky.ts", ncloc: 100 },
      { filePath: "src/spiky-anchor.ts", ncloc: 1 },
    ];
    const fileStats = buildFileStats([
      { filePath: "src/balanced.ts", commitCount: 50 },
      { filePath: "src/spiky.ts", commitCount: 1 },
      { filePath: "src/spiky-anchor.ts", commitCount: 100 },
    ]);
    const results = scoreHotspots(fileStats, complexity);

    const balanced = results.find(
      (entry) => entry.filePath === "src/balanced.ts",
    );
    const spiky = results.find((entry) => entry.filePath === "src/spiky.ts");

    expect(balanced).toBeDefined();
    expect(spiky).toBeDefined();
    expect(balanced!.complexityNormalized).toBeCloseTo(
      balanced!.churnNormalized,
      5,
    );
    expect(spiky!.hotspotScore).toBe(0);
    expect(balanced!.hotspotScore).toBeGreaterThan(spiky!.hotspotScore);
  });

  it("sorts by hotspotScore desc when scores differ", () => {
    const complexity: ComplexityResult[] = [
      { filePath: "src/low.ts", ncloc: 2 },
      { filePath: "src/high.ts", ncloc: 20 },
    ];
    const fileStats = buildFileStats([
      { filePath: "src/low.ts", commitCount: 2 },
      { filePath: "src/high.ts", commitCount: 20 },
    ]);
    const results = scoreHotspots(fileStats, complexity);

    expect(results[0]?.filePath).toBe("src/high.ts");
    expect(results[0]!.hotspotScore).toBeGreaterThan(results[1]!.hotspotScore);
  });

  it("sorts by hotspotScore desc then filePath asc", () => {
    const complexity: ComplexityResult[] = [
      { filePath: "src/b.ts", ncloc: 5 },
      { filePath: "src/a.ts", ncloc: 5 },
    ];
    const fileStats = buildFileStats([
      { filePath: "src/a.ts", commitCount: 10 },
      { filePath: "src/b.ts", commitCount: 10 },
    ]);
    const results = scoreHotspots(fileStats, complexity);

    expect(results[0]?.filePath).toBe("src/a.ts");
    expect(results[1]?.filePath).toBe("src/b.ts");
    expect(results[0]?.hotspotScore).toBe(results[1]?.hotspotScore);
  });

  it("returns zero score for single-file input (degenerate normalization)", () => {
    const complexity: ComplexityResult[] = [
      { filePath: "src/only.ts", ncloc: 15 },
    ];
    const fileStats = buildFileStats([
      { filePath: "src/only.ts", commitCount: 10 },
    ]);
    const [result] = scoreHotspots(fileStats, complexity);

    expect(result).toEqual({
      filePath: "src/only.ts",
      complexityNormalized: 0,
      churnNormalized: 0,
      hotspotScore: 0,
      ncloc: 15,
      commitCount: 10,
      linesChanged: 0,
      authorCount: 0,
    });
  });

  it("matches fixture expected ranking order", () => {
    const fixture = JSON.parse(
      readFileSync(join(fixtureDir, "hotspot-ranking.json"), "utf8"),
    ) as {
      fileStats: Array<{ filePath: string; commitCount: number }>;
      complexity: ComplexityResult[];
      expectedOrder: string[];
    };

    const results = scoreHotspots(
      buildFileStats(fixture.fileStats),
      fixture.complexity,
    );

    expect(results.map((entry) => entry.filePath)).toEqual(
      fixture.expectedOrder,
    );
  });
});
