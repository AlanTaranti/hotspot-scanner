import { describe, expect, it } from "vitest";
import { createReporter } from "./index.js";

describe("createReporter", () => {
  it("throws not implemented error", () => {
    expect(() => createReporter()).toThrow(/not implemented/i);
    expect(() => createReporter()).toThrow(/Milestone 5/i);
  });
});
