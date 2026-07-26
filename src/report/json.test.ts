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

    expect(parsed.version).toBe("3.0");
    expect(parsed.hotspots).toHaveLength(2);
    expect(parsed.meta.since).toBe("6 months ago");
    expect(parsed.hotspots[0]).toMatchObject({
      filePath: "src/hot.ts",
      complexityNormalized: 0.9,
      churnNormalized: 0.9444,
      hotspotScore: 0.85,
      ncloc: 42,
      commitCount: 15,
      linesChanged: 320,
      authorCount: 3,
    });
    expect(output.endsWith("\n")).toBe(true);
    expect(output).not.toContain("authors");
    expect(parsed).not.toHaveProperty("functions");
  });

  it("renders empty hotspots for stub results", () => {
    const output = renderJson({
      version: "3.0",
      hotspots: [],
      meta: {
        since: "12 months ago",
        scannedAt: "2026-07-22T12:00:00.000Z",
        warnings: [],
      },
    });
    const parsed = JSON.parse(output) as ScanResult;

    expect(parsed.hotspots).toEqual([]);
    expect(parsed).not.toHaveProperty("functions");
  });

  it("always includes hotspots", () => {
    const fixture = loadFixture();
    const output = renderJson(sliceScanResult(fixture, 2), {
      only: ["hotspots"],
    });
    const parsed = JSON.parse(output) as Record<string, unknown>;

    expect(parsed.version).toBe("3.0");
    expect(parsed.meta).toBeDefined();
    expect(parsed.hotspots).toHaveLength(2);
    expect(parsed).not.toHaveProperty("functions");
  });
});
