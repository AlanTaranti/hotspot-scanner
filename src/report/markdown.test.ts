import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ScanResult } from "../types/index.js";
import { renderMarkdown } from "./markdown.js";
import { sliceScanResult } from "./slice.js";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures/report/sample-result.json",
);

function loadFixture(): ScanResult {
  return JSON.parse(readFileSync(fixturePath, "utf8")) as ScanResult;
}

function sectionIndex(output: string, heading: string): number {
  return output.indexOf(heading);
}

describe("renderMarkdown", () => {
  it("renders title, executive summary, and section headings", () => {
    const output = renderMarkdown(loadFixture());

    expect(output).toContain("# Hotspot Scanner Report");
    expect(output).toContain(
      "Scan window: 6 months ago (scanned 2026-07-22T11:00:00.000Z)",
    );
    expect(output).toContain("Hotspots: showing 3 of 3");
    expect(output).toContain("## How to read this");
    expect(output).toContain("## Top Hotspots");
  });

  it("orders interpretation sections before tables and triage after tables", () => {
    const output = renderMarkdown(loadFixture());

    const summaryIndex = output.indexOf("Scan window: 6 months ago");
    const howToReadIndex = sectionIndex(output, "## How to read this");
    const hotspotsIndex = sectionIndex(output, "## Top Hotspots");
    const triageIndex = sectionIndex(output, "## Triage hints");

    expect(summaryIndex).toBeGreaterThan(-1);
    expect(howToReadIndex).toBeGreaterThan(summaryIndex);
    expect(hotspotsIndex).toBeGreaterThan(howToReadIndex);
    expect(triageIndex).toBeGreaterThan(hotspotsIndex);
  });

  it("renders hotspot table with all columns including Lines", () => {
    const output = renderMarkdown(loadFixture());

    expect(output).toContain(
      "| Rank | File | Score | NLOC | NLOCN | Churn | ChurnN | Authors | Lines |",
    );
    expect(output).toContain(
      "| 1 | src/hot.ts | 0.8500 | 42 | 0.9000 | 15 | 0.9444 | 3 | 320 |",
    );
  });

  it("reports shown vs total from full and displayed results", () => {
    const full = loadFixture();
    const displayed = sliceScanResult(full, 1);
    const output = renderMarkdown(displayed, { full });

    expect(output).toContain("Hotspots: showing 1 of 3");
  });

  it("includes triage hints when rules match and triage is enabled", () => {
    const output = renderMarkdown(loadFixture());

    expect(output).toContain("## Triage hints");
    expect(output).toContain("src/hot.ts — High dual-signal hotspot");
  });

  it("omits triage section when triageHints is false", () => {
    const output = renderMarkdown(loadFixture(), { triageHints: false });

    expect(output).not.toContain("## Triage hints");
  });

  it("escapes pipe characters in file paths", () => {
    const output = renderMarkdown({
      version: "3.0",
      hotspots: [
        {
          filePath: "src/a|b.ts",
          hotspotScore: 0.5,
          complexityNormalized: 0.5,
          churnNormalized: 0.5,
          ncloc: 10,
          commitCount: 5,
          linesChanged: 100,
          authorCount: 1,
        },
      ],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-07-22T12:00:00.000Z",
        warnings: [],
      },
    });

    expect(output).toContain("src/a\\|b.ts");
  });

  it("renders empty sections without throwing", () => {
    const output = renderMarkdown({
      version: "3.0",
      hotspots: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-07-22T12:00:00.000Z",
        warnings: [],
      },
    });

    expect(output).toContain("## Top Hotspots");
    expect(output).toContain("_No results._");
    expect(output).not.toContain("| Rank | File |");
    expect(output).not.toContain("## Triage hints");
  });
});
