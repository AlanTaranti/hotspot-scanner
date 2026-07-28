import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { HotspotScore, ScanResult } from "../types/index.js";
import {
  CliUsageError,
  explainTargetFound,
  formatExplainBlock,
  formatTrendNextStep,
  normalizeExplainPath,
  parseExplainTarget,
} from "./explain.js";

const BASE_META: ScanResult["meta"] = {
  since: "6 months ago",
  scannedAt: "2026-07-22T11:00:00.000Z",
  warnings: [],
};

function makeScanResult(
  overrides: Partial<Pick<ScanResult, "hotspots" | "meta">> = {},
): ScanResult {
  return {
    version: "3.0",
    hotspots: [],
    meta: BASE_META,
    ...overrides,
  };
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

describe("parseExplainTarget", () => {
  it("parses a plain file path", () => {
    expect(parseExplainTarget("src/app.ts")).toEqual({
      kind: "file",
      filePath: "src/app.ts",
    });
  });

  it("rejects path:function with CliUsageError", () => {
    expect(() => parseExplainTarget("src/app.ts:handleClick")).toThrow(
      CliUsageError,
    );
    expect(() => parseExplainTarget("src/app.ts:handleClick")).toThrow(
      /--explain does not support path:function/,
    );
  });

  it("rejects dotted function names after the last colon", () => {
    expect(() => parseExplainTarget("src/app.ts:Foo.bar")).toThrow(
      CliUsageError,
    );
  });

  it("keeps exotic paths when the suffix is not a function name", () => {
    expect(parseExplainTarget("weird:path:handle-click")).toEqual({
      kind: "file",
      filePath: "weird:path:handle-click",
    });
  });

  it("keeps paths with invalid function suffixes as full paths", () => {
    expect(parseExplainTarget("src/app.ts:handle-click")).toEqual({
      kind: "file",
      filePath: "src/app.ts:handle-click",
    });
  });
});

describe("normalizeExplainPath", () => {
  it("strips leading ./ and normalizes separators", async () => {
    const repoPath = await mkdtemp(join(tmpdir(), "hotspot-explain-"));
    try {
      expect(normalizeExplainPath("./src/app.ts", repoPath)).toBe("src/app.ts");
      expect(normalizeExplainPath("src\\app.ts", repoPath)).toBe("src/app.ts");
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("converts absolute paths under the repo to repo-relative keys", async () => {
    const repoPath = await mkdtemp(join(tmpdir(), "hotspot-explain-"));
    try {
      const absolute = join(repoPath, "src", "app.ts");
      expect(normalizeExplainPath(absolute, repoPath)).toBe("src/app.ts");
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });
});

describe("explainTargetFound", () => {
  it("returns true when the target matches a hotspot", () => {
    const result = makeScanResult({
      hotspots: [makeHotspot({ filePath: "src/hot.ts" })],
    });

    expect(
      explainTargetFound(result, { kind: "file", filePath: "src/hot.ts" }),
    ).toBe(true);
  });

  it("returns false when the target is absent from rankings", () => {
    const result = makeScanResult({
      hotspots: [makeHotspot({ filePath: "src/other.ts" })],
    });

    expect(
      explainTargetFound(result, { kind: "file", filePath: "src/missing.ts" }),
    ).toBe(false);
  });
});

describe("formatTrendNextStep", () => {
  it("returns the stable next-step prefix with a posix path", () => {
    expect(formatTrendNextStep("src/hot.ts")).toBe(
      "next: hotspot-scanner trend src/hot.ts",
    );
  });

  it("strips leading ./ and normalizes separators", () => {
    expect(formatTrendNextStep("./src/hot.ts")).toBe(
      "next: hotspot-scanner trend src/hot.ts",
    );
    expect(formatTrendNextStep("src\\hot.ts")).toBe(
      "next: hotspot-scanner trend src/hot.ts",
    );
  });
});

describe("formatExplainBlock", () => {
  it("formats file hotspot breakdown fields with ncloc", () => {
    const result = makeScanResult({
      hotspots: [makeHotspot({ filePath: "src/hot.ts" })],
    });

    const output = formatExplainBlock(result, {
      kind: "file",
      filePath: "src/hot.ts",
    });

    expect(output).toContain("=== Explain: src/hot.ts (rank 1) ===");
    expect(output).toContain("filePath: src/hot.ts");
    expect(output).toContain("ncloc: 42");
    expect(output).toContain("normalized size (c): 0.9000");
    expect(output).toContain(
      "churn: commitCount=15, linesChanged=320, authorCount=3",
    );
    expect(output).toContain("normalized churn (h): 0.8500");
    expect(output).toContain("hotspotScore: 0.8800");
    expect(output).toContain("hotspotScore = 2·c·h / (c+h)");
  });

  it("returns a clear not-found message for missing file hotspots", () => {
    const result = makeScanResult({
      hotspots: [makeHotspot({ filePath: "src/other.ts" })],
    });

    expect(
      formatExplainBlock(result, {
        kind: "file",
        filePath: "src/missing.ts",
      }),
    ).toBe("explain: no hotspot ranking for src/missing.ts");
  });

  it("finds hotspots beyond a simulated --top slice using full arrays", () => {
    const hotspots = Array.from({ length: 15 }, (_, index) =>
      makeHotspot({
        filePath: `src/file-${index + 1}.ts`,
        hotspotScore: 1 - index * 0.01,
      }),
    );
    const result = makeScanResult({ hotspots });
    const beyondTop = hotspots[11]!;

    const output = formatExplainBlock(result, {
      kind: "file",
      filePath: beyondTop.filePath,
    });

    expect(output).toContain(
      `=== Explain: ${beyondTop.filePath} (rank 12) ===`,
    );
  });

  it("matches ./ prefixed paths against repo-relative rankings", () => {
    const result = makeScanResult({
      hotspots: [makeHotspot({ filePath: "src/hot.ts" })],
    });

    const output = formatExplainBlock(result, {
      kind: "file",
      filePath: "./src/hot.ts",
    });

    expect(output).toContain("=== Explain: src/hot.ts (rank 1) ===");
  });
});
