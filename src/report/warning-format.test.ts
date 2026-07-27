import { describe, expect, it } from "vitest";
import { formatScanWarning } from "./warning-format.js";

describe("formatScanWarning", () => {
  it("formats coded warnings with severity prefix", () => {
    expect(
      formatScanWarning({
        severity: "warning",
        code: "READ_FAILED",
        message: "Could not read a.ts",
      }),
    ).toBe("warning: [READ_FAILED] Could not read a.ts");
  });

  it("omits code bracket when code is missing", () => {
    expect(
      formatScanWarning({
        severity: "info",
        message: "stale baseline",
      }),
    ).toBe("info: stale baseline");
  });
});
