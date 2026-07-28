import { describe, expect, it } from "vitest";
import {
  PACKAGE_NAME,
  runAssess,
  runComplexityTrend,
  runScan,
} from "./index.js";

describe("package", () => {
  it("exports package name", () => {
    expect(PACKAGE_NAME).toBe("@taranti/hotspot-scanner");
  });

  it("exports runScan", () => {
    expect(typeof runScan).toBe("function");
  });

  it("exports runComplexityTrend", () => {
    expect(typeof runComplexityTrend).toBe("function");
  });

  it("exports runAssess", () => {
    expect(typeof runAssess).toBe("function");
  });
});
