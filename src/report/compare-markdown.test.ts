import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compareScanResults } from "../compare/compare.js";
import type { ScanResult } from "../types/index.js";
import { renderCompareMarkdown } from "./compare-markdown.js";

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

describe("renderCompareMarkdown", () => {
  it("renders markdown with GFM sections", () => {
    const output = renderCompareMarkdown(
      loadCompareResult(
        "compare-baseline-file.json",
        "compare-current-file.json",
      ),
    );

    expect(output).toContain("# Hotspot Scanner — Compare Report");
    expect(output).toContain("## New Hotspots");
    expect(output).toContain("## Rank Changed Hotspots");
  });

  it("includes executive summary and how-to-read before tables", () => {
    const output = renderCompareMarkdown(
      loadCompareResult(
        "compare-baseline-file.json",
        "compare-current-file.json",
      ),
    );

    const summaryIndex = output.indexOf("Baseline since:");
    const howToReadIndex = output.indexOf("## How to read this");
    const tableIndex = output.indexOf("## New Hotspots");

    expect(summaryIndex).toBeGreaterThan(-1);
    expect(howToReadIndex).toBeGreaterThan(summaryIndex);
    expect(tableIndex).toBeGreaterThan(howToReadIndex);
    expect(output).toContain("Compare reports use the same metrics");
    expect(output).toContain("**Score** —");
  });

  it("emits triage hints when rules match (default)", () => {
    const output = renderCompareMarkdown(
      loadCompareResult(
        "compare-baseline-file.json",
        "compare-current-file.json",
      ),
    );

    expect(output).toContain("## Triage hints");
    expect(output).toContain("src/new.ts");
    expect(output).toContain(
      "New dual-signal hotspot vs baseline — complexity and churn both elevated; prioritize review.",
    );
    const hotspotsIndex = output.indexOf("## Rank Changed Hotspots");
    const triageIndex = output.indexOf("## Triage hints");
    expect(triageIndex).toBeGreaterThan(hotspotsIndex);
  });

  it("omits triage section when triageHints is false", () => {
    const output = renderCompareMarkdown(
      loadCompareResult(
        "compare-baseline-file.json",
        "compare-current-file.json",
      ),
      { triageHints: false },
    );

    expect(output).not.toContain("## Triage hints");
    expect(output).not.toContain("Triage hints");
  });

  it("omits hotspot sections when --only functions in file mode", () => {
    const output = renderCompareMarkdown(
      loadCompareResult(
        "compare-baseline-file.json",
        "compare-current-file.json",
      ),
      { only: ["functions"] },
    );

    expect(output).not.toContain("## New Hotspots");
    expect(output).toContain("## New Functions");
  });

  it("escapes pipe characters in markdown cells", () => {
    const baseline = JSON.parse(
      readFileSync(join(fixturesDir, "compare-baseline-file.json"), "utf8"),
    ) as ScanResult;
    const current = JSON.parse(
      readFileSync(join(fixturesDir, "compare-current-file.json"), "utf8"),
    ) as ScanResult;
    const withPipe: ScanResult = {
      ...current,
      hotspots: [
        {
          ...current.hotspots[0]!,
          filePath: "src/pipe|file.ts",
        },
        ...current.hotspots.slice(1),
      ],
    };

    const result = compareScanResults(baseline, withPipe);
    const output = renderCompareMarkdown(result);
    expect(output).toContain("src/pipe\\|file.ts");
  });

  it("renders function mode markdown sections", () => {
    const output = renderCompareMarkdown(
      loadCompareResult(
        "compare-baseline-function.json",
        "compare-current-function.json",
      ),
    );

    expect(output).toContain("## New Functions");
    expect(output).toContain("## Rank Changed Functions");
  });

  it("renders compare warnings as blockquotes with severity", () => {
    const baseline = JSON.parse(
      readFileSync(join(fixturesDir, "compare-baseline-file.json"), "utf8"),
    ) as ScanResult;
    const current = JSON.parse(
      readFileSync(join(fixturesDir, "compare-current-file.json"), "utf8"),
    ) as ScanResult;
    const result = compareScanResults(baseline, current);
    result.meta.warnings = [
      {
        severity: "error",
        code: "COMPARE_SINCE_MISMATCH",
        message: "baseline window differs",
      },
    ];

    const output = renderCompareMarkdown(result);

    expect(output).toContain(
      "> error: [COMPARE_SINCE_MISMATCH] baseline window differs",
    );
  });

  it("renders empty sections as _No results._", () => {
    const baseline = JSON.parse(
      readFileSync(join(fixturesDir, "compare-baseline-file.json"), "utf8"),
    ) as ScanResult;
    const result = compareScanResults(baseline, {
      ...baseline,
      meta: { ...baseline.meta, scannedAt: "2026-07-22T11:00:00.000Z" },
    });

    expect(renderCompareMarkdown(result)).toContain("_No results._");
  });
});
