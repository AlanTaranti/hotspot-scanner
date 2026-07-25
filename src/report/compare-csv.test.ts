import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compareScanResults } from "../compare/compare.js";
import type { ScanResult, ScanWarning } from "../types/index.js";
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

const COUPLING_CSV_HEADER =
  "rank,fileA,fileB,strength,coChanges,hasStaticDependency,staticDependencyDirection,hasRuntimeStaticDependency,hasTypeOnlyStaticDependency,hasReExportStaticDependency";
const RANK_CHANGED_COUPLING_CSV_HEADER =
  "baselineRank,currentRank,rankDelta,fileA,fileB,strength,coChanges,hasStaticDependency,staticDependencyDirection,hasRuntimeStaticDependency,hasTypeOnlyStaticDependency,hasReExportStaticDependency";

describe("renderCompareCsv", () => {
  it("returns CsvBundle with meta.json and six data files in file mode", () => {
    const bundle = renderCompareCsv(
      loadCompareResult(
        "compare-baseline-file.json",
        "compare-current-file.json",
      ),
    );

    expect(bundle).toHaveProperty("meta.json");
    expect(bundle).toHaveProperty("hotspots.new.csv");
    expect(bundle).toHaveProperty("hotspots.removed.csv");
    expect(bundle).toHaveProperty("hotspots.rank-changed.csv");
    expect(bundle).toHaveProperty("coupling.new.csv");
    expect(bundle).toHaveProperty("coupling.removed.csv");
    expect(bundle).toHaveProperty("coupling.rank-changed.csv");
    expect(bundle).not.toHaveProperty("functions.new.csv");
  });

  it("omits excluded section files when --only coupling", () => {
    const bundle = renderCompareCsv(
      loadCompareResult(
        "compare-baseline-file.json",
        "compare-current-file.json",
      ),
      { only: ["coupling"] },
    );

    expect(bundle).toHaveProperty("meta.json");
    expect(bundle).toHaveProperty("coupling.new.csv");
    expect(bundle).not.toHaveProperty("hotspots.new.csv");
    expect(bundle).not.toHaveProperty("functions.new.csv");
  });

  it("meta.json is parseable compare metadata", () => {
    const bundle = renderCompareCsv(
      loadCompareResult(
        "compare-baseline-file.json",
        "compare-current-file.json",
      ),
    );
    const meta = JSON.parse(bundle["meta.json"]!) as {
      kind: string;
      granularity: string;
      baseline_scanned_at: string;
      current_scanned_at: string;
      warnings: ScanWarning[];
    };

    expect(meta.kind).toBe("compare");
    expect(meta.granularity).toBe("file");
    expect(meta.baseline_scanned_at).toBeDefined();
    expect(meta.current_scanned_at).toBeDefined();
    expect(Array.isArray(meta.warnings)).toBe(true);
  });

  it("file mode data CSVs have header rows without title rows", () => {
    const bundle = renderCompareCsv(
      loadCompareResult(
        "compare-baseline-file.json",
        "compare-current-file.json",
      ),
    );

    expect(bundle["hotspots.new.csv"]!.split("\n")[0]).toBe(
      "rank,file,score,cpx,cpxN,churn,churnN,funcs,authors,parseFailed",
    );
    expect(bundle["hotspots.rank-changed.csv"]!.split("\n")[0]).toBe(
      "baselineRank,currentRank,rankDelta,file,score,cpx,cpxN,churn,churnN,funcs,authors,parseFailed",
    );
    expect(bundle["coupling.new.csv"]!.split("\n")[0]).toBe(COUPLING_CSV_HEADER);
    expect(bundle["coupling.rank-changed.csv"]!.split("\n")[0]).toBe(
      RANK_CHANGED_COUPLING_CSV_HEADER,
    );
  });

  it("renders function mode with functions.* keys instead of hotspots.*", () => {
    const bundle = renderCompareCsv(
      loadCompareResult(
        "compare-baseline-function.json",
        "compare-current-function.json",
      ),
    );

    expect(bundle).toHaveProperty("functions.new.csv");
    expect(bundle).toHaveProperty("functions.removed.csv");
    expect(bundle).toHaveProperty("functions.rank-changed.csv");
    expect(bundle).not.toHaveProperty("hotspots.new.csv");
    const meta = JSON.parse(bundle["meta.json"]!) as { granularity: string };
    expect(meta.granularity).toBe("function");
  });

  it("renders removed sections with empty rank cell", () => {
    const bundle = renderCompareCsv(
      loadCompareResult(
        "compare-baseline-file.json",
        "compare-current-file.json",
      ),
    );

    const lines = bundle["hotspots.removed.csv"]!.split("\n").slice(1);
    const dataRows = lines.filter(
      (line) => line.includes("src/") && line.startsWith(","),
    );
    expect(dataRows.length).toBeGreaterThan(0);
  });

  it("renders rank-changed rows with baselineRank, currentRank, rankDelta", () => {
    const bundle = renderCompareCsv(
      loadCompareResult(
        "compare-baseline-file.json",
        "compare-current-file.json",
      ),
    );

    const lines = bundle["hotspots.rank-changed.csv"]!.split("\n").slice(1);
    const dataRows = lines.filter((line) => /^\d+,\d+,-?\d+,/.test(line));
    expect(dataRows.length).toBeGreaterThan(0);
  });

  it("renders empty sections as header-only CSV files", () => {
    const baseline = JSON.parse(
      readFileSync(join(fixturesDir, "compare-baseline-file.json"), "utf8"),
    ) as ScanResult;
    const result = compareScanResults(baseline, {
      ...baseline,
      meta: { ...baseline.meta, scannedAt: "2026-07-22T11:00:00.000Z" },
    });

    const bundle = renderCompareCsv(result);
    const lines = bundle["hotspots.new.csv"]!.split("\n");

    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(
      "rank,file,score,cpx,cpxN,churn,churnN,funcs,authors,parseFailed",
    );
  });

  it("includes warnings array in meta.json", () => {
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

    const bundle = renderCompareCsv(result);
    const meta = JSON.parse(bundle["meta.json"]!) as { warnings: ScanWarning[] };

    expect(meta.warnings).toEqual([
      {
        severity: "warning",
        code: "COMPARE_SINCE_MISMATCH",
        message: "baseline window differs",
      },
      {
        severity: "info",
        message: "stale baseline",
      },
    ]);
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

    const bundle = renderCompareCsv(compareScanResults(baseline, withSpecial));
    const allContent = Object.values(bundle).join("\n");
    expect(allContent).toContain('"src/""weird"",path.ts"');
  });
});
