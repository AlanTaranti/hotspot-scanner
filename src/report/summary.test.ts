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
  formatTimingSummaryLine,
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
  it("reports scan window and ranking totals", () => {
    const full = loadScanFixture("sample-result.json");
    const lines = buildScanExecutiveSummary(full, full);

    expect(lines).toEqual([
      "Scan window: 6 months ago (scanned 2026-07-22T11:00:00.000Z)",
      "Hotspots: showing 3 of 3",
      "Warnings: 0",
    ]);
  });

  it("uses full corpus totals when displayed result is sliced", () => {
    const full = loadScanFixture("sample-result.json");
    const displayed = sliceScanResult(full, 1);
    const lines = buildScanExecutiveSummary(full, displayed);

    expect(lines).toContain("Hotspots: showing 1 of 3");
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

  it("omits Timing when meta.timings is absent", () => {
    const full = loadScanFixture("sample-result.json");
    const lines = buildScanExecutiveSummary(full, full);

    expect(lines.some((line) => line.startsWith("Timing:"))).toBe(false);
  });

  it("appends Timing when meta.timings is present", () => {
    const full = loadScanFixture("sample-result.json");
    full.meta.timings = { gitMs: 500, complexityMs: 300, totalMs: 900 };
    const lines = buildScanExecutiveSummary(full, full);

    expect(lines.at(-1)).toBe(
      "Timing: total 900ms (git 500ms, complexity 300ms)",
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
    expect(lines[2]).toBe(
      "Hotspot deltas: showing 3 of 3 (new 1, removed 1, rank changed 1)",
    );
    expect(lines[3]).toBe("Warnings: 0");
  });

  it("reports shown vs total on sliced compare deltas", () => {
    const full = loadCompareFixture();
    const displayed = sliceCompareResult(full, 1);
    const lines = buildCompareExecutiveSummary(full, displayed);

    expect(lines[2]).toBe(
      "Hotspot deltas: showing 3 of 3 (new 1, removed 1, rank changed 1)",
    );
    expect(lines[3]).toBe("Warnings: 0");
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

  it("uses clear empty-delta copy when hotspot deltas total zero", () => {
    const baseline = loadScanFixture("compare-baseline-file.json");
    const full = compareScanResults(baseline, {
      ...baseline,
      meta: { ...baseline.meta, scannedAt: "2026-07-22T11:00:00.000Z" },
    });
    const lines = buildCompareExecutiveSummary(full, full);

    expect(lines[2]).toBe(
      "Hotspot deltas: No rank changes (no new, removed, or rank-changed hotspots)",
    );
    expect(lines[2]).not.toContain("showing 0 of 0");
  });

  it("appends Timing from current scan meta when present", () => {
    const full = loadCompareFixture();
    full.meta.current.timings = {
      gitMs: 800,
      complexityMs: 900,
      totalMs: 1200,
    };
    const lines = buildCompareExecutiveSummary(full, full);

    expect(lines.at(-1)).toBe(
      "Timing: total 1.2s (git 800ms, complexity 900ms; stages may run concurrently)",
    );
  });

  it("omits Timing when current scan meta has no timings", () => {
    const full = loadCompareFixture();
    const lines = buildCompareExecutiveSummary(full, full);

    expect(lines.some((line) => line.startsWith("Timing:"))).toBe(false);
  });
});

describe("formatTimingSummaryLine", () => {
  it("formats total and stage breakdown in user-facing units", () => {
    expect(
      formatTimingSummaryLine({ gitMs: 800, complexityMs: 400, totalMs: 1200 }),
    ).toBe("Timing: total 1.2s (git 800ms, complexity 400ms)");
  });

  it("notes concurrent stages when stage sums exceed total", () => {
    expect(
      formatTimingSummaryLine({ gitMs: 800, complexityMs: 900, totalMs: 1000 }),
    ).toBe(
      "Timing: total 1s (git 800ms, complexity 900ms; stages may run concurrently)",
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
