import { describe, expect, it } from "vitest";
import { functionStatsKey, parseFunctionStatsKey } from "./keys.js";

describe("functionStatsKey", () => {
  it("builds and parses a stable function identity key", () => {
    const key = functionStatsKey("src/a.ts", "foo", 10);
    expect(key).toContain("src/a.ts");
    expect(key).toContain("foo");
    expect(parseFunctionStatsKey(key)).toEqual({
      filePath: "src/a.ts",
      functionName: "foo",
      line: 10,
    });
  });
});
