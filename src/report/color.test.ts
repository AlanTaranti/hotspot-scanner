import { describe, expect, it } from "vitest";
import {
  paintBold,
  paintDoctorStatus,
  paintGrowthPattern,
  paintScore,
  paintStaticDep,
  stripAnsi,
} from "./color.js";

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM_GREEN = "\x1b[2;32m";
const DIM_YELLOW = "\x1b[2;33m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

describe("paintBold", () => {
  it("returns plain text when color is disabled", () => {
    expect(paintBold("Hotspot assess", false)).toBe("Hotspot assess");
  });

  it("wraps text in bold when enabled", () => {
    expect(paintBold("Deteriorating", true)).toBe(`${BOLD}Deteriorating${RESET}`);
  });
});

describe("paintGrowthPattern", () => {
  it("returns plain kind when color is disabled", () => {
    expect(paintGrowthPattern("deteriorating", false)).toBe("deteriorating");
    expect(paintGrowthPattern("refactored", false)).toBe("refactored");
    expect(paintGrowthPattern("inconclusive", false)).toBe("inconclusive");
    expect(paintGrowthPattern("stable", false)).toBe("stable");
  });

  it("wraps deteriorating/refactored/inconclusive in red/green/yellow when enabled", () => {
    expect(paintGrowthPattern("deteriorating", true)).toBe(
      `${RED}deteriorating${RESET}`,
    );
    expect(paintGrowthPattern("refactored", true)).toBe(
      `${GREEN}refactored${RESET}`,
    );
    expect(paintGrowthPattern("inconclusive", true)).toBe(
      `${YELLOW}inconclusive${RESET}`,
    );
  });

  it("leaves stable plain when enabled", () => {
    expect(paintGrowthPattern("stable", true)).toBe("stable");
  });
});

describe("paintDoctorStatus", () => {
  it("returns plain status prefix when color is disabled", () => {
    expect(paintDoctorStatus("pass", false)).toBe("pass:");
    expect(paintDoctorStatus("warn", false)).toBe("warn:");
    expect(paintDoctorStatus("fail", false)).toBe("fail:");
  });

  it("wraps pass/warn/fail prefixes in green/yellow/red when enabled", () => {
    expect(paintDoctorStatus("pass", true)).toBe(`${GREEN}pass:${RESET}`);
    expect(paintDoctorStatus("warn", true)).toBe(`${YELLOW}warn:${RESET}`);
    expect(paintDoctorStatus("fail", true)).toBe(`${RED}fail:${RESET}`);
  });
});

describe("paintScore", () => {
  it("returns plain formatted text when color is disabled", () => {
    expect(paintScore(0.85, false)).toBe("0.8500");
    expect(paintScore(0.5, false)).toBe("0.5000");
    expect(paintScore(0.2, false)).toBe("0.2000");
  });

  it("wraps high scores (≥0.7) in red", () => {
    expect(paintScore(0.7, true)).toBe(`${RED}0.7000${RESET}`);
    expect(paintScore(0.95, true)).toBe(`${RED}0.9500${RESET}`);
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
    expect(stripAnsi(paintDoctorStatus("pass", true))).toBe("pass:");
    expect(stripAnsi(paintDoctorStatus("warn", true))).toBe("warn:");
    expect(stripAnsi(paintDoctorStatus("fail", true))).toBe("fail:");
    expect(stripAnsi(paintGrowthPattern("deteriorating", true))).toBe(
      "deteriorating",
    );
  });

  it("returns plain text unchanged", () => {
    expect(stripAnsi("0.5000")).toBe("0.5000");
    expect(stripAnsi("yes")).toBe("yes");
  });
});
