import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ScanResult } from "../types/index.js";
import { renderMarkdown } from "./markdown.js";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures/report/sample-result.json",
);
const functionFixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures/report/sample-result-functions.json",
);

function loadFixture(): ScanResult {
  return JSON.parse(readFileSync(fixturePath, "utf8")) as ScanResult;
}

function loadFunctionFixture(): ScanResult {
  return JSON.parse(readFileSync(functionFixturePath, "utf8")) as ScanResult;
}

describe("renderMarkdown", () => {
  it("renders title, metadata, and section headings", () => {
    const output = renderMarkdown(loadFixture());

    expect(output).toContain("# Hotspot Scanner Report");
    expect(output).toContain("**Scan window:** 6 months ago");
    expect(output).toContain("**Scanned at:** 2026-07-22T11:00:00.000Z");
    expect(output).toContain("## Top Hotspots");
    expect(output).toContain("## Top Coupling Pairs");
  });

  it("renders hotspot table with all columns including Lines", () => {
    const output = renderMarkdown(loadFixture());

    expect(output).toContain(
      "| Rank | File | Score | Cpx | CpxN | Churn | ChurnN | Funcs | Authors | Lines |",
    );
    expect(output).toContain(
      "| 1 | src/hot.ts | 0.8500 | 42 | 0.9000 | 15 | 0.9444 | 8 | 3 | 320 |",
    );
  });

  it("renders coupling table with formatted values", () => {
    const output = renderMarkdown(loadFixture());

    expect(output).toContain(
      "| Rank | File A | File B | Strength | Co-changes | Has static |",
    );
    expect(output).toContain(
      "| 1 | src/a.ts | src/b.ts | 0.7500 | 5 | yes |",
    );
    expect(output).toContain(
      "| 2 | src/c.ts | src/d.ts | 0.5000 | 3 | no |",
    );
  });

  it("escapes pipe characters in file paths", () => {
    const output = renderMarkdown({
      version: "1.0",
      hotspots: [
        {
          filePath: "src/a|b.ts",
          hotspotScore: 0.5,
          complexityNormalized: 0.5,
          churnNormalized: 0.5,
          cyclomaticComplexity: 10,
          functionCount: 2,
          commitCount: 5,
          linesChanged: 100,
          authorCount: 1,
        },
      ],
      functions: [],
      coupling: [
        {
          fileA: "src/x|y.ts",
          fileB: "src/z.ts",
          coChangeCount: 3,
          couplingStrength: 0.6,
          hasStaticDependency: true,
        },
      ],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-07-22T12:00:00.000Z",
        granularity: "file",
      },
    });

    expect(output).toContain("src/a\\|b.ts");
    expect(output).toContain("src/x\\|y.ts");
  });

  it("renders empty sections without throwing", () => {
    const output = renderMarkdown({
      version: "1.0",
      hotspots: [],
      functions: [],
      coupling: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-07-22T12:00:00.000Z",
        granularity: "file",
      },
    });

    expect(output).toContain("## Top Hotspots");
    expect(output).toContain("_No results._");
    expect(output).not.toContain("| Rank | File |");
  });

  it("renders function mode table with granularity metadata", () => {
    const output = renderMarkdown(loadFunctionFixture());

    expect(output).toContain("**Granularity:** function");
    expect(output).toContain("## Top Functions");
    expect(output).toContain("| 1 | src/hot.ts | processOrder | 42 | 0.8200 |");
  });

  it("escapes pipe characters in function names", () => {
    const output = renderMarkdown({
      version: "1.0",
      hotspots: [],
      functions: [
        {
          filePath: "src/hot.ts",
          functionName: "foo|bar",
          line: 1,
          complexity: 5,
          complexityNormalized: 0.5,
          churnNormalized: 0.5,
          hotspotScore: 0.5,
          commitCount: 3,
          linesChanged: 40,
          authorCount: 1,
        },
      ],
      coupling: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-07-22T12:00:00.000Z",
        granularity: "function",
      },
    });

    expect(output).toContain("foo\\|bar");
  });
});
