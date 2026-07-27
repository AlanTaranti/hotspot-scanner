import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ScanResult } from "../types/index.js";
import { stripAnsi } from "./color.js";
import { sliceScanResult } from "./slice.js";
import { renderTable } from "./table.js";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures/report/sample-result.json",
);

function loadFixture(): ScanResult {
  const raw = JSON.parse(readFileSync(fixturePath, "utf8")) as ScanResult & {
    _comment?: string;
  };
  const { _comment: _ignored, ...fixture } = raw;
  void _ignored;
  return fixture;
}

describe("renderTable", () => {
  it("includes scan window header and hotspot section", () => {
    const output = renderTable(loadFixture());

    expect(output).toContain(
      "Scan window: 6 months ago (scanned 2026-07-22T11:00:00.000Z)",
    );
    expect(output).toContain("Top Hotspots");
    expect(output).toContain("src/hot.ts");
    expect(output).toContain("0.8500");
  });

  it("shows raw metric columns in hotspots section", () => {
    const output = renderTable(loadFixture());

    expect(output).toContain("NLOC");
    expect(output).toContain("NLOCN");
    expect(output).toContain("Churn");
    expect(output).toContain("ChurnN");
    expect(output).toContain("Authors");
    expect(output).toContain("Lines");
    expect(output).toContain("42");
    expect(output).toContain("15");
    expect(output).toContain("3");
    expect(output).toContain("320");
    expect(output).not.toContain("Cpx");
    expect(output).not.toContain("Funcs");
  });

  it("respects top slicing when applied before render", () => {
    const output = renderTable(sliceScanResult(loadFixture(), 1), {
      triageHints: false,
    });

    expect(output.match(/src\/hot\.ts/g)?.length).toBe(1);
    expect(output).not.toContain("src/medium.ts");
  });

  it("truncates long file paths with middle-ellipsis", () => {
    const longPath = "src/very/long/path/that/exceeds/column/width.ts";
    const output = renderTable(
      {
        version: "3.0",
        hotspots: [
          {
            filePath: longPath,
            hotspotScore: 0.5,
            complexityNormalized: 0.4,
            churnNormalized: 0.6,
            ncloc: 12,
            commitCount: 8,
            linesChanged: 50,
            authorCount: 2,
          },
        ],
        meta: {
          since: "12 months ago",
          scannedAt: "2026-07-22T12:00:00.000Z",
          warnings: [],
        },
      },
      { stdoutColumns: 80, triageHints: false },
    );

    expect(output).toContain("…");
    expect(output).toContain("width.ts");
    expect(output).not.toContain(longPath);
    expect(output).not.toContain(longPath.slice(0, 24));
  });

  it("renders (none) for empty sections", () => {
    const output = renderTable({
      version: "3.0",
      hotspots: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-07-22T12:00:00.000Z",
        warnings: [],
      },
    });

    expect(output).toContain("  (none)");
    expect(output.match(/\(none\)/g)?.length).toBe(1);
  });

  it("includes executive summary, triage hints, and glossary footer in default order", () => {
    const output = renderTable(loadFixture());

    const glossaryIndex = output.indexOf("Glossary");
    const triageIndex = output.indexOf("Triage hints");
    const hotspotsIndex = output.indexOf("Top Hotspots");

    expect(output).toContain("Hotspots: showing 3 of 3");
    expect(hotspotsIndex).toBeGreaterThan(0);
    expect(triageIndex).toBeGreaterThan(hotspotsIndex);
    expect(glossaryIndex).toBeGreaterThan(triageIndex);
    expect(output).toContain("  Score       Hotspot score:");
    expect(output).toContain("src/hot.ts — High dual-signal hotspot");
  });

  it("omits triage section when triageHints is false", () => {
    const output = renderTable(loadFixture(), { triageHints: false });

    expect(output).not.toContain("Triage hints");
    expect(output).toContain("Glossary");
  });

  it("reports shown vs total from fullResult when sliced before render", () => {
    const full = loadFixture();
    const sliced = sliceScanResult(full, 1);
    const output = renderTable(sliced, { fullResult: full });

    expect(output).toContain("Hotspots: showing 1 of 3");
  });

  it("includes Timing in summary when meta.timings is present", () => {
    const full = loadFixture();
    full.meta.timings = { gitMs: 400, complexityMs: 200, totalMs: 700 };
    const output = renderTable(full);

    expect(output).toContain(
      "Timing: total 700ms (git 400ms, complexity 200ms)",
    );
  });

  it("omits Timing in summary when meta.timings is absent", () => {
    const output = renderTable(loadFixture());

    expect(output).not.toContain("Timing:");
  });

  it("strip-ANSI output matches uncolored table for the same fixture", () => {
    const fixture = loadFixture();
    const plain = renderTable(fixture, { color: false });
    const colored = renderTable(fixture, { color: true });

    expect(stripAnsi(colored)).toBe(plain);
  });
});
