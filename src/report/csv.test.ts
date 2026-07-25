import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ScanResult } from "../types/index.js";
import { renderCsv } from "./csv.js";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures/report/sample-result.json",
);
const functionFixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures/report/sample-result-functions.json",
);

function loadFixture(): ScanResult {
  return JSON.parse(readFileSync(fixturePath, "utf8")) as ScanResult;
}

function loadFunctionFixture(): ScanResult {
  return JSON.parse(readFileSync(functionFixturePath, "utf8")) as ScanResult;
}

const COUPLING_CSV_HEADER =
  "rank,fileA,fileB,strength,coChanges,hasStaticDependency,staticDependencyDirection,hasRuntimeStaticDependency,hasTypeOnlyStaticDependency,hasReExportStaticDependency";

describe("renderCsv", () => {
  it("returns CsvBundle with meta.json, hotspots.csv, and coupling.csv in file mode", () => {
    const bundle = renderCsv(loadFixture());

    expect(bundle).toHaveProperty("meta.json");
    expect(bundle).toHaveProperty("hotspots.csv");
    expect(bundle).toHaveProperty("coupling.csv");
    expect(bundle).not.toHaveProperty("functions.csv");
  });

  it("meta.json is parseable scan metadata", () => {
    const bundle = renderCsv(loadFixture());
    const meta = JSON.parse(bundle["meta.json"]!) as {
      kind: string;
      scan_window: string;
      scanned_at: string;
      granularity: string;
    };

    expect(meta.kind).toBe("scan");
    expect(meta.scan_window).toBe("6 months ago");
    expect(meta.scanned_at).toBe("2026-07-22T11:00:00.000Z");
    expect(meta.granularity).toBe("file");
  });

  it("hotspots.csv has header row only at start (no title row)", () => {
    const bundle = renderCsv(loadFixture());
    const lines = bundle["hotspots.csv"]!.split("\n");

    expect(lines[0]).toBe(
      "rank,file,score,cpx,cpxN,churn,churnN,funcs,authors,lines,parseFailed",
    );
    expect(lines[1]).toBe(
      "1,src/hot.ts,0.8500,42,0.9000,15,0.9444,8,3,320,false",
    );
    expect(lines[3]).toBe(
      "3,src/cold.ts,0.0200,3,0.1000,2,0.2000,1,1,15,false",
    );
  });

  it("coupling.csv has correct header and data", () => {
    const bundle = renderCsv(loadFixture());

    expect(bundle["coupling.csv"]).toContain(COUPLING_CSV_HEADER);
    expect(bundle["coupling.csv"]).toContain(
      "1,src/a.ts,src/b.ts,0.7500,5,true,a-to-b,true,false,false",
    );
    expect(bundle["coupling.csv"]).toContain(
      "2,src/c.ts,src/d.ts,0.5000,3,false,none,false,false,false",
    );
  });

  it("returns functions.csv instead of hotspots.csv in function mode", () => {
    const bundle = renderCsv(loadFunctionFixture());

    expect(bundle).toHaveProperty("functions.csv");
    expect(bundle).not.toHaveProperty("hotspots.csv");
    const meta = JSON.parse(bundle["meta.json"]!) as { granularity: string };
    expect(meta.granularity).toBe("function");
    expect(bundle["functions.csv"]).toContain(
      "rank,file,function,line,score,cpx,cpxN,churn,churnN,authors,lines",
    );
    expect(bundle["functions.csv"]).toContain(
      "1,src/hot.ts,processOrder,42,0.8200,15,0.8500,12,0.7900,3,280",
    );
  });

  it("renders empty sections as header-only CSV files", () => {
    const bundle = renderCsv({
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

    const hotspotLines = bundle["hotspots.csv"]!.split("\n");
    expect(hotspotLines).toHaveLength(1);
    expect(hotspotLines[0]).toBe(
      "rank,file,score,cpx,cpxN,churn,churnN,funcs,authors,lines,parseFailed",
    );

    const couplingLines = bundle["coupling.csv"]!.split("\n");
    expect(couplingLines).toHaveLength(1);
    expect(couplingLines[0]).toBe(COUPLING_CSV_HEADER);
  });

  it("omits non-selected data files when only is set", () => {
    const bundle = renderCsv(loadFixture(), { only: ["coupling"] });

    expect(bundle).toHaveProperty("meta.json");
    expect(bundle).toHaveProperty("coupling.csv");
    expect(bundle).not.toHaveProperty("hotspots.csv");
    expect(bundle).not.toHaveProperty("functions.csv");
  });

  it("includes only requested CSV files for union --only", () => {
    const bundle = renderCsv(loadFixture(), {
      only: ["hotspots", "coupling"],
    });

    expect(bundle).toHaveProperty("meta.json");
    expect(bundle).toHaveProperty("hotspots.csv");
    expect(bundle).toHaveProperty("coupling.csv");
    expect(bundle).not.toHaveProperty("functions.csv");
  });

  it("omits excluded ranking CSV in function mode when only coupling", () => {
    const bundle = renderCsv(loadFunctionFixture(), { only: ["coupling"] });

    expect(bundle).toHaveProperty("meta.json");
    expect(bundle).toHaveProperty("coupling.csv");
    expect(bundle).not.toHaveProperty("functions.csv");
    expect(bundle).not.toHaveProperty("hotspots.csv");
  });

  it("escapes file paths with special characters", () => {
    const bundle = renderCsv({
      version: "1.0",
      hotspots: [
        {
          filePath: 'src/"weird",path.ts',
          complexityNormalized: 0.5,
          churnNormalized: 0.5,
          hotspotScore: 0.5,
          cyclomaticComplexity: 10,
          functionCount: 2,
          commitCount: 5,
          linesChanged: 50,
          authorCount: 1,
        },
      ],
      functions: [],
      coupling: [],
      meta: {
        since: "6 months ago",
        scannedAt: "2026-07-22T11:00:00.000Z",
        granularity: "file",
      },
    });

    expect(bundle["hotspots.csv"]).toContain('"src/""weird"",path.ts"');
  });
});
