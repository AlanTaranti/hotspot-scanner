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

function loadFixture(): ScanResult {
  return JSON.parse(readFileSync(fixturePath, "utf8")) as ScanResult;
}

describe("renderCsv", () => {
  it("returns CsvBundle with meta.json and hotspots.csv only", () => {
    const bundle = renderCsv(loadFixture());

    expect(bundle).toHaveProperty("meta.json");
    expect(bundle).toHaveProperty("hotspots.csv");
    expect(bundle).not.toHaveProperty("functions.csv");
    expect(Object.keys(bundle).sort()).toEqual(["hotspots.csv", "meta.json"]);
  });

  it("meta.json is parseable scan metadata without granularity", () => {
    const bundle = renderCsv(loadFixture());
    const meta = JSON.parse(bundle["meta.json"]!) as {
      kind: string;
      scan_window: string;
      scanned_at: string;
      granularity?: string;
    };

    expect(meta.kind).toBe("scan");
    expect(meta.scan_window).toBe("6 months ago");
    expect(meta.scanned_at).toBe("2026-07-22T11:00:00.000Z");
    expect(meta.granularity).toBeUndefined();
  });

  it("hotspots.csv has header row only at start (no title row)", () => {
    const bundle = renderCsv(loadFixture());
    const lines = bundle["hotspots.csv"]!.split("\n");

    expect(lines[0]).toBe(
      "rank,file,score,ncloc,nclocN,churn,churnN,authors,lines",
    );
    expect(lines[1]).toBe(
      "1,src/hot.ts,0.8500,42,0.9000,15,0.9444,3,320",
    );
    expect(lines[3]).toBe(
      "3,src/cold.ts,0.0200,3,0.1000,2,0.2000,1,15",
    );
  });

  it("renders empty sections as header-only CSV files", () => {
    const bundle = renderCsv({
      version: "3.0",
      hotspots: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-07-22T12:00:00.000Z",
        warnings: [],
      },
    });

    const hotspotLines = bundle["hotspots.csv"]!.split("\n");
    expect(hotspotLines).toHaveLength(1);
    expect(hotspotLines[0]).toBe(
      "rank,file,score,ncloc,nclocN,churn,churnN,authors,lines",
    );
  });

  it("escapes file paths with special characters", () => {
    const bundle = renderCsv({
      version: "3.0",
      hotspots: [
        {
          filePath: 'src/"weird",path.ts',
          complexityNormalized: 0.5,
          churnNormalized: 0.5,
          hotspotScore: 0.5,
          ncloc: 10,
          commitCount: 5,
          linesChanged: 50,
          authorCount: 1,
        },
      ],
      meta: {
        since: "6 months ago",
        scannedAt: "2026-07-22T11:00:00.000Z",
        warnings: [],
      },
    });

    expect(bundle["hotspots.csv"]).toContain('"src/""weird"",path.ts"');
  });
});
