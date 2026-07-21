import { describe, expect, it } from "vitest";
import {
  createHotspotScorer,
  createTemporalCouplingScorer,
} from "./index.js";

describe("scoring stubs", () => {
  it("createHotspotScorer throws not implemented error", () => {
    expect(() => createHotspotScorer()).toThrow(/not implemented/i);
    expect(() => createHotspotScorer()).toThrow(/Milestone 4/i);
  });

  it("createTemporalCouplingScorer throws not implemented error", () => {
    expect(() => createTemporalCouplingScorer()).toThrow(/not implemented/i);
    expect(() => createTemporalCouplingScorer()).toThrow(/Milestone 4/i);
  });
});
