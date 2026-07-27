import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runComplexityTrend } from "../../src/trend/run-trend.js";

const fixtureRoot = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "fixtures/repos/trend-indent",
);
const trendFile = join(fixtureRoot, "src/trend.ts");

describe("complexity trend integration", () => {
  it("returns ascending points with changing metrics on trend-indent fixture", async () => {
    const result = await runComplexityTrend({
      filePath: trendFile,
      since: "10 years ago",
      includeScannerVersion: false,
    });

    expect(result.points.length).toBeGreaterThanOrEqual(2);
    expect(result.meta.sparklines.mean.length).toBeGreaterThan(0);
    expect(result.meta.sparklines.ncloc.length).toBeGreaterThan(0);
    expect(result.points[0]!.mean).toBeLessThanOrEqual(result.points.at(-1)!.mean);
  });
});
