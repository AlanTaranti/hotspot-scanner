import { describe, expect, it } from "vitest";
import { normalizeLogMinMax } from "./normalize.js";

describe("normalizeLogMinMax", () => {
  it("returns empty array for empty input", () => {
    expect(normalizeLogMinMax([])).toEqual([]);
  });

  it("returns [0] for single-element array (degenerate)", () => {
    expect(normalizeLogMinMax([42])).toEqual([0]);
  });

  it("returns all zeros when all values are equal", () => {
    expect(normalizeLogMinMax([5, 5, 5])).toEqual([0, 0, 0]);
  });

  it("applies log1p then min-max for varied values", () => {
    const values = [0, 1, 9];
    const transformed = values.map((value) => Math.log1p(value));
    const min = Math.min(...transformed);
    const max = Math.max(...transformed);
    const expected = transformed.map((value) => (value - min) / (max - min));

    expect(normalizeLogMinMax(values)).toEqual(expected);
  });

  it("handles zero inputs without NaN", () => {
    const result = normalizeLogMinMax([0, 0, 10]);
    expect(result.every((value) => Number.isFinite(value))).toBe(true);
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(0);
    expect(result[2]).toBe(1);
  });
});
