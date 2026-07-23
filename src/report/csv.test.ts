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

describe("renderCsv", () => {
  it("renders metadata block with key,value header", () => {
    const output = renderCsv(loadFixture());

    expect(output).toContain("Metadata");
    expect(output).toContain("key,value");
    expect(output).toContain("scan_window,6 months ago");
    expect(output).toContain("scanned_at,2026-07-22T11:00:00.000Z");
  });

  it("omits granularity row for file mode", () => {
    const output = renderCsv(loadFixture());

    expect(output).not.toContain("granularity,file");
  });

  it("renders Top Hotspots section with correct columns and formatting", () => {
    const output = renderCsv(loadFixture());

    expect(output).toContain("Top Hotspots");
    expect(output).toContain(
      "rank,file,score,cpx,cpxN,churn,churnN,funcs,authors,lines",
    );
    expect(output).toContain(
      "1,src/hot.ts,0.8500,42,0.9000,15,0.9444,8,3,320",
    );
    expect(output).toContain(
      "3,src/cold.ts,0.0200,3,0.1000,2,0.2000,1,1,15",
    );
  });

  it("renders Top Coupling Pairs section", () => {
    const output = renderCsv(loadFixture());

    expect(output).toContain("Top Coupling Pairs");
    expect(output).toContain("rank,fileA,fileB,strength,coChanges");
    expect(output).toContain("1,src/a.ts,src/b.ts,0.7500,5");
  });

  it("renders Top Functions section in function mode", () => {
    const output = renderCsv(loadFunctionFixture());

    expect(output).toContain("granularity,function");
    expect(output).toContain("Top Functions");
    expect(output).not.toContain("Top Hotspots");
    expect(output).toContain(
      "rank,file,function,line,score,cpx,cpxN,churn,churnN,authors,lines",
    );
    expect(output).toContain(
      "1,src/hot.ts,processOrder,42,0.8200,15,0.8500,12,0.7900,3,280",
    );
  });

  it("renders empty sections with title and header only", () => {
    const output = renderCsv({
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

    expect(output).toContain("Top Hotspots");
    expect(output).toContain(
      "rank,file,score,cpx,cpxN,churn,churnN,funcs,authors,lines",
    );
    expect(output).toContain("Top Coupling Pairs");
    expect(output).toContain("rank,fileA,fileB,strength,coChanges");
    const hotspotDataRows = output
      .split("Top Hotspots")[1]
      ?.split("Top Coupling Pairs")[0]
      ?.split("\n")
      .filter((line) => line.startsWith("1,") || line.startsWith("2,"));
    expect(hotspotDataRows).toHaveLength(0);
  });

  it("escapes file paths with special characters", () => {
    const output = renderCsv({
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

    expect(output).toContain('"src/""weird"",path.ts"');
  });
});
