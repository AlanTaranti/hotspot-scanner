import { describe, expect, it } from "vitest";
import type { ComplexityTrendPoint } from "./types.js";
import {
  classifyGrowthPattern,
  DETERIORATE_RISE,
  MIN_POINTS,
  REFACTOR_DROP,
  STABLE_REL_RANGE,
} from "./classify.js";

type Point = Pick<ComplexityTrendPoint, "rev" | "indentMean" | "ncloc">;

function series(
  indentMeans: number[],
  ncloc = 100,
): Point[] {
  return indentMeans.map((indentMean, index) => ({
    rev: `r${index + 1}`,
    indentMean,
    ncloc: ncloc + index,
  }));
}

describe("classifyGrowthPattern", () => {
  it("returns inconclusive when fewer than MIN_POINTS", () => {
    expect(classifyGrowthPattern([])).toMatchObject({
      kind: "inconclusive",
      summary: expect.stringContaining("insufficient history"),
    });
    expect(classifyGrowthPattern(series([1, 2, 3, 4]))).toMatchObject({
      kind: "inconclusive",
      summary: expect.stringContaining(`need ${MIN_POINTS}`),
    });
  });

  it("classifies a flat series as stable", () => {
    const result = classifyGrowthPattern(series([1, 1.01, 1.02, 1.01, 1.02]));

    expect(result.kind).toBe("stable");
    expect(result.summary).toContain("stable");
    expect(result.indentMeanDeltaRel).toBeCloseTo(0.02, 2);
    expect(result.peakRev).toBeUndefined();
  });

  it("classifies a steadily rising series as deteriorating", () => {
    const result = classifyGrowthPattern(series([1, 1.05, 1.1, 1.15, 1.2], 100));

    expect(result.kind).toBe("deteriorating");
    expect(result.summary).toContain("indentMean +20%");
    expect(result.summary).toContain("ncloc");
    expect(result.indentMeanDeltaRel).toBeGreaterThanOrEqual(DETERIORATE_RISE);
    expect(result.peakRev).toBeUndefined();
  });

  it("notes when indentMean rises faster than ncloc", () => {
    const result = classifyGrowthPattern(
      series([1, 1.05, 1.1, 1.15, 1.2], 100).map((point, index) => ({
        ...point,
        ncloc: 100 + index * 0.5,
      })),
    );

    expect(result.kind).toBe("deteriorating");
    expect(result.summary).toContain("complexity outpaced size");
  });

  it("still classifies deteriorating when ncloc grows faster than indentMean", () => {
    const result = classifyGrowthPattern(
      series([1, 1.05, 1.1, 1.15, 1.2], 100).map((point, index) => ({
        ...point,
        ncloc: 100 + index * 20,
      })),
    );

    expect(result.kind).toBe("deteriorating");
    expect(result.summary).not.toContain("complexity outpaced size");
  });

  it("classifies peak-then-drop as refactored with peakRev", () => {
    const result = classifyGrowthPattern(series([1, 1.2, 2, 1.4, 1]));

    expect(result.kind).toBe("refactored");
    expect(result.peakRev).toBe("r3");
    expect(result.summary).toContain("r3");
    expect((result.indentMeanDeltaRel ?? 0)).toBeLessThan(DETERIORATE_RISE);
    const dropFromPeak = (2 - 1) / 2;
    expect(dropFromPeak).toBeGreaterThanOrEqual(REFACTOR_DROP);
  });

  it("prefers refactored over deteriorating when both signals fire", () => {
    const result = classifyGrowthPattern(series([1, 1.4, 2, 1.6, 1.5]));

    expect(result.kind).toBe("refactored");
    expect(result.peakRev).toBe("r3");
    expect(result.indentMeanDeltaRel).toBeGreaterThanOrEqual(DETERIORATE_RISE);
  });

  it("uses the first peak index when indentMean ties at the maximum", () => {
    const result = classifyGrowthPattern(series([2, 2, 1.5, 1.4, 1.2]));

    expect(result.kind).toBe("refactored");
    expect(result.peakRev).toBe("r1");
  });

  it("returns inconclusive for mixed or weak patterns", () => {
    const result = classifyGrowthPattern(series([1, 1.12, 1.05, 1.1, 1.08]));

    expect(result.kind).toBe("inconclusive");
    expect(result.summary).toContain("no clear growth pattern");
    expect(result.indentMeanDeltaRel ?? 0).toBeLessThan(DETERIORATE_RISE);
    const relRange = (1.12 - 1) / 1.12;
    expect(relRange).toBeGreaterThan(STABLE_REL_RANGE);
  });

  it("exports locked heuristic constants", () => {
    expect(MIN_POINTS).toBe(5);
    expect(STABLE_REL_RANGE).toBe(0.08);
    expect(REFACTOR_DROP).toBe(0.18);
    expect(DETERIORATE_RISE).toBe(0.1);
  });
});
