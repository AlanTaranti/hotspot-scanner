import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { AssessResult } from "../assess/types.js";
import { renderAssessMarkdown } from "./assess-markdown.js";
import { renderAssessTable } from "./assess-table.js";
import { stripAnsi } from "./color.js";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures/report/sample-assess-result.json",
);

function loadFixture(): AssessResult {
  return JSON.parse(readFileSync(fixturePath, "utf8")) as AssessResult;
}

describe("assess reporters", () => {
  const fixture = loadFixture();

  it("renders table summary with candidate and pattern counts", () => {
    const output = renderAssessTable(fixture);

    expect(output).toContain("Hotspot assess");
    expect(output).toContain(
      "since=12 months ago  minHotspotScore=0.7  top=20",
    );
    expect(output).toContain("Candidates: 3");
    expect(output).toContain(
      "Pattern counts: deteriorating=1  refactored=0  stable=1  inconclusive=0",
    );
    expect(output).toContain("Skipped: 1  Errors: 0");
  });

  it("renders table deteriorating detail with path, score, and pattern summary", () => {
    const output = renderAssessTable(fixture);

    expect(output).toContain(
      "src/hot.ts  score=0.9200  Pattern: deteriorating — indentMean +22% over history",
    );
    expect(output).not.toContain("src/stable.ts");
    expect(output).not.toContain("src/skipped.ts");
  });

  it("renders markdown summary and deteriorating section", () => {
    const output = renderAssessMarkdown(fixture);

    expect(output).toContain("Candidates: 3");
    expect(output).toContain("## Deteriorating");
    expect(output).toContain(
      "src/hot.ts  score=0.9200  Pattern: deteriorating — indentMean +22% over history",
    );
    expect(output).not.toContain("src/stable.ts");
  });

  it("states when no deteriorating candidates exist", () => {
    const withoutDeteriorating = structuredClone(fixture);
    withoutDeteriorating.meta.patternCounts.deteriorating = 0;
    withoutDeteriorating.candidates = withoutDeteriorating.candidates.filter(
      (candidate) => candidate.growthPattern?.kind !== "deteriorating",
    );

    const tableOutput = renderAssessTable(withoutDeteriorating);
    const markdownOutput = renderAssessMarkdown(withoutDeteriorating);

    expect(tableOutput).toContain("No deteriorating candidates.");
    expect(markdownOutput).toContain("_No deteriorating candidates._");
    expect(tableOutput).not.toContain("Pattern: deteriorating");
    expect(markdownOutput).not.toContain("Pattern: deteriorating");
  });

  it("lists non-deteriorating kinds in counts only", () => {
    const mixed = structuredClone(fixture);
    mixed.meta.patternCounts = {
      deteriorating: 1,
      refactored: 1,
      stable: 1,
      inconclusive: 1,
    };
    mixed.candidates = [
      ...mixed.candidates,
      {
        filePath: "src/refactored.ts",
        hotspotScore: 0.88,
        status: "ok",
        growthPattern: {
          kind: "refactored",
          summary: "indentMean −25% over history",
        },
        revisionCount: 10,
        truncated: false,
      },
      {
        filePath: "src/inconclusive.ts",
        hotspotScore: 0.77,
        status: "ok",
        growthPattern: {
          kind: "inconclusive",
          summary: "insufficient history (2 points, need 5)",
        },
        revisionCount: 2,
        truncated: false,
      },
    ];

    const tableOutput = renderAssessTable(mixed);
    const markdownOutput = renderAssessMarkdown(mixed);

    expect(tableOutput).toContain(
      "Pattern counts: deteriorating=1  refactored=1  stable=1  inconclusive=1",
    );
    expect(tableOutput).not.toContain("Pattern: refactored");
    expect(tableOutput).not.toContain("Pattern: stable");
    expect(tableOutput).not.toContain("Pattern: inconclusive");
    expect(tableOutput).not.toContain("src/refactored.ts");
    expect(tableOutput).not.toContain("src/stable.ts");
    expect(tableOutput).not.toContain("src/inconclusive.ts");

    expect(markdownOutput).toContain("refactored=1");
    expect(markdownOutput).not.toContain("Pattern: refactored");
    expect(markdownOutput).not.toContain("src/inconclusive.ts");
  });

  it("colors title, section, pattern kinds, and scores when color is enabled", () => {
    const plain = renderAssessTable(fixture, { color: false });
    const colored = renderAssessTable(fixture, { color: true });
    expect(stripAnsi(colored)).toBe(plain);
    expect(colored).not.toBe(plain);
    expect(colored).toContain("\x1b[");
    expect(colored).toContain("Hotspot assess");
    expect(colored).toContain("Deteriorating");
  });

  it("defaults to plain output when color is omitted", () => {
    expect(renderAssessTable(fixture)).toBe(
      renderAssessTable(fixture, { color: false }),
    );
  });
});
