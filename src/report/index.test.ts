import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compareScanResults } from "../compare/compare.js";
import type { CompareResult, ScanResult } from "../types/index.js";
import { stripAnsi } from "./color.js";
import { createReporter } from "./index.js";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures/report/sample-result.json",
);
const functionFixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures/report/sample-result-functions.json",
);
const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures/report",
);

function loadFixture(): ScanResult {
  return JSON.parse(readFileSync(fixturePath, "utf8")) as ScanResult;
}

function loadFunctionFixture(): ScanResult {
  return JSON.parse(readFileSync(functionFixturePath, "utf8")) as ScanResult;
}

function loadCompareResult(): CompareResult {
  const baseline = JSON.parse(
    readFileSync(join(fixturesDir, "compare-baseline-file.json"), "utf8"),
  ) as ScanResult;
  const current = JSON.parse(
    readFileSync(join(fixturesDir, "compare-current-file.json"), "utf8"),
  ) as ScanResult;
  return compareScanResults(baseline, current);
}

function loadFunctionCompareResult(): CompareResult {
  const baseline = JSON.parse(
    readFileSync(join(fixturesDir, "compare-baseline-function.json"), "utf8"),
  ) as ScanResult;
  const current = JSON.parse(
    readFileSync(join(fixturesDir, "compare-current-function.json"), "utf8"),
  ) as ScanResult;
  return compareScanResults(baseline, current);
}

