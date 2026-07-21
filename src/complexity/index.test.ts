import { describe, expect, it } from "vitest";
import { createComplexityAnalyzer } from "./index.js";

describe("createComplexityAnalyzer", () => {
  it("throws not implemented error", () => {
    expect(() => createComplexityAnalyzer()).toThrow(/not implemented/i);
    expect(() => createComplexityAnalyzer()).toThrow(/Milestone 3/i);
  });
});
