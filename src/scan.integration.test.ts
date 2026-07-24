import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_MIN_COCHANGE } from "./scoring/index.js";
import { runScan } from "#scan";

const smallTsFixture = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../tests/fixtures/repos/small-ts",
);

const EXPECTED_TOP_HOTSPOT = "src/high.ts";

describe("runScan integration", () => {
  it("returns non-empty hotspot and coupling rankings on small-ts fixture", async () => {
    const result = await runScan({ repoPath: smallTsFixture });

    expect(result.hotspots.length).toBeGreaterThanOrEqual(1);
    expect(result.hotspots[0]!.filePath).toBe(EXPECTED_TOP_HOTSPOT);

    const topHotspot = result.hotspots[0]!;
    expect(topHotspot.cyclomaticComplexity).toBeGreaterThan(0);
    expect(topHotspot.commitCount).toBeGreaterThan(0);
    expect(topHotspot.authorCount).toBeGreaterThan(0);
    expect(topHotspot.functionCount).toBeDefined();
    expect(topHotspot.linesChanged).toBeDefined();

    expect(result.coupling.length).toBeGreaterThanOrEqual(1);
    const topCoupling = result.coupling[0]!;
    expect(topCoupling.coChangeCount).toBeGreaterThanOrEqual(
      DEFAULT_MIN_COCHANGE,
    );
    for (const pair of result.coupling) {
      expect(typeof pair.hasStaticDependency).toBe("boolean");
    }
  });

  it("enriches coupling pairs with import-linked and co-change-only cases", async () => {
    const result = await runScan({ repoPath: smallTsFixture });

    const highMedium = result.coupling.find(
      (pair) =>
        pair.fileA === "src/high.ts" && pair.fileB === "src/medium.ts",
    );
    const lowMedium = result.coupling.find(
      (pair) => pair.fileA === "src/low.ts" && pair.fileB === "src/medium.ts",
    );

    expect(highMedium).toBeDefined();
    expect(highMedium!.hasStaticDependency).toBe(true);
    expect(lowMedium).toBeDefined();
    expect(lowMedium!.hasStaticDependency).toBe(false);
  });

  it("preserves temporal coupling ranking order after static enrichment", async () => {
    const result = await runScan({ repoPath: smallTsFixture });

    expect(result.coupling.map((pair) => [pair.fileA, pair.fileB])).toEqual([
      ["src/low.ts", "src/medium.ts"],
      ["src/high.ts", "src/medium.ts"],
    ]);
    expect(result.coupling.map((pair) => pair.couplingStrength)).toEqual([
      0.75, 0.6,
    ]);
  });

  it("forwards git progress and warnings via callbacks", async () => {
    const onProgress = vi.fn();
    const onWarning = vi.fn();

    await runScan({
      repoPath: smallTsFixture,
      onProgress,
      onWarning,
    });

    expect(onProgress).toHaveBeenCalled();
    expect(onWarning).not.toHaveBeenCalled();
  });

  it("limits output paths when include scope is set", async () => {
    const result = await runScan({
      repoPath: smallTsFixture,
      include: ["src/**"],
    });

    expect(result.hotspots.length).toBeGreaterThanOrEqual(1);
    for (const hotspot of result.hotspots) {
      expect(hotspot.filePath.startsWith("src/")).toBe(true);
    }
  });

  it("returns function rankings when granularity is function", async () => {
    const result = await runScan({
      repoPath: smallTsFixture,
      granularity: "function",
    });

    expect(result.meta.granularity).toBe("function");
    expect(result.hotspots).toEqual([]);
    expect(result.functions.length).toBeGreaterThan(0);
    expect(result.coupling.length).toBeGreaterThanOrEqual(1);

    const topFunction = result.functions[0]!;
    expect(topFunction.functionName).toBeTruthy();
    expect(topFunction.line).toBeGreaterThan(0);
    expect(topFunction.complexity).toBeGreaterThan(0);
    expect(topFunction.hotspotScore).toBeGreaterThanOrEqual(0);
  });
});
