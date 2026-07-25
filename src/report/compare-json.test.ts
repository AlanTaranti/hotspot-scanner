import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compareScanResults } from "../compare/compare.js";
import type { ScanResult } from "../types/index.js";
import { renderCompareJson } from "./compare-json.js";

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

    expect(parsed.version).toBe("1.0");
    expect(parsed.hotspots.new).toHaveLength(1);
    expect(parsed.hotspots.removed).toHaveLength(1);
    expect(parsed.coupling.rankChanged).toHaveLength(2);
  });

  it("omits excluded sections when --only is set", () => {
    const output = renderCompareJson(loadCompareResult(), {
      only: ["hotspots"],
    });
    const parsed = JSON.parse(output) as Record<string, unknown>;

    expect(parsed.hotspots).toBeDefined();
    expect(parsed.coupling).toBeUndefined();
    expect(parsed.functions).toBeUndefined();
    expect(parsed.meta).toBeDefined();
    expect(parsed.version).toBe("1.0");
  });

  it("keeps all section keys when unfiltered", () => {
    const output = renderCompareJson(loadCompareResult());
    const parsed = JSON.parse(output) as Record<string, unknown>;

    expect(parsed.hotspots).toBeDefined();
    expect(parsed.functions).toBeDefined();
    expect(parsed.coupling).toBeDefined();
  });
});
