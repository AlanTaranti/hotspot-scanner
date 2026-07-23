import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compareScanResults } from "../compare/compare.js";
import type { ScanResult } from "../types/index.js";
import { renderCompareCsv } from "./compare-csv.js";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures/report",
);

function loadCompareResult(baselineName: string, currentName: string) {
  const baseline = JSON.parse(
    readFileSync(join(fixturesDir, baselineName), "utf8"),
  ) as ScanResult;
  const current = JSON.parse(
    readFileSync(join(fixturesDir, currentName), "utf8"),
  ) as ScanResult;
  return compareScanResults(baseline, current);
}

describe("renderCompareCsv", () => {
  it("renders compare metadata block", () => {
    const output = renderCompareCsv(
      loadCompareResult("compare-baseline-file.json", "compare-current-file.json"),
    );

    expect(output).toContain("Compare Metadata");
    expect(output).toContain("key,value");
    expect(output).toContain("granularity,file");
    expect(output).toContain("baseline_scanned_at");
    expect(output).toContain("current_scanned_at");
  });

  it("renders file mode hotspot and coupling sections", () => {
    const output = renderCompareCsv(
      loadCompareResult("compare-baseline-file.json", "compare-current-file.json"),
    );

    expect(output).toContain("New Hotspots");
    expect(output).toContain("Removed Hotspots");
    expect(output).toContain("Rank Changed Hotspots");
    expect(output).toContain("New Coupling Pairs");
    expect(output).toContain("Removed Coupling Pairs");
    expect(output).toContain("Rank Changed Coupling Pairs");
    expect(output).toContain(
      "baselineRank,currentRank,rankDelta,file,score,cpx,cpxN,churn,churnN,funcs,authors",
    );
  });

  it("renders function mode sections", () => {
    const output = renderCompareCsv(
      loadCompareResult(
        "compare-baseline-function.json",
        "compare-current-function.json",
      ),
    );

    expect(output).toContain("granularity,function");
    expect(output).toContain("New Functions");
    expect(output).toContain("Removed Functions");
    expect(output).toContain("Rank Changed Functions");
    expect(output).not.toContain("New Hotspots");
  });

  it("renders removed sections with empty rank cell", () => {
    const output = renderCompareCsv(
      loadCompareResult("compare-baseline-file.json", "compare-current-file.json"),
    );

    const removedSection = output.split("Removed Hotspots")[1]?.split(
      "Rank Changed Hotspots",
    )[0];
    expect(removedSection).toBeDefined();
    const dataRows = removedSection!
      .split("\n")
      .filter((line) => line.includes("src/") && line.startsWith(","));
    expect(dataRows.length).toBeGreaterThan(0);
  });

  it("renders rank-changed rows with baselineRank, currentRank, rankDelta", () => {
    const output = renderCompareCsv(
      loadCompareResult("compare-baseline-file.json", "compare-current-file.json"),
    );

    const rankChangedSection = output.split("Rank Changed Hotspots")[1]?.split(
      "New Coupling Pairs",
    )[0];
    expect(rankChangedSection).toBeDefined();
    const dataRows = rankChangedSection!
      .split("\n")
      .filter((line) => /^\d+,\d+,-?\d+,/.test(line));
    expect(dataRows.length).toBeGreaterThan(0);
  });

  it("renders empty sections with title and header only", () => {
    const baseline = JSON.parse(
      readFileSync(join(fixturesDir, "compare-baseline-file.json"), "utf8"),
    ) as ScanResult;
    const result = compareScanResults(baseline, {
      ...baseline,
      meta: { ...baseline.meta, scannedAt: "2026-07-22T11:00:00.000Z" },
    });

    const output = renderCompareCsv(result);

    expect(output).toContain("New Hotspots");
    expect(output).toContain(
      "rank,file,score,cpx,cpxN,churn,churnN,funcs,authors",
    );
    const newSection = output.split("New Hotspots")[1]?.split(
      "Removed Hotspots",
    )[0];
    const dataRows = newSection!
      .split("\n")
      .filter((line) => line.startsWith("1,") || line.startsWith("2,"));
    expect(dataRows).toHaveLength(0);
  });

  it("includes warning rows in metadata", () => {
    const baseline = JSON.parse(
      readFileSync(join(fixturesDir, "compare-baseline-file.json"), "utf8"),
    ) as ScanResult;
    const current = JSON.parse(
      readFileSync(join(fixturesDir, "compare-current-file.json"), "utf8"),
    ) as ScanResult;
    const result = compareScanResults(baseline, current);
    result.meta.warnings = ["baseline window differs", "stale baseline"];

    const output = renderCompareCsv(result);

    expect(output).toContain("warning,baseline window differs");
    expect(output).toContain("warning,stale baseline");
  });

  it("escapes special characters in file paths", () => {
    const baseline = JSON.parse(
      readFileSync(join(fixturesDir, "compare-baseline-file.json"), "utf8"),
    ) as ScanResult;
    const current = JSON.parse(
      readFileSync(join(fixturesDir, "compare-current-file.json"), "utf8"),
    ) as ScanResult;
    const withSpecial: ScanResult = {
      ...current,
      hotspots: [
        {
          ...current.hotspots[0]!,
          filePath: 'src/"weird",path.ts',
        },
        ...current.hotspots.slice(1),
      ],
    };

    const output = renderCompareCsv(compareScanResults(baseline, withSpecial));
    expect(output).toContain('"src/""weird"",path.ts"');
  });
});
