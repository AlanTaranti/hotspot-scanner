import { describe, expect, it } from "vitest";
import type { HotspotScore, ScanResult } from "../types/index.js";
import {
  TRIAGE_HOTSPOT_SCORE_THRESHOLD,
  TRIAGE_MAX_HINTS_PER_RULE,
  TRIAGE_NORMALIZED_SIGNAL_THRESHOLD,
  buildTriageHints,
  renderMarkdownTriageHints,
  renderTableTriageHints,
} from "./triage.js";

const BASE_META: ScanResult["meta"] = {
  since: "6 months ago",
  scannedAt: "2026-07-22T11:00:00.000Z",
  warnings: [],
};

function makeScanResult(
  overrides: Partial<Pick<ScanResult, "hotspots">> = {},
): ScanResult {
  return {
    version: "3.0",
    hotspots: [],
    meta: BASE_META,
    ...overrides,
  };
}

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

describe("buildTriageHints", () => {
  it("returns an empty array when no rows match", () => {
    expect(buildTriageHints(makeScanResult())).toEqual([]);
  });

  it("matches dual-signal-hotspot for file hotspots at thresholds", () => {
    const hints = buildTriageHints(
      makeScanResult({
        hotspots: [
          makeHotspot({
            filePath: "src/edge.ts",
            hotspotScore: TRIAGE_HOTSPOT_SCORE_THRESHOLD,
            complexityNormalized: TRIAGE_NORMALIZED_SIGNAL_THRESHOLD,
            churnNormalized: TRIAGE_NORMALIZED_SIGNAL_THRESHOLD,
          }),
        ],
      }),
    );

    expect(hints).toEqual([
      {
        ruleId: "dual-signal-hotspot",
        message:
          "High dual-signal hotspot — NCLOC and churn both elevated; prioritize review.",
        target: "src/edge.ts",
        rankMetric: TRIAGE_HOTSPOT_SCORE_THRESHOLD,
      },
    ]);
  });

  it("does not match dual-signal-hotspot when any signal is below threshold", () => {
    const lowScore = makeHotspot({
      hotspotScore: TRIAGE_HOTSPOT_SCORE_THRESHOLD - 0.01,
    });
    const lowComplexity = makeHotspot({
      complexityNormalized: TRIAGE_NORMALIZED_SIGNAL_THRESHOLD - 0.01,
    });
    const lowChurn = makeHotspot({
      churnNormalized: TRIAGE_NORMALIZED_SIGNAL_THRESHOLD - 0.01,
    });

    expect(buildTriageHints(makeScanResult({ hotspots: [lowScore] }))).toEqual(
      [],
    );
    expect(
      buildTriageHints(makeScanResult({ hotspots: [lowComplexity] })),
    ).toEqual([]);
    expect(buildTriageHints(makeScanResult({ hotspots: [lowChurn] }))).toEqual(
      [],
    );
  });

  it("caps dual-signal matches at three sorted by rank metric descending", () => {
    const hotspots = Array.from({ length: 5 }, (_, index) =>
      makeHotspot({
        filePath: `src/h${index}.ts`,
        hotspotScore: 0.71 + index * 0.01,
      }),
    );

    const hints = buildTriageHints(makeScanResult({ hotspots }));

    expect(hints).toHaveLength(TRIAGE_MAX_HINTS_PER_RULE);
    expect(hints.map((hint) => hint.target)).toEqual([
      "src/h4.ts",
      "src/h3.ts",
      "src/h2.ts",
    ]);
  });
});

describe("renderTableTriageHints", () => {
  it("returns an empty array when there are no hints", () => {
    expect(renderTableTriageHints([])).toEqual([]);
  });

  it("renders a titled bullet list for table output", () => {
    const hints = buildTriageHints(
      makeScanResult({
        hotspots: [makeHotspot({ filePath: "src/hot.ts" })],
      }),
    );

    expect(renderTableTriageHints(hints)).toEqual([
      "Triage hints",
      "  • src/hot.ts — High dual-signal hotspot — NCLOC and churn both elevated; prioritize review.",
    ]);
  });
});

describe("renderMarkdownTriageHints", () => {
  it("returns an empty array when there are no hints", () => {
    expect(renderMarkdownTriageHints([])).toEqual([]);
  });

  it("renders a markdown section with bullets", () => {
    const hints = buildTriageHints(
      makeScanResult({
        hotspots: [makeHotspot({ filePath: "src/hot.ts" })],
      }),
    );

    expect(renderMarkdownTriageHints(hints)).toEqual([
      "## Triage hints",
      "",
      "- src/hot.ts — High dual-signal hotspot — NCLOC and churn both elevated; prioritize review.",
    ]);
  });
});
