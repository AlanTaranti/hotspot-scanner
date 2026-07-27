import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compareScanResults } from "../compare/compare.js";
import type { ScanResult } from "../types/index.js";
import { stripAnsi } from "./color.js";
import { renderCompareTable } from "./compare-table.js";
import { formatFileColumn } from "./path-column.js";
import { sliceCompareResult } from "./slice-compare.js";

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
  it("renders hotspot delta sections", () => {
    const output = renderCompareTable(
      loadCompareResult(
        "compare-baseline-file.json",
        "compare-current-file.json",
      ),
    );

    expect(output).toContain("Scan Compare Report");
    expect(output).toContain("=== New Hotspots ===");
    expect(output).toContain("=== Removed Hotspots ===");
    expect(output).toContain("=== Rank Changed Hotspots ===");
    expect(output).toContain("ScoreΔ");
    expect(output).toContain("NLOCΔ");
    expect(output).toContain("CommitsΔ");
    expect(output).toContain("src/new.ts");
    expect(output).toContain("src/medium.ts");
    expect(output).toContain("NLOC");
    expect(output).not.toContain("=== New Functions ===");
  });

  it("includes executive summary and glossary footer", () => {
    const result = loadCompareResult(
      "compare-baseline-file.json",
      "compare-current-file.json",
    );
    const output = renderCompareTable(result);

    expect(output).toContain("Baseline since:");
    expect(output).toContain("Hotspot deltas: showing");
    expect(output).toContain("Glossary");
    expect(output).toContain("NLOC");
  });

  it("emits triage hints when rules match (default)", () => {
    const output = renderCompareTable(
      loadCompareResult(
        "compare-baseline-file.json",
        "compare-current-file.json",
      ),
    );

    expect(output).toContain("Triage hints");
    expect(output).toContain("src/new.ts");
    expect(output).toContain(
      "New dual-signal hotspot vs baseline — NCLOC and churn both elevated; prioritize review.",
    );
    const triageIndex = output.indexOf("Triage hints");
    const glossaryIndex = output.indexOf("Glossary");
    expect(triageIndex).toBeGreaterThan(-1);
    expect(glossaryIndex).toBeGreaterThan(triageIndex);
  });

  it("omits triage section when triageHints is false", () => {
    const output = renderCompareTable(
      loadCompareResult(
        "compare-baseline-file.json",
        "compare-current-file.json",
      ),
      { triageHints: false },
    );

    expect(output).not.toContain("Triage hints");
    expect(output).toContain("Glossary");
  });

  it("applies color to score cells when enabled", () => {
    const result = loadCompareResult(
      "compare-baseline-file.json",
      "compare-current-file.json",
    );
    const colored = renderCompareTable(result, { color: true });
    const plain = renderCompareTable(result, { color: false });

    expect(colored).not.toBe(plain);
    expect(stripAnsi(colored)).toBe(plain);
  });

  it("uses full result for summary shown-vs-total after slice", () => {
    const full = loadCompareResult(
      "compare-baseline-file.json",
      "compare-current-file.json",
    );
    const displayed = sliceCompareResult(full, 1);
    const output = renderCompareTable(displayed, { full });

    expect(output).toContain(
      "Hotspot deltas: showing 3 of 3 (new 1, removed 1, rank changed 1)",
    );
  });

  it("renders compare warnings with severity and optional code", () => {
    const baseline = JSON.parse(
      readFileSync(join(fixturesDir, "compare-baseline-file.json"), "utf8"),
    ) as ScanResult;
    const current = JSON.parse(
      readFileSync(join(fixturesDir, "compare-current-file.json"), "utf8"),
    ) as ScanResult;
    const result = compareScanResults(baseline, current);
    result.meta.warnings = [
      {
        severity: "warning",
        code: "COMPARE_SINCE_MISMATCH",
        message: "baseline window differs",
      },
      {
        severity: "info",
        message: "stale baseline",
      },
    ];

    const output = renderCompareTable(result);

    expect(output).toContain(
      "warning: [COMPARE_SINCE_MISMATCH] baseline window differs",
    );
    expect(output).toContain("info: stale baseline");
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
    expect(renderCompareTable(identical)).toContain("No rank changes");
    expect(renderCompareTable(identical)).not.toContain("showing 0 of 0");
  });

  it("renders rank-changed metric deltas alongside baseline entity columns", () => {
    const result = loadCompareResult(
      "compare-baseline-file.json",
      "compare-current-file.json",
    );
    const output = renderCompareTable(result);
    const rankChanged = result.hotspots.rankChanged[0]!;

    expect(rankChanged.entity.filePath).toBe("src/hot.ts");
    expect(rankChanged.scoreDelta).toBe(0);
    expect(rankChanged.nclocDelta).toBe(0);
    expect(rankChanged.commitCountDelta).toBe(0);
    expect(output).toContain("0.0000");
    expect(output).toContain(rankChanged.entity.hotspotScore.toFixed(4));
  });

  it("truncates long file paths with middle-ellipsis matching scan table", () => {
    const longPath = "src/very/long/path/that/exceeds/column/width.ts";
    const fileWidth = 24;
    const expectedCell = formatFileColumn(longPath, fileWidth);
    const baseline = JSON.parse(
      readFileSync(join(fixturesDir, "compare-baseline-file.json"), "utf8"),
    ) as ScanResult;
    const current: ScanResult = {
      ...baseline,
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
        ...baseline.meta,
        scannedAt: "2026-07-22T12:00:00.000Z",
      },
    };
    const result = compareScanResults(baseline, current);
    const output = renderCompareTable(result, {
      stdoutColumns: 80,
      triageHints: false,
    });

    expect(output).toContain(expectedCell.trimEnd());
    expect(output).toContain("…");
    expect(output).toContain("width.ts");
    expect(output).not.toContain(longPath);
  });
});
