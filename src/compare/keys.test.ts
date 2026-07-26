import { describe, expect, it } from "vitest";
import { hotspotKey } from "./keys.js";

describe("entity keys", () => {
  it("hotspotKey equals filePath", () => {
    expect(hotspotKey("src/hot.ts")).toBe("src/hot.ts");
  });
});
