import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TREND_TABLE_LEGEND } from "../trend/metric-legend.js";
import type { ComplexityTrendResult } from "../trend/types.js";
import { renderTrendCsv } from "./trend-csv.js";
import { renderTrendJson } from "./trend-json.js";
import { renderTrendTable } from "./trend-table.js";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures/report/sample-trend-result.json",
);

function loadFixture(): ComplexityTrendResult {
  return JSON.parse(readFileSync(fixturePath, "utf8")) as ComplexityTrendResult;
}

describe("trend reporters", () => {
  const fixture = loadFixture();

  it("renders table with sparklines and legend", () => {
    const output = renderTrendTable(fixture);
    expect(output).toContain("Complexity trend: src/example.ts");
    expect(output).toContain(TREND_TABLE_LEGEND);
    expect(output).toContain("indent_mean ▁█");
    expect(output).toContain("ncloc       ▁█");
    expect(output).toContain("abc123");
    expect(output).not.toContain("follow=");
    expect(output).not.toContain("indentLines");
  });

  it("shows indentLines column when it differs from ncloc", () => {
    const withCommentOnlyLine = structuredClone(fixture);
    withCommentOnlyLine.points[0]!.indentLines = 5;
    withCommentOnlyLine.points[0]!.ncloc = 3;

    const output = renderTrendTable(withCommentOnlyLine);
    expect(output).toContain("indentLines");
    expect(output).toContain("       5");
  });

  it("renders json with schema and metricLegend", () => {
    const output = renderTrendJson(fixture);
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed.$schema).toContain("complexity-trend.json");
    expect(parsed.kind).toBe("complexity-trend");
    expect(parsed.version).toBe("2.0");
    const meta = parsed.meta as {
      sparklines: { indentMean: string };
      metricLegend: Record<string, string>;
    };
    expect(meta.sparklines.indentMean).toBeDefined();
    expect(meta.metricLegend.indentMean).toContain("indent depth");
  });

  it("renders csv without sparkline columns", () => {
    const output = renderTrendCsv(fixture);
    const [header] = output.trim().split("\n");
    expect(header).toBe(
      "rev,date,indentLines,indentTotal,indentMean,indentSd,indentMax,ncloc",
    );
    expect(output).not.toContain("sparkline");
  });

  it("renders csv with empty date when point has no date", () => {
    const withoutDate = structuredClone(fixture);
    delete withoutDate.points[0]!.date;
    const output = renderTrendCsv(withoutDate);
    expect(output).toContain("abc123,,");
  });

  it("renders table when point has no date", () => {
    const withoutDate = structuredClone(fixture);
    delete withoutDate.points[0]!.date;
    const output = renderTrendTable(withoutDate);
    expect(output).toContain("abc123");
  });

  it("renders start..end range in header", () => {
    const withRange = structuredClone(fixture);
    withRange.meta.start = "abc";
    withRange.meta.end = "def";
    delete withRange.meta.since;
    const output = renderTrendTable(withRange);
    expect(output).toContain("abc..def");
  });
});
