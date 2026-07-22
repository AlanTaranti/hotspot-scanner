import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ScanResult } from "../types/index.js";
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

describe("sliceScanResult", () => {
  it("returns cloned result when top is undefined", () => {
    const fixture = loadFixture();
    const sliced = sliceScanResult(fixture);

    expect(sliced).toEqual(fixture);
    expect(sliced).not.toBe(fixture);
    expect(sliced.hotspots).not.toBe(fixture.hotspots);
    expect(sliced.meta).not.toBe(fixture.meta);
  });

  it("limits hotspots and coupling arrays to top N", () => {
    const fixture = loadFixture();
    const sliced = sliceScanResult(fixture, 2);

    expect(sliced.hotspots).toHaveLength(2);
    expect(sliced.coupling).toHaveLength(2);
    expect(sliced.hotspots[0]?.filePath).toBe("src/hot.ts");
    expect(sliced.coupling[0]?.fileA).toBe("src/a.ts");
    expect(sliced.meta).toEqual(fixture.meta);
    expect(sliced.version).toBe("1.0");
  });

  it("returns all items when top exceeds result length", () => {
    const fixture = loadFixture();
    const sliced = sliceScanResult(fixture, 100);

    expect(sliced.hotspots).toHaveLength(3);
    expect(sliced.coupling).toHaveLength(2);
  });
});
