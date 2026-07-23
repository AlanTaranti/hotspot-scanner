import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ScanResult } from "../types/index.js";
import { renderJson } from "./json.js";
import { sliceScanResult } from "./slice.js";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures/report/sample-result.json",
);

function loadFixture(): ScanResult {
  const raw = JSON.parse(readFileSync(fixturePath, "utf8")) as ScanResult & {
    _comment?: string;
  };
  const { _comment: _ignored, ...fixture } = raw;
  void _ignored;
  return fixture;
}

describe("renderJson", () => {
  it("serializes sliced ScanResult with required fields", () => {
    const fixture = loadFixture();
    const output = renderJson(sliceScanResult(fixture, 2));
    const parsed = JSON.parse(output) as ScanResult;

    expect(parsed.version).toBe("1.0");
    expect(parsed.hotspots).toHaveLength(2);
    expect(parsed.coupling).toHaveLength(2);
    expect(parsed.meta.since).toBe("6 months ago");
    expect(parsed.hotspots[0]).toMatchObject({
      filePath: "src/hot.ts",
      complexityNormalized: 0.9,
      churnNormalized: 0.9444,
      hotspotScore: 0.85,
      cyclomaticComplexity: 42,
      functionCount: 8,
      commitCount: 15,
      linesChanged: 320,
      authorCount: 3,
    });
    expect(parsed.coupling[0]).toMatchObject({
      fileA: "src/a.ts",
      fileB: "src/b.ts",
      coChangeCount: 5,
      couplingStrength: 0.75,
    });
    expect(output.endsWith("\n")).toBe(true);
    expect(output).not.toContain("authors");
  });

  it("renders empty arrays for stub results", () => {
    const output = renderJson({
      version: "1.0",
      hotspots: [],
      coupling: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-07-22T12:00:00.000Z",
      },
    });
    const parsed = JSON.parse(output) as ScanResult;

    expect(parsed.hotspots).toEqual([]);
    expect(parsed.coupling).toEqual([]);
  });
});
