import { describe, expect, it, vi } from "vitest";
import type { ComplexityResult, FileChangeStats } from "../types/index.js";
import { createHotspotScorer } from "./index.js";

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
  it("createHotspotScorer scores hotspots without throwing", () => {
    const complexity: ComplexityResult[] = [
      { filePath: "src/a.ts", ncloc: 10 },
      { filePath: "src/b.ts", ncloc: 5 },
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

  it("allows dependency injection for scoreHotspots", () => {
    const mockScore = vi.fn(() => []);
    const scorer = createHotspotScorer({ scoreHotspots: mockScore });

    const fileStats = buildFileStats([]);
    const complexity: ComplexityResult[] = [];

    scorer.score(fileStats, complexity);

    expect(mockScore).toHaveBeenCalledWith(fileStats, complexity);
  });
});
