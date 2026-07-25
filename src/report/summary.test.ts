import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compareScanResults } from "../compare/compare.js";
import type { CompareResult, ScanResult } from "../types/index.js";
import { sliceCompareResult } from "./slice-compare.js";
import { sliceScanResult } from "./slice.js";
import {
  buildCompareExecutiveSummary,
  buildScanExecutiveSummary,
  formatWarningSummaryLine,
} from "./summary.js";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures/report",
);

function loadScanFixture(name: string): ScanResult {
  const raw = JSON.parse(
    readFileSync(join(fixturesDir, name), "utf8"),
  ) as ScanResult & { _comment?: string };
  const { _comment: _ignored, ...fixture } = raw;
  void _ignored;
  return fixture;
}

function loadCompareFixture(): CompareResult {
  const baseline = loadScanFixture("compare-baseline-file.json");
  const current = loadScanFixture("compare-current-file.json");
  return compareScanResults(baseline, current);
}

describe("buildScanExecutiveSummary", () => {
  it("reports scan window, granularity, and full-corpus coupling stats", () => {
    const full = loadScanFixture("sample-result.json");
    const lines = buildScanExecutiveSummary(full, full);

    expect(lines).toEqual([
      "Scan window: 6 months ago (scanned 2026-07-22T11:00:00.000Z)",
      "Granularity: file",
      "Hotspots: showing 3 of 3",
      "Coupling pairs: 2 total, 1 without static dependency; showing 2 of 2",
      "Warnings: 0",
    ]);
  });

  it("uses full corpus totals when displayed result is sliced", () => {
    const full = loadScanFixture("sample-result.json");
    const displayed = sliceScanResult(full, 1);
    const lines = buildScanExecutiveSummary(full, displayed);

    expect(lines).toContain("Hotspots: showing 1 of 3");
    expect(lines).toContain(
      "Coupling pairs: 2 total, 1 without static dependency; showing 1 of 2",
    );
  });

  it("labels function ranking when granularity is function", () => {
    const full = loadScanFixture("sample-result-functions.json");
    const displayed = sliceScanResult(full, 2);
    const lines = buildScanExecutiveSummary(full, displayed);

    expect(lines).toContain("Granularity: function");
    expect(lines).toContain("Functions: showing 2 of 3");
    expect(lines).not.toContain("Hotspots:");
  });

  it("counts static-dep-false pairs from the full coupling array", () => {
    const full = loadScanFixture("sample-result.json");
    const displayed = {
      ...full,
      coupling: full.coupling.filter((pair) => pair.hasStaticDependency),
    };
    const lines = buildScanExecutiveSummary(full, displayed);

    expect(lines).toContain(
      "Coupling pairs: 2 total, 1 without static dependency; showing 1 of 2",
    );
  });

  it("appends warning summary from full meta.warnings", () => {
    const full = loadScanFixture("sample-result.json");
    full.meta.warnings = [
      { severity: "warning", message: "mega", code: "MEGA_COMMIT_SKIPPED" },
      { severity: "warning", message: "mega again", code: "MEGA_COMMIT_SKIPPED" },
      { severity: "warning", message: "rename", code: "RENAME_HISTORY_INCOMPLETE" },
      { severity: "warning", message: "no code" },
    ];
    const lines = buildScanExecutiveSummary(full, full);

    expect(lines.at(-1)).toBe(
      "Warnings: 4 total (MEGA_COMMIT_SKIPPED: 2, RENAME_HISTORY_INCOMPLETE: 1, (uncoded): 1)",
    );
  });
});

describe("buildCompareExecutiveSummary", () => {
  it("reports baseline/current windows and delta classification totals", () => {
    const full = loadCompareFixture();
    const lines = buildCompareExecutiveSummary(full, full);

    expect(lines[0]).toBe(
      "Baseline since: 6 months ago (scanned 2026-07-20T10:00:00.000Z)",
    );
    expect(lines[1]).toBe(
      "Current since: 6 months ago (scanned 2026-07-22T11:00:00.000Z)",
    );
    expect(lines[2]).toBe("Granularity: file");
    expect(lines[3]).toBe(
      "Hotspot deltas: showing 3 of 3 (new 1, removed 1, rank changed 1)",
    );
    expect(lines[4]).toBe(
      "Coupling deltas: showing 3 of 3 (new 1, removed 0, rank changed 2)",
    );
    expect(lines[5]).toBe("Warnings: 0");
  });

  it("reports shown vs total on sliced compare deltas", () => {
    const full = loadCompareFixture();
    const displayed = sliceCompareResult(full, 1);
    const lines = buildCompareExecutiveSummary(full, displayed);

    expect(lines[3]).toBe(
      "Hotspot deltas: showing 3 of 3 (new 1, removed 1, rank changed 1)",
    );
    expect(lines[4]).toBe(
      "Coupling deltas: showing 2 of 3 (new 1, removed 0, rank changed 2)",
    );
    expect(lines[5]).toBe("Warnings: 0");
  });

  it("uses function delta labels in function granularity", () => {
    const baseline = loadScanFixture("compare-baseline-function.json");
    const current = loadScanFixture("compare-current-function.json");
    const full = compareScanResults(baseline, current);
    const lines = buildCompareExecutiveSummary(full, full);

    expect(lines[2]).toBe("Granularity: function");
    expect(lines[3]).toMatch(/^Function deltas: showing/);
    expect(lines[3]).not.toMatch(/^Hotspot deltas:/);
    expect(lines[5]).toBe("Warnings: 0");
  });

  it("uses compare-level meta.warnings only, not nested scan warnings", () => {
    const full = loadCompareFixture();
    full.meta.warnings = [
      { severity: "warning", message: "compare", code: "COMPARE_SINCE_MISMATCH" },
    ];
    full.meta.baseline.warnings = [
      { severity: "warning", message: "baseline", code: "MEGA_COMMIT_SKIPPED" },
    ];
    full.meta.current.warnings = [
      { severity: "warning", message: "current", code: "PARSE_FAILED" },
    ];
    const lines = buildCompareExecutiveSummary(full, full);

    expect(lines.at(-1)).toBe(
      "Warnings: 1 total (COMPARE_SINCE_MISMATCH: 1)",
    );
  });
});

describe("formatWarningSummaryLine", () => {
  it("returns Warnings: 0 for an empty array", () => {
    expect(formatWarningSummaryLine([])).toBe("Warnings: 0");
  });

  it("sorts coded tallies lexicographically and folds missing codes into (uncoded)", () => {
    const line = formatWarningSummaryLine([
      { severity: "warning", message: "z", code: "RENAME_HISTORY_INCOMPLETE" },
      { severity: "warning", message: "a", code: "MEGA_COMMIT_SKIPPED" },
      { severity: "warning", message: "b", code: "MEGA_COMMIT_SKIPPED" },
      { severity: "warning", message: "uncoded one" },
      { severity: "warning", message: "uncoded two" },
    ]);

    expect(line).toBe(
      "Warnings: 5 total (MEGA_COMMIT_SKIPPED: 2, RENAME_HISTORY_INCOMPLETE: 1, (uncoded): 2)",
    );
  });

  it("uses (uncoded) only when all warnings lack codes", () => {
    expect(
      formatWarningSummaryLine([
        { severity: "warning", message: "one" },
        { severity: "warning", message: "two" },
      ]),
    ).toBe("Warnings: 2 total ((uncoded): 2)");
  });
});
