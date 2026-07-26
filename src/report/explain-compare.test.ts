import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compareScanResults } from "../compare/compare.js";
import type { CompareResult, HotspotScore, ScanResult } from "../types/index.js";
import {
  findCompareExplainMatches,
  formatCompareExplain,
} from "./explain-compare.js";
import { parseExplainTarget } from "./explain.js";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures/report",
);

const BASE_META: ScanResult["meta"] = {
  since: "6 months ago",
  scannedAt: "2026-07-22T11:00:00.000Z",
  warnings: [],
};

function loadCompareResult(baselineName: string, currentName: string) {
  const baseline = JSON.parse(
    readFileSync(join(fixturesDir, baselineName), "utf8"),
  ) as ScanResult;
  const current = JSON.parse(
    readFileSync(join(fixturesDir, currentName), "utf8"),
  ) as ScanResult;
  return compareScanResults(baseline, current);
}

function makeHotspot(overrides: Partial<HotspotScore> = {}): HotspotScore {
  return {
    filePath: "src/hot.ts",
    complexityNormalized: 0.9,
    churnNormalized: 0.85,
    hotspotScore: 0.88,
    ncloc: 42,
    commitCount: 15,
    linesChanged: 320,
    authorCount: 3,
    ...overrides,
  };
}

function makeCompareResult(
  overrides: Partial<CompareResult> = {},
): CompareResult {
  const emptySection = { new: [], removed: [], rankChanged: [] };
  return {
    version: "3.0",
    hotspots: { ...emptySection },
    meta: {
      baseline: BASE_META,
      current: BASE_META,
      warnings: [],
    },
    ...overrides,
  };
}

describe("findCompareExplainMatches", () => {
  it("returns empty matches for a path absent from compare deltas", async () => {
    const repoPath = await mkdtemp(join(tmpdir(), "hotspot-explain-compare-"));
    try {
      const result = loadCompareResult(
        "compare-baseline-file.json",
        "compare-current-file.json",
      );
      const target = parseExplainTarget("src/missing.ts");

      expect(findCompareExplainMatches(result, target, repoPath)).toEqual([]);
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("classifies a new file hotspot", async () => {
    const repoPath = await mkdtemp(join(tmpdir(), "hotspot-explain-compare-"));
    try {
      const result = loadCompareResult(
        "compare-baseline-file.json",
        "compare-current-file.json",
      );
      const target = parseExplainTarget("src/new.ts");
      const matches = findCompareExplainMatches(result, target, repoPath);

      expect(matches).toHaveLength(1);
      expect(matches[0]).toMatchObject({
        classification: "new",
        entity: expect.objectContaining({ filePath: "src/new.ts", ncloc: 50 }),
      });
      expect(matches[0]?.baselineRank).toBeUndefined();
      expect(matches[0]?.currentRank).toBeUndefined();
      expect(matches[0]?.rankDelta).toBeUndefined();
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("classifies a removed file hotspot", async () => {
    const repoPath = await mkdtemp(join(tmpdir(), "hotspot-explain-compare-"));
    try {
      const result = loadCompareResult(
        "compare-baseline-file.json",
        "compare-current-file.json",
      );
      const target = parseExplainTarget("src/medium.ts");
      const matches = findCompareExplainMatches(result, target, repoPath);

      expect(matches).toHaveLength(1);
      expect(matches[0]).toMatchObject({
        classification: "removed",
        entity: expect.objectContaining({ filePath: "src/medium.ts" }),
      });
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("classifies a rank-changed file hotspot with rank fields", async () => {
    const repoPath = await mkdtemp(join(tmpdir(), "hotspot-explain-compare-"));
    try {
      const result = loadCompareResult(
        "compare-baseline-file.json",
        "compare-current-file.json",
      );
      const target = parseExplainTarget("src/hot.ts");
      const matches = findCompareExplainMatches(result, target, repoPath);

      expect(matches).toHaveLength(1);
      expect(matches[0]).toMatchObject({
        classification: "rank-changed",
        entity: expect.objectContaining({ filePath: "src/hot.ts" }),
        baselineRank: 1,
        currentRank: 2,
        rankDelta: 1,
      });
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("prefers new over removed and rank-changed for file hotspots", () => {
    const hotspot = makeHotspot({ filePath: "src/conflict.ts" });
    const result = makeCompareResult({
      hotspots: {
        new: [hotspot],
        removed: [hotspot],
        rankChanged: [
          {
            entity: hotspot,
            baselineRank: 1,
            currentRank: 3,
            rankDelta: 2,
          },
        ],
      },
    });

    const matches = findCompareExplainMatches(
      result,
      parseExplainTarget("src/conflict.ts"),
      "/tmp/repo",
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]?.classification).toBe("new");
  });

  it("normalizes ./ and absolute paths under the repo", async () => {
    const repoPath = await mkdtemp(join(tmpdir(), "hotspot-explain-compare-"));
    try {
      const result = loadCompareResult(
        "compare-baseline-file.json",
        "compare-current-file.json",
      );
      const absolute = join(repoPath, "src", "new.ts");

      expect(
        findCompareExplainMatches(
          result,
          parseExplainTarget("./src/new.ts"),
          repoPath,
        ),
      ).toHaveLength(1);
      expect(
        findCompareExplainMatches(
          result,
          parseExplainTarget(absolute),
          repoPath,
        ),
      ).toHaveLength(1);
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });
});

describe("formatCompareExplain", () => {
  it("returns an empty string when there are no matches", () => {
    expect(formatCompareExplain([])).toBe("");
  });

  it("formats new hotspot score fields with ncloc", () => {
    const output = formatCompareExplain([
      {
        classification: "new",
        entity: makeHotspot({ filePath: "src/new.ts" }),
      },
    ]);

    expect(output).toContain("=== Compare Explain: src/new.ts (new) ===");
    expect(output).toContain("classification: new");
    expect(output).toContain("filePath: src/new.ts");
    expect(output).toContain("ncloc: 42");
    expect(output).toContain("normalized size (c): 0.9000");
    expect(output).toContain(
      "churn: commitCount=15, linesChanged=320, authorCount=3",
    );
    expect(output).toContain("normalized churn (h): 0.8500");
    expect(output).toContain("hotspotScore: 0.8800");
    expect(output).toContain("hotspotScore = 2·c·h / (c+h)");
    expect(output).not.toContain("baselineRank:");
  });

  it("formats removed hotspot score fields", () => {
    const output = formatCompareExplain([
      {
        classification: "removed",
        entity: makeHotspot({ filePath: "src/removed.ts" }),
      },
    ]);

    expect(output).toContain("=== Compare Explain: src/removed.ts (removed) ===");
    expect(output).toContain("classification: removed");
    expect(output).not.toContain("baselineRank:");
  });

  it("formats rank-changed hotspot fields with rank delta", () => {
    const output = formatCompareExplain([
      {
        classification: "rank-changed",
        entity: makeHotspot({ filePath: "src/hot.ts" }),
        baselineRank: 1,
        currentRank: 6,
        rankDelta: 5,
      },
    ]);

    expect(output).toContain(
      "=== Compare Explain: src/hot.ts (rank-changed) ===",
    );
    expect(output).toContain("classification: rank-changed");
    expect(output).toContain("baselineRank: 1");
    expect(output).toContain("currentRank: 6");
    expect(output).toContain("rankDelta: 5");
    expect(output).toContain("hotspotScore: 0.8800");
  });
});
