import { describe, expect, it } from "vitest";
import { PACKAGE_NAME, runScan } from "./index.js";

describe("package", () => {
  it("exports package name", () => {
    expect(PACKAGE_NAME).toBe("@vitals/hotspot-scanner");
  });

  it("exports runScan", () => {
    expect(typeof runScan).toBe("function");
  });
});
