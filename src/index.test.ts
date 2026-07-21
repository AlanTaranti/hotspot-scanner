import { describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "./index.js";

describe("package", () => {
  it("exports package name", () => {
    expect(PACKAGE_NAME).toBe("@vitals/hotspot-scanner");
  });
});
