import { describe, expect, it } from "vitest";
import { uniformSample } from "./sample.js";

describe("uniformSample", () => {
  const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  it("returns a copy when length is within max", () => {
    const result = uniformSample(items, 20);
    expect(result).toEqual(items);
    expect(result).not.toBe(items);
  });

  it("returns exact copy when length equals max", () => {
    expect(uniformSample(items, 10)).toEqual(items);
  });

  it("samples evenly including endpoints", () => {
    expect(uniformSample(items, 3)).toEqual([0, 5, 9]);
    expect(uniformSample(items, 5)).toEqual([0, 2, 5, 7, 9]);
  });

  it("returns first item when max is 1", () => {
    expect(uniformSample(items, 1)).toEqual([0]);
  });

  it("returns empty for max 0", () => {
    expect(uniformSample(items, 0)).toEqual([]);
  });

  it("is deterministic", () => {
    expect(uniformSample(items, 4)).toEqual(uniformSample(items, 4));
  });
});
