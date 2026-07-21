import { describe, expect, it } from "vitest";
import { createGitMiner } from "./index.js";

describe("createGitMiner", () => {
  it("throws not implemented error", () => {
    expect(() => createGitMiner()).toThrow(/not implemented/i);
    expect(() => createGitMiner()).toThrow(/Milestone 2/i);
  });
});
