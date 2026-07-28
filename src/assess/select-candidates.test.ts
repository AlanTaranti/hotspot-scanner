import { describe, expect, it } from "vitest";
import type { HotspotScore } from "#types";
import { selectAssessCandidates } from "./select-candidates.js";
import {
  ASSESS_RESULT_KIND,
  ASSESS_RESULT_VERSION,
  DEFAULT_MIN_HOTSPOT_SCORE,
} from "./types.js";

function makeHotspot(overrides: Partial<HotspotScore> = {}): HotspotScore {
  return {
    filePath: "src/hot.ts",
    complexityNormalized: 0.9,
    churnNormalized: 0.9,
    hotspotScore: 0.85,
    ncloc: 42,
    commitCount: 15,
    linesChanged: 320,
    authorCount: 3,
    ...overrides,
  };
}

describe("selectAssessCandidates", () => {
  it("returns an empty array for empty input", () => {
    expect(
      selectAssessCandidates([], {
        minHotspotScore: DEFAULT_MIN_HOTSPOT_SCORE,
        top: 20,
      }),
    ).toEqual([]);
  });

  it("excludes hotspots below minHotspotScore and includes scores at the floor", () => {
    const hotspots = [
      makeHotspot({ filePath: "src/low.ts", hotspotScore: 0.69 }),
      makeHotspot({ filePath: "src/at-floor.ts", hotspotScore: 0.7 }),
      makeHotspot({ filePath: "src/high.ts", hotspotScore: 0.9 }),
    ];

    expect(
      selectAssessCandidates(hotspots, {
        minHotspotScore: 0.7,
        top: 20,
      }).map((row) => row.filePath),
    ).toEqual(["src/high.ts", "src/at-floor.ts"]);
  });

  it("sorts by hotspotScore descending then filePath ascending on ties", () => {
    const hotspots = [
      makeHotspot({ filePath: "src/z.ts", hotspotScore: 0.8 }),
      makeHotspot({ filePath: "src/a.ts", hotspotScore: 0.8 }),
      makeHotspot({ filePath: "src/top.ts", hotspotScore: 0.95 }),
      makeHotspot({ filePath: "src/mid.ts", hotspotScore: 0.75 }),
    ];

    expect(
      selectAssessCandidates(hotspots, {
        minHotspotScore: 0,
        top: 20,
      }).map((row) => row.filePath),
    ).toEqual(["src/top.ts", "src/a.ts", "src/z.ts", "src/mid.ts"]);
  });

  it("caps results to top after filter and sort", () => {
    const hotspots = [
      makeHotspot({ filePath: "src/one.ts", hotspotScore: 0.9 }),
      makeHotspot({ filePath: "src/two.ts", hotspotScore: 0.85 }),
      makeHotspot({ filePath: "src/three.ts", hotspotScore: 0.8 }),
      makeHotspot({ filePath: "src/four.ts", hotspotScore: 0.75 }),
    ];

    expect(
      selectAssessCandidates(hotspots, {
        minHotspotScore: 0.7,
        top: 2,
      }).map((row) => row.filePath),
    ).toEqual(["src/one.ts", "src/two.ts"]);
  });
});

describe("assess types constants", () => {
  it("exports version and kind string consts for schema parity", () => {
    expect(ASSESS_RESULT_VERSION).toBe("1.0");
    expect(ASSESS_RESULT_KIND).toBe("hotspot-assess");
    expect(DEFAULT_MIN_HOTSPOT_SCORE).toBe(0.7);
  });
});
