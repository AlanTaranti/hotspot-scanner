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
const functionFixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures/report/sample-result-functions.json",
);

function loadFixture(): ScanResult {
  const raw = JSON.parse(readFileSync(fixturePath, "utf8")) as ScanResult & {
    _comment?: string;
  };
  const { _comment: _ignored, ...fixture } = raw;
  void _ignored;
  return fixture;
}

function loadFunctionFixture(): ScanResult {
  const raw = JSON.parse(
    readFileSync(functionFixturePath, "utf8"),
  ) as ScanResult & { _comment?: string };
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

    expect(output).toContain("Cpx");
    expect(output).toContain("CpxN");
    expect(output).toContain("Churn");
    expect(output).toContain("ChurnN");
    expect(output).toContain("Funcs");
    expect(output).toContain("Authors");
    expect(output).toContain("42");
    expect(output).toContain("15");
    expect(output).toContain("8");
    expect(output).toContain("3");
  });

  it("respects top slicing when applied before render", () => {
    const output = renderTable(sliceScanResult(loadFixture(), 1), {
      triageHints: false,
    });

    expect(output.match(/src\/hot\.ts/g)?.length).toBe(1);
    expect(output).not.toContain("src/medium.ts");
  });

  it("truncates long file paths in table columns", () => {
    const longPath = "src/very/long/path/that/exceeds/column/width.ts";
    const output = renderTable({
      version: "2.0",
      hotspots: [
        {
          filePath: longPath,
          hotspotScore: 0.5,
          complexityNormalized: 0.4,
          churnNormalized: 0.6,
          cyclomaticComplexity: 12,
          functionCount: 3,
          commitCount: 8,
          linesChanged: 50,
          authorCount: 2,
          parseFailed: false,
        },
      ],
      functions: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-07-22T12:00:00.000Z",
        granularity: "file",
        warnings: [],
      },
    });

    expect(output).toContain(longPath.slice(0, 24));
    expect(output).not.toContain(longPath);
  });

  it("renders (none) for empty sections", () => {
    const output = renderTable({
      version: "2.0",
      hotspots: [],
      functions: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-07-22T12:00:00.000Z",
        granularity: "file",
        warnings: [],
      },
    });

    expect(output).toContain("  (none)");
    expect(output.match(/\(none\)/g)?.length).toBe(1);
  });

  it("renders Top Functions section in function mode", () => {
    const output = renderTable(loadFunctionFixture());

    expect(output).toContain("Top Functions");
    expect(output).toContain("processOrder");
    expect(output).toContain("0.8200");
    expect(output).not.toContain("Top Hotspots");
  });

  it("includes executive summary, triage hints, and glossary footer in default order", () => {
    const output = renderTable(loadFixture());

    const glossaryIndex = output.indexOf("Glossary");
    const triageIndex = output.indexOf("Triage hints");
    const hotspotsIndex = output.indexOf("Top Hotspots");

    expect(output).toContain("Granularity: file");
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

  it("omits excluded sections with --only while keeping empty included sections", () => {
    const fixture = loadFixture();
    const functionsOnly = renderTable(fixture, { only: ["functions"] });
    const hotspotsOnly = renderTable(fixture, { only: ["hotspots"] });

    expect(functionsOnly).not.toContain("Top Hotspots");
    expect(functionsOnly).toContain("Top Functions");
    expect(hotspotsOnly).not.toContain("Top Functions");
    expect(hotspotsOnly).toContain("Top Hotspots");

    const emptyHotspots = renderTable(
      { ...fixture, hotspots: [] },
      { only: ["hotspots"] },
    );
    expect(emptyHotspots).toContain("Top Hotspots");
    expect(emptyHotspots).toContain("  (none)");
    expect(emptyHotspots).not.toContain("Top Functions");
  });

  it("reports shown vs total from fullResult when sliced before render", () => {
    const full = loadFixture();
    const sliced = sliceScanResult(full, 1);
    const output = renderTable(sliced, { fullResult: full });

    expect(output).toContain("Hotspots: showing 1 of 3");
  });

  it("strip-ANSI output matches uncolored table for the same fixture", () => {
    const fixture = loadFixture();
    const plain = renderTable(fixture, { color: false });
    const colored = renderTable(fixture, { color: true });

    expect(stripAnsi(colored)).toBe(plain);
  });
});
