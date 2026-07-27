import { describe, expect, it } from "vitest";
import { sparkline } from "./sparkline.js";

describe("sparkline", () => {
  it("returns empty string for empty input", () => {
    expect(sparkline([])).toBe("");
  });

  it("maps monotonic series across glyphs", () => {
    expect(sparkline([0, 1, 2, 3, 4, 5, 6, 7])).toBe("▁▂▃▄▅▆▇█");
  });

  it("uses mid glyph for constant series", () => {
    expect(sparkline([5, 5, 5])).toBe("▄▄▄");
  });

  it("scales arbitrary ranges", () => {
    const result = sparkline([10, 20, 30]);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe("▁");
    expect(result.at(-1)).toBe("█");
  });

  it("handles single value", () => {
    expect(sparkline([42])).toBe("▄");
  });
});
