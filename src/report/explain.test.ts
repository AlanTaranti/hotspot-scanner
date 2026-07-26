import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type {
  FunctionHotspotScore,
  HotspotScore,
  ScanResult,
} from "../types/index.js";
import {
  formatExplainBlock,
  normalizeExplainPath,
  parseExplainTarget,
} from "./explain.js";

const BASE_META: ScanResult["meta"] = {
  since: "6 months ago",
  scannedAt: "2026-07-22T11:00:00.000Z",
  granularity: "file",
  warnings: [],
};

function makeScanResult(
  overrides: Partial<Pick<ScanResult, "hotspots" | "functions" | "meta">> = {},
): ScanResult {
  return {
    version: "2.0",
    hotspots: [],
    functions: [],
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
    cyclomaticComplexity: 42,
    functionCount: 8,
    commitCount: 15,
    linesChanged: 320,
    authorCount: 3,
    ...overrides,
  };
}

function makeFunctionHotspot(
  overrides: Partial<FunctionHotspotScore> = {},
): FunctionHotspotScore {
  return {
    filePath: "src/hot.ts",
    functionName: "run",
    line: 10,
    complexity: 12,
    complexityNormalized: 0.8,
    churnNormalized: 0.7,
    hotspotScore: 0.75,
    commitCount: 5,
    linesChanged: 80,
    authorCount: 2,
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

  it("parses path:function using the last colon", () => {
    expect(parseExplainTarget("src/app.ts:handleClick")).toEqual({
      kind: "function",
      filePath: "src/app.ts",
      functionName: "handleClick",
    });
  });

  it("parses dotted function names after the last colon", () => {
    expect(parseExplainTarget("src/app.ts:Foo.bar")).toEqual({
      kind: "function",
      filePath: "src/app.ts",
      functionName: "Foo.bar",
    });
  });

  it("keeps exotic paths when the suffix is not a function name", () => {
    expect(parseExplainTarget("weird:path:handle-click")).toEqual({
      kind: "file",
      filePath: "weird:path:handle-click",
    });
  });

  it("treats invalid function suffixes as a full path", () => {
    expect(parseExplainTarget("src/app.ts:handle-click")).toEqual({
      kind: "file",
      filePath: "src/app.ts:handle-click",
    });
  });

  it("parses path with multiple colons when the suffix matches", () => {
    expect(parseExplainTarget("src/foo:bar:baz")).toEqual({
      kind: "function",
      filePath: "src/foo:bar",
      functionName: "baz",
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

describe("formatExplainBlock", () => {
  it("formats file-mode hotspot breakdown fields", () => {
    const result = makeScanResult({
      hotspots: [makeHotspot({ filePath: "src/hot.ts" })],
    });

    const output = formatExplainBlock(result, {
      kind: "file",
      filePath: "src/hot.ts",
    });

    expect(output).toContain("=== Explain: src/hot.ts (rank 1) ===");
    expect(output).toContain("filePath: src/hot.ts");
    expect(output).toContain(
      "complexity: cyclomaticComplexity=42, functionCount=8",
    );
    expect(output).toContain("normalized complexity (c): 0.9000");
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

    expect(output).toContain(`=== Explain: ${beyondTop.filePath} (rank 12) ===`);
  });

  it("formats function-mode single-target breakdown", () => {
    const result = makeScanResult({
      meta: { ...BASE_META, granularity: "function" },
      functions: [
        makeFunctionHotspot({
          filePath: "src/hot.ts",
          functionName: "run",
          line: 10,
        }),
      ],
    });

    const output = formatExplainBlock(result, {
      kind: "function",
      filePath: "src/hot.ts",
      functionName: "run",
    });

    expect(output).toContain(
      "=== Explain: src/hot.ts — run (rank 1, line 10) ===",
    );
    expect(output).toContain("functionName: run");
    expect(output).toContain("line: 10");
    expect(output).toContain("complexity: 12");
    expect(output).toContain("normalized complexity (c): 0.8000");
    expect(output).toContain(
      "churn: commitCount=5, linesChanged=80, authorCount=2",
    );
    expect(output).toContain("normalized churn (h): 0.7000");
    expect(output).toContain("hotspotScore: 0.7500");
  });

  it("lists all functions for a path-only target in rank order", () => {
    const result = makeScanResult({
      meta: { ...BASE_META, granularity: "function" },
      functions: [
        makeFunctionHotspot({
          filePath: "src/other.ts",
          functionName: "other",
          line: 1,
        }),
        makeFunctionHotspot({
          filePath: "src/hot.ts",
          functionName: "alpha",
          line: 5,
        }),
        makeFunctionHotspot({
          filePath: "src/hot.ts",
          functionName: "beta",
          line: 20,
        }),
      ],
    });

    const output = formatExplainBlock(result, {
      kind: "file",
      filePath: "src/hot.ts",
    });

    const alphaIndex = output.indexOf("functionName: alpha");
    const betaIndex = output.indexOf("functionName: beta");
    expect(alphaIndex).toBeGreaterThan(-1);
    expect(betaIndex).toBeGreaterThan(alphaIndex);
    expect(output).toContain("=== Explain: src/hot.ts — alpha (rank 2, line 5) ===");
    expect(output).toContain("=== Explain: src/hot.ts — beta (rank 3, line 20) ===");
    expect(output).not.toContain("functionName: other");
  });

  it("returns not-found for a missing function target", () => {
    const result = makeScanResult({
      meta: { ...BASE_META, granularity: "function" },
      functions: [makeFunctionHotspot({ functionName: "run" })],
    });

    expect(
      formatExplainBlock(result, {
        kind: "function",
        filePath: "src/hot.ts",
        functionName: "missing",
      }),
    ).toBe("explain: no function ranking for src/hot.ts:missing");
  });

  it("returns not-found for path-only function mode with no matches", () => {
    const result = makeScanResult({
      meta: { ...BASE_META, granularity: "function" },
      functions: [makeFunctionHotspot({ filePath: "src/other.ts" })],
    });

    expect(
      formatExplainBlock(result, {
        kind: "file",
        filePath: "src/hot.ts",
      }),
    ).toBe("explain: no function ranking for src/hot.ts");
  });

  it("prints all rows when multiple functions share a name", () => {
    const result = makeScanResult({
      meta: { ...BASE_META, granularity: "function" },
      functions: [
        makeFunctionHotspot({
          functionName: "overload",
          line: 10,
        }),
        makeFunctionHotspot({
          functionName: "overload",
          line: 40,
        }),
      ],
    });

    const output = formatExplainBlock(result, {
      kind: "function",
      filePath: "src/hot.ts",
      functionName: "overload",
    });

    expect(output).toContain("line: 10");
    expect(output).toContain("line: 40");
    expect(output.match(/functionName: overload/g)?.length).toBe(2);
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
