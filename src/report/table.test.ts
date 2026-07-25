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
  it("includes scan window header and both section headers", () => {
    const output = renderTable(loadFixture());

    expect(output).toContain(
      "Scan window: 6 months ago (scanned 2026-07-22T11:00:00.000Z)",
    );
    expect(output).toContain("Top Hotspots");
    expect(output).toContain("Top Coupling Pairs");
    expect(output).toContain("src/hot.ts");
    expect(output).toContain("src/a.ts");
    expect(output).toContain("0.8500");
    expect(output).toContain("0.7500");
  });

  it("renders StaticDep, Direction, and Kinds columns in coupling section", () => {
    const output = renderTable(loadFixture());

    expect(output).toContain("StaticDep");
    expect(output).toContain("Direction");
    expect(output).toContain("Kinds");
    expect(output).toContain("yes");
    expect(output).toContain("no");
    expect(output).toContain("a→b");
    expect(output).toContain("runtime");
    expect(output).toContain("—");
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
    expect(output).not.toContain("src/c.ts");
  });

  it("truncates long file paths in table columns", () => {
    const longPath = "src/very/long/path/that/exceeds/column/width.ts";
    const output = renderTable({
      version: "1.0",
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
        },
      ],
      functions: [],
      coupling: [
        {
          fileA: longPath,
          fileB: "src/other/also/very/long/path/name.ts",
          couplingStrength: 0.25,
          coChangeCount: 4,
          hasStaticDependency: false,
          staticDependencyDirection: "none",
          hasRuntimeStaticDependency: false,
          hasTypeOnlyStaticDependency: false,
          hasReExportStaticDependency: false,
        },
      ],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-07-22T12:00:00.000Z",
        granularity: "file",
      },
    });

    expect(output).toContain(longPath.slice(0, 24));
    expect(output).not.toContain(longPath);
  });

  it("renders (none) for empty sections", () => {
    const output = renderTable({
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

    expect(output).toContain("  (none)");
    expect(output.match(/\(none\)/g)?.length).toBe(2);
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
    const couplingIndex = output.indexOf("Top Coupling Pairs");

    expect(output).toContain("Granularity: file");
    expect(output).toContain("Hotspots: showing 3 of 3");
    expect(hotspotsIndex).toBeGreaterThan(0);
    expect(couplingIndex).toBeGreaterThan(hotspotsIndex);
    expect(triageIndex).toBeGreaterThan(couplingIndex);
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
    const couplingOnly = renderTable(fixture, { only: ["coupling"] });
    const hotspotsOnly = renderTable(fixture, { only: ["hotspots"] });

    expect(couplingOnly).not.toContain("Top Hotspots");
    expect(couplingOnly).toContain("Top Coupling Pairs");
    expect(hotspotsOnly).not.toContain("Top Coupling Pairs");
    expect(hotspotsOnly).toContain("Top Hotspots");

    const emptyHotspots = renderTable(
      { ...fixture, hotspots: [], coupling: [] },
      { only: ["hotspots"] },
    );
    expect(emptyHotspots).toContain("Top Hotspots");
    expect(emptyHotspots).toContain("  (none)");
    expect(emptyHotspots).not.toContain("Top Coupling Pairs");
  });

  it("reports shown vs total from fullResult when sliced before render", () => {
    const full = loadFixture();
    const sliced = sliceScanResult(full, 1);
    const output = renderTable(sliced, { fullResult: full });

    expect(output).toContain("Hotspots: showing 1 of 3");
    expect(output).toContain(
      "Coupling pairs: 2 total, 1 without static dependency; showing 1 of 2",
    );
  });

  it("strip-ANSI output matches uncolored table for the same fixture", () => {
    const fixture = loadFixture();
    const plain = renderTable(fixture, { color: false });
    const colored = renderTable(fixture, { color: true });

    expect(stripAnsi(colored)).toBe(plain);
  });
});
