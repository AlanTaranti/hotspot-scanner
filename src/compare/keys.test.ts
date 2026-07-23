import { describe, expect, it } from "vitest";
import { couplingKey, functionKey, hotspotKey } from "./keys.js";

describe("entity keys", () => {
  it("hotspotKey equals filePath", () => {
    expect(hotspotKey("src/hot.ts")).toBe("src/hot.ts");
  });

  it("functionKey composes filePath, functionName, and line", () => {
    expect(functionKey("src/hot.ts", "processOrder", 42)).toBe(
      ["src/hot.ts", "processOrder", "42"].join("\0"),
    );
  });

  it("couplingKey canonicalizes pair order", () => {
    expect(couplingKey("src/b.ts", "src/a.ts")).toBe("src/a.ts|src/b.ts");
    expect(couplingKey("src/a.ts", "src/b.ts")).toBe("src/a.ts|src/b.ts");
  });
});
