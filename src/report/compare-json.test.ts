import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compareScanResults } from "../compare/compare.js";
import type { ScanResult } from "../types/index.js";
import { renderCompareJson } from "./compare-json.js";
import { COMPARE_RESULT_SCHEMA_URL } from "./schema-urls.js";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures/report",
);

function loadCompareResult() {
  const baseline = JSON.parse(
    readFileSync(join(fixturesDir, "compare-baseline-file.json"), "utf8"),
  ) as ScanResult;
  const current = JSON.parse(
    readFileSync(join(fixturesDir, "compare-current-file.json"), "utf8"),
  ) as ScanResult;
  return compareScanResults(baseline, current);
}

describe("renderCompareJson", () => {
  it("outputs valid CompareResult JSON", () => {
    const output = renderCompareJson(loadCompareResult());
    const parsed = JSON.parse(output);

    expect(parsed.$schema).toBe(COMPARE_RESULT_SCHEMA_URL);
    expect(parsed.version).toBe("3.0");
    expect(parsed.hotspots.new).toHaveLength(1);
    expect(parsed.hotspots.removed).toHaveLength(1);
    expect(parsed.hotspots.rankChanged).toHaveLength(1);
    expect(parsed.hotspots.new[0]).toMatchObject({ ncloc: 50 });
    expect(parsed.hotspots.rankChanged[0]).toMatchObject({
      scoreDelta: expect.any(Number),
      nclocDelta: expect.any(Number),
      commitCountDelta: expect.any(Number),
    });
    expect(parsed).not.toHaveProperty("functions");
    expect(parsed).not.toHaveProperty("granularity");
  });

  it("includes hotspots when only is set", () => {
    const output = renderCompareJson(loadCompareResult(), {
      only: ["hotspots"],
    });
    const parsed = JSON.parse(output) as Record<string, unknown>;

    expect(parsed.hotspots).toBeDefined();
    expect(parsed.functions).toBeUndefined();
    expect(parsed.meta).toBeDefined();
    expect(parsed.version).toBe("3.0");
  });

  it("keeps hotspots when unfiltered", () => {
    const output = renderCompareJson(loadCompareResult());
    const parsed = JSON.parse(output) as Record<string, unknown>;

    expect(parsed.hotspots).toBeDefined();
    expect(parsed).not.toHaveProperty("functions");
  });
});
