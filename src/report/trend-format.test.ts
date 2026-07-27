import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
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

  it("renders table with sparklines", () => {
    const output = renderTrendTable(fixture);
    expect(output).toContain("Complexity trend: src/example.ts");
    expect(output).toContain("mean  ▁█");
    expect(output).toContain("ncloc ▁█");
    expect(output).toContain("abc123");
  });

  it("renders json with schema", () => {
    const output = renderTrendJson(fixture);
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed.$schema).toContain("complexity-trend.json");
    expect(parsed.kind).toBe("complexity-trend");
    expect((parsed.meta as { sparklines: unknown }).sparklines).toBeDefined();
  });

  it("renders csv without sparkline columns", () => {
    const output = renderTrendCsv(fixture);
    const [header] = output.trim().split("\n");
    expect(header).toBe("rev,date,n,total,mean,sd,max,ncloc");
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
