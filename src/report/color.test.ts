import { describe, expect, it } from "vitest";
import { paintScore, paintStaticDep, stripAnsi } from "./color.js";

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM_GREEN = "\x1b[2;32m";
const DIM_YELLOW = "\x1b[2;33m";
const RESET = "\x1b[0m";

describe("paintScore", () => {
  it("returns plain formatted text when color is disabled", () => {
    expect(paintScore(0.85, false)).toBe("0.8500");
    expect(paintScore(0.5, false)).toBe("0.5000");
    expect(paintScore(0.2, false)).toBe("0.2000");
  });

  it("wraps high scores (≥0.7) in green", () => {
    expect(paintScore(0.7, true)).toBe(`${GREEN}0.7000${RESET}`);
    expect(paintScore(0.95, true)).toBe(`${GREEN}0.9500${RESET}`);
  });

  it("wraps medium scores (≥0.4, <0.7) in yellow", () => {
    expect(paintScore(0.4, true)).toBe(`${YELLOW}0.4000${RESET}`);
    expect(paintScore(0.69, true)).toBe(`${YELLOW}0.6900${RESET}`);
  });

  it("leaves low scores (<0.4) uncolored when enabled", () => {
    expect(paintScore(0.39, true)).toBe("0.3900");
    expect(paintScore(0, true)).toBe("0.0000");
  });
});

describe("paintStaticDep", () => {
  it("returns plain text when color is disabled", () => {
    expect(paintStaticDep("yes", false)).toBe("yes");
    expect(paintStaticDep("no", false)).toBe("no");
  });

  it("wraps yes in dim green and no in dim yellow when enabled", () => {
    expect(paintStaticDep("yes", true)).toBe(`${DIM_GREEN}yes${RESET}`);
    expect(paintStaticDep("no", true)).toBe(`${DIM_YELLOW}no${RESET}`);
  });

  it("passes through unexpected text unchanged", () => {
    expect(paintStaticDep("maybe", true)).toBe("maybe");
  });
});

describe("stripAnsi", () => {
  it("removes ANSI sequences from painted score and static-dep cells", () => {
    expect(stripAnsi(paintScore(0.8, true))).toBe("0.8000");
    expect(stripAnsi(paintScore(0.5, true))).toBe("0.5000");
    expect(stripAnsi(paintStaticDep("yes", true))).toBe("yes");
    expect(stripAnsi(paintStaticDep("no", true))).toBe("no");
  });

  it("returns plain text unchanged", () => {
    expect(stripAnsi("0.5000")).toBe("0.5000");
    expect(stripAnsi("yes")).toBe("yes");
  });
});
