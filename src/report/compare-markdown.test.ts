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
      loadCompareResult("compare-baseline-file.json", "compare-current-file.json"),
    );

    expect(output).toContain("# Hotspot Scanner — Compare Report");
    expect(output).toContain("## New Hotspots");
    expect(output).toContain("## Rank Changed Hotspots");
    expect(output).toContain("## New Coupling Pairs");
  });

  it("renders Has static column in coupling tables", () => {
    const output = renderCompareMarkdown(
      loadCompareResult("compare-baseline-file.json", "compare-current-file.json"),
    );

    expect(output).toContain("| Has static |");
    expect(output).toContain("| yes |");
    expect(output).toContain("| no |");
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
