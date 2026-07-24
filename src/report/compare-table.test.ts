import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compareScanResults } from "../compare/compare.js";
import type { ScanResult } from "../types/index.js";
import { renderCompareTable } from "./compare-table.js";

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

describe("renderCompareTable", () => {
  it("renders file mode sections", () => {
    const output = renderCompareTable(
      loadCompareResult("compare-baseline-file.json", "compare-current-file.json"),
    );

    expect(output).toContain("Scan Compare Report");
    expect(output).toContain("=== New Hotspots ===");
    expect(output).toContain("=== Removed Hotspots ===");
    expect(output).toContain("=== Rank Changed Hotspots ===");
    expect(output).toContain("=== New Coupling Pairs ===");
    expect(output).toContain("src/new.ts");
    expect(output).toContain("src/medium.ts");
  });

  it("renders StaticDep column in coupling sections", () => {
    const output = renderCompareTable(
      loadCompareResult("compare-baseline-file.json", "compare-current-file.json"),
    );

    expect(output).toContain("StaticDep");
    expect(output).toContain("yes");
    expect(output).toContain("no");
  });

  it("renders function mode sections", () => {
    const output = renderCompareTable(
      loadCompareResult(
        "compare-baseline-function.json",
        "compare-current-function.json",
      ),
    );

    expect(output).toContain("=== New Functions ===");
    expect(output).toContain("=== Removed Functions ===");
    expect(output).toContain("=== Rank Changed Functions ===");
    expect(output).toContain("newHandler");
  });

  it("renders empty sections without throwing", () => {
    const baseline = JSON.parse(
      readFileSync(join(fixturesDir, "compare-baseline-file.json"), "utf8"),
    ) as ScanResult;
    const current = JSON.parse(
      readFileSync(join(fixturesDir, "compare-current-file.json"), "utf8"),
    ) as ScanResult;
    const identical = compareScanResults(baseline, {
      ...baseline,
      meta: { ...baseline.meta, scannedAt: current.meta.scannedAt },
    });

    expect(() => renderCompareTable(identical)).not.toThrow();
    expect(renderCompareTable(identical)).toContain("(none)");
  });
});