describe("createReporter", () => {
  it("renders CSV bundle with all hotspots when top is set", () => {
    const output = createReporter().render(loadFixture(), {
      format: "csv",
      top: 1,
    });

    expect(typeof output).toBe("object");
    expect(output).toHaveProperty("hotspots.csv");
    expect(output).toHaveProperty("meta.json");
    expect(output).toHaveProperty("coupling.csv");
    const hotspotsCsv = (output as Record<string, string>)["hotspots.csv"]!;
    expect(hotspotsCsv).toContain("1,src/hot.ts,0.8500");
    expect(hotspotsCsv).toContain("2,src/medium.ts,0.3000");
    expect(hotspotsCsv).toContain("3,src/cold.ts,0.0200");
  });

  it("renders compare CSV bundle with all sections when top is set", () => {
    const output = createReporter().renderCompare(loadCompareResult(), {
      format: "csv",
      top: 1,
    });

    expect(typeof output).toBe("object");
    expect(output).toHaveProperty("hotspots.new.csv");
    expect(output).toHaveProperty("hotspots.rank-changed.csv");
    expect(output).toHaveProperty("coupling.new.csv");
  });

  it("renders JSON output with full arrays when top is set", () => {
    const output = createReporter().render(loadFixture(), {
      format: "json",
      top: 2,
    });
    const parsed = JSON.parse(output) as ScanResult;

    expect(parsed.hotspots).toHaveLength(3);
    expect(parsed.coupling).toHaveLength(2);
  });

  it("renders JSON output with full arrays when top is omitted", () => {
    const output = createReporter().render(loadFixture(), {
      format: "json",
    });
    const parsed = JSON.parse(output) as ScanResult;

    expect(parsed.hotspots).toHaveLength(3);
    expect(parsed.coupling).toHaveLength(2);
  });

  it("renders table output", () => {
    const output = createReporter().render(loadFixture(), {
      format: "table",
      top: 2,
    });

    expect(output).toContain("Top Hotspots");
    expect(output).toContain("Top Coupling Pairs");
    expect(output).toContain("Scan window: 6 months ago");
  });

  it("renders markdown output", () => {
    const output = createReporter().render(loadFixture(), {
      format: "markdown",
      top: 2,
    });

    expect(output).toContain("# Hotspot Scanner Report");
    expect(output).toContain("## Top Hotspots");
    expect(output).toContain("## Top Coupling Pairs");
    expect(output).toContain("Scan window: 6 months ago");
  });

  it("renders function mode table output", () => {
    const output = createReporter().render(loadFunctionFixture(), {
      format: "table",
      top: 2,
    });

    expect(output).toContain("Top Functions");
    expect(output).toContain("processOrder");
    expect(output).not.toContain("Top Hotspots");
  });

  it("renders function mode markdown output", () => {
    const output = createReporter().render(loadFunctionFixture(), {
      format: "markdown",
      top: 2,
    });

    expect(output).toContain("## Top Functions");
    expect(output).toContain("Granularity: function");
    expect(output).toContain("processOrder");
  });

  it("renders function mode markdown output", () => {
    const output = createReporter().renderCompare(loadFunctionCompareResult(), {
      format: "markdown",
      top: 2,
    });

    expect(output).toContain("## New Functions");
    expect(output).toContain("## Rank Changed Functions");
  });

  it("renders compare JSON output with full delta arrays when top is set", () => {
    const compareResult = loadCompareResult();
    const output = createReporter().renderCompare(compareResult, {
      format: "json",
      top: 1,
    });
    const parsed = JSON.parse(output);

    expect(parsed.version).toBe("1.0");
    expect(parsed.hotspots.new).toHaveLength(compareResult.hotspots.new.length);
    expect(parsed.hotspots.removed).toHaveLength(
      compareResult.hotspots.removed.length,
    );
    expect(parsed.hotspots.rankChanged).toHaveLength(
      compareResult.hotspots.rankChanged.length,
    );
    expect(parsed.coupling.new).toHaveLength(compareResult.coupling.new.length);
    expect(parsed.coupling.removed).toHaveLength(
      compareResult.coupling.removed.length,
    );
    expect(parsed.coupling.rankChanged).toHaveLength(
      compareResult.coupling.rankChanged.length,
    );
  });

  it("renders compare table output", () => {
    const output = createReporter().renderCompare(loadCompareResult(), {
      format: "table",
      top: 2,
    });

    expect(output).toContain("Scan Compare Report");
    expect(output).toContain("=== New Hotspots ===");
  });

  it("does not throw", () => {
    expect(() =>
      createReporter().render(
        {
          version: "1.0",
          hotspots: [],
          functions: [],
          coupling: [],
          meta: {
            since: "12 months ago",
            scannedAt: "2026-07-22T12:00:00.000Z",
            granularity: "file",
          },
        },
        { format: "table" },
      ),
    ).not.toThrow();
  });

  it("defaults to all sections, triage on, and color off for scan table", () => {
    const fixture = loadFixture();
    const output = createReporter().render(fixture, { format: "table" });

    expect(output).toContain("Top Hotspots");
    expect(output).toContain("Top Coupling Pairs");
    expect(output).toContain("Triage hints");
    expect(output).toContain("Glossary");
    expect(stripAnsi(output)).toBe(output);
    expect(output).toContain("src/hot.ts");
    expect(output).toContain("0.8500");
    expect(output).toContain("0.7500");
  });

  it("defaults to triage on for scan markdown", () => {
    const output = createReporter().render(loadFixture(), {
      format: "markdown",
    });

    expect(output).toContain("## Triage hints");
    expect(output).toContain("## Top Hotspots");
    expect(output).toContain("## Top Coupling Pairs");
  });

  it("preserves ranking rows and scores with default interpretation options", () => {
    const fixture = loadFixture();
    const output = createReporter().render(fixture, {
      format: "table",
      top: 2,
    });

    const hotspotsStart = output.indexOf("Top Hotspots");
    const couplingStart = output.indexOf("Top Coupling Pairs");
    const rankingBlock = output.slice(hotspotsStart, couplingStart);

    expect(rankingBlock).toContain("src/hot.ts");
    expect(rankingBlock).toContain("src/medium.ts");
    expect(rankingBlock).not.toContain("src/cold.ts");
    expect(rankingBlock).toContain("0.8500");
    expect(rankingBlock).toContain("0.3000");
  });

  it("omits JSON sections when only is set without slicing arrays", () => {
    const fixture = loadFixture();
    const output = createReporter().render(fixture, {
      format: "json",
      only: ["coupling"],
      top: 1,
    });
    const parsed = JSON.parse(output) as Record<string, unknown>;

    expect(parsed).not.toHaveProperty("hotspots");
    expect(parsed).not.toHaveProperty("functions");
    expect(parsed.coupling).toHaveLength(2);
  });

  it("omits CSV bundle files when only is set without slicing rows", () => {
    const output = createReporter().render(loadFixture(), {
      format: "csv",
      only: ["coupling"],
      top: 1,
    });

    expect(output).not.toHaveProperty("hotspots.csv");
    expect(output).not.toHaveProperty("functions.csv");
    expect(output).toHaveProperty("coupling.csv");
    expect(output).toHaveProperty("meta.json");
    const couplingCsv = (output as Record<string, string>)["coupling.csv"]!;
    expect(couplingCsv).toContain("0.7500");
    expect(couplingCsv).toContain("0.5000");
  });

  it("suppresses triage when triageHints is false", () => {
    const output = createReporter().render(loadFixture(), {
      format: "table",
      triageHints: false,
    });

    expect(output).not.toContain("Triage hints");
    expect(output).toContain("Glossary");
  });

  it("applies color only when explicitly enabled on scan table", () => {
    const fixture = loadFixture();
    const plain = createReporter().render(fixture, { format: "table" });
    const colored = createReporter().render(fixture, {
      format: "table",
      color: true,
    });

    expect(stripAnsi(colored)).toBe(plain);
    expect(colored).not.toBe(plain);
  });

  it("emits triage on compare table by default", () => {
    const output = createReporter().renderCompare(loadCompareResult(), {
      format: "table",
    });

    expect(output).toContain("Triage hints");
    expect(output).toContain("Glossary");
    const triageIndex = (output as string).indexOf("Triage hints");
    const glossaryIndex = (output as string).indexOf("Glossary");
    expect(glossaryIndex).toBeGreaterThan(triageIndex);
  });

  it("suppresses triage when triageHints is false on compare table", () => {
    const output = createReporter().renderCompare(loadCompareResult(), {
      format: "table",
      triageHints: false,
    });

    expect(output).not.toContain("Triage hints");
    expect(output).toContain("Glossary");
  });

  it("filters scan table sections when only is set", () => {
    const output = createReporter().render(loadFixture(), {
      format: "table",
      only: ["coupling"],
    });

    expect(output).not.toContain("Top Hotspots");
    expect(output).toContain("Top Coupling Pairs");
    expect(output).toContain("Glossary");
  });

  it("filters compare markdown sections when only is set", () => {
    const output = createReporter().renderCompare(loadCompareResult(), {
      format: "markdown",
      only: ["coupling"],
    });

    expect(output).not.toContain("## Top Hotspots");
    expect(output).toContain("## New Coupling Pairs");
    expect(output).toContain("## How to read this");
  });

  it("filters compare JSON sections when only is set", () => {
    const output = createReporter().renderCompare(loadCompareResult(), {
      format: "json",
      only: ["hotspots"],
    });
    const parsed = JSON.parse(output as string) as Record<string, unknown>;

    expect(parsed).toHaveProperty("hotspots");
    expect(parsed).not.toHaveProperty("coupling");
    expect(parsed).not.toHaveProperty("functions");
  });
});
