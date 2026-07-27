import { describe, expect, it } from "vitest";
import { analyzeIndentation } from "./indentation.js";

describe("analyzeIndentation", () => {
  it("returns zeros for empty source", () => {
    expect(analyzeIndentation("")).toEqual({
      n: 0,
      total: 0,
      mean: 0,
      sd: 0,
      max: 0,
    });
  });

  it("returns zeros for whitespace-only source", () => {
    expect(analyzeIndentation("  \n\t\n  \n")).toEqual({
      n: 0,
      total: 0,
      mean: 0,
      sd: 0,
      max: 0,
    });
  });

  it("counts flat lines at indent 0", () => {
    const result = analyzeIndentation("a\nb\nc");
    expect(result).toEqual({
      n: 3,
      total: 0,
      mean: 0,
      sd: 0,
      max: 0,
    });
  });

  it("counts 4 spaces as one level", () => {
    const result = analyzeIndentation("    a\n        b");
    expect(result.n).toBe(2);
    expect(result.total).toBe(3);
    expect(result.mean).toBe(1.5);
    expect(result.max).toBe(2);
  });

  it("counts tabs as one level each", () => {
    const result = analyzeIndentation("\ta\n\t\tb");
    expect(result).toEqual({
      n: 2,
      total: 3,
      mean: 1.5,
      sd: 0.5,
      max: 2,
    });
  });

  it("ignores blank lines between code", () => {
    const result = analyzeIndentation("a\n\n    b");
    expect(result.n).toBe(2);
    expect(result.total).toBe(1);
    expect(result.mean).toBe(0.5);
    expect(result.max).toBe(1);
  });

  it("handles nested indentation with sd", () => {
    const source = [
      "function x() {",
      "    if (true) {",
      "        return 1;",
      "    }",
      "}",
    ].join("\n");
    const result = analyzeIndentation(source);
    expect(result.n).toBe(5);
    expect(result.total).toBe(4);
    expect(result.mean).toBe(0.8);
    expect(result.max).toBe(2);
    expect(result.sd).toBeCloseTo(0.7483, 3);
  });

  it("treats mixed tabs and spaces", () => {
    const result = analyzeIndentation("\t    a");
    expect(result.n).toBe(1);
    expect(result.total).toBe(2);
    expect(result.max).toBe(2);
  });
});
