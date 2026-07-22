import { describe, expect, it, vi } from "vitest";
import type { ComplexityResult, FileChangeStats } from "../types/index.js";
import {
  createHotspotScorer,
  createTemporalCouplingScorer,
  DEFAULT_MIN_COCHANGE,
} from "./index.js";

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

describe("scoring factories", () => {
  it("exports DEFAULT_MIN_COCHANGE as 3", () => {
    expect(DEFAULT_MIN_COCHANGE).toBe(3);
  });

  it("createHotspotScorer scores hotspots without throwing", () => {
    const complexity: ComplexityResult[] = [
      { filePath: "src/a.ts", cyclomaticComplexity: 10, functionCount: 1 },
      { filePath: "src/b.ts", cyclomaticComplexity: 5, functionCount: 1 },
    ];
    const fileStats = buildFileStats([
      { filePath: "src/a.ts", commitCount: 20 },
      { filePath: "src/b.ts", commitCount: 5 },
    ]);

    const results = createHotspotScorer().score(fileStats, complexity);

    expect(results).toHaveLength(2);
    expect(results[0]?.hotspotScore).toBeGreaterThanOrEqual(
      results[1]?.hotspotScore ?? 0,
    );
  });

  it("createTemporalCouplingScorer scores coupling pairs without throwing", () => {
    const fileStats = buildFileStats([
      { filePath: "src/a.ts", commitCount: 10 },
      { filePath: "src/b.ts", commitCount: 5 },
    ]);
    const events = [
      { commitHash: "c1", filesChanged: ["src/a.ts", "src/b.ts"] },
      { commitHash: "c2", filesChanged: ["src/a.ts", "src/b.ts"] },
      { commitHash: "c3", filesChanged: ["src/a.ts", "src/b.ts"] },
    ];

    const results = createTemporalCouplingScorer().score(
      events,
      fileStats,
      DEFAULT_MIN_COCHANGE,
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.couplingStrength).toBeCloseTo(3 / 5);
  });

  it("allows dependency injection for scoreHotspots", () => {
    const mockScore = vi.fn(() => []);
    const scorer = createHotspotScorer({ scoreHotspots: mockScore });

    const fileStats = buildFileStats([]);
    const complexity: ComplexityResult[] = [];

    scorer.score(fileStats, complexity);

    expect(mockScore).toHaveBeenCalledWith(fileStats, complexity);
  });

  it("allows dependency injection for scoreCoupling", () => {
    const mockScore = vi.fn(() => []);
    const scorer = createTemporalCouplingScorer({ scoreCoupling: mockScore });

    const fileStats = buildFileStats([]);
    scorer.score([], fileStats, 3);

    expect(mockScore).toHaveBeenCalledWith([], fileStats, 3);
  });
});
