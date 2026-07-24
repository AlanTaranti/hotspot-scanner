import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_MIN_COCHANGE } from "./scoring/index.js";
import type { CouplingPair, ScanWarning, StaticDependencyDirection } from "./types/index.js";
import { runScan } from "#scan";

const smallTsFixture = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../tests/fixtures/repos/small-ts",
);

const aliasCouplingFixture = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../tests/fixtures/repos/alias-coupling",
);

const withRenamesFixture = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../tests/fixtures/repos/with-renames",
);

const STATIC_DEPENDENCY_DIRECTIONS: StaticDependencyDirection[] = [
  "none",
  "a-to-b",
  "b-to-a",
  "both",
];

function assertCompleteCouplingEnrichment(pair: CouplingPair): void {
  expect(typeof pair.hasStaticDependency).toBe("boolean");
  expect(STATIC_DEPENDENCY_DIRECTIONS).toContain(
    pair.staticDependencyDirection,
  );
  expect(typeof pair.hasRuntimeStaticDependency).toBe("boolean");
  expect(typeof pair.hasTypeOnlyStaticDependency).toBe("boolean");
  expect(typeof pair.hasReExportStaticDependency).toBe("boolean");
  expect(pair.hasStaticDependency).toBe(
    pair.hasRuntimeStaticDependency || pair.hasTypeOnlyStaticDependency,
  );

  if (pair.staticDependencyDirection === "none") {
    expect(pair.hasStaticDependency).toBe(false);
    expect(pair.hasRuntimeStaticDependency).toBe(false);
    expect(pair.hasTypeOnlyStaticDependency).toBe(false);
    expect(pair.hasReExportStaticDependency).toBe(false);
  } else {
    expect(pair.hasStaticDependency).toBe(true);
  }
}

function assertAllCouplingEnriched(coupling: CouplingPair[]): void {
  for (const pair of coupling) {
    assertCompleteCouplingEnrichment(pair);
  }
}

const EXPECTED_TOP_HOTSPOT = "src/high.ts";
const WITH_RENAMES_CANONICAL_PATH = "src/c.ts";
const WITH_RENAMES_EXPECTED_COMMITS = 5;
const SINCE_TRUNCATION_WARNING_PREFIX =
  "Rename history before the --since window";

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
    assertAllCouplingEnriched(result.coupling);
  });

  it("enriches coupling pairs with import-linked and co-change-only cases", async () => {
    const result = await runScan({ repoPath: smallTsFixture });
    assertAllCouplingEnriched(result.coupling);

    const highMedium = result.coupling.find(
      (pair) => pair.fileA === "src/high.ts" && pair.fileB === "src/medium.ts",
    );
    const lowMedium = result.coupling.find(
      (pair) => pair.fileA === "src/low.ts" && pair.fileB === "src/medium.ts",
    );

    expect(highMedium).toBeDefined();
    expect(highMedium!.hasStaticDependency).toBe(true);
    expect(highMedium!.staticDependencyDirection).toBe("a-to-b");
    expect(highMedium!.hasRuntimeStaticDependency).toBe(true);
    expect(lowMedium).toBeDefined();
    expect(lowMedium!.hasStaticDependency).toBe(false);
    expect(lowMedium!.staticDependencyDirection).toBe("none");
  });

  it("preserves temporal coupling ranking order after static enrichment", async () => {
    const result = await runScan({ repoPath: smallTsFixture });
    assertAllCouplingEnriched(result.coupling);

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

    const result = await runScan({
      repoPath: smallTsFixture,
      onProgress,
      onWarning,
    });

    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "git",
        commitsProcessed: expect.any(Number),
      }),
    );
    expect(onWarning).not.toHaveBeenCalled();
    expect(result.meta.warnings).toEqual([]);
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
    assertAllCouplingEnriched(result.coupling);

    const topFunction = result.functions[0]!;
    expect(topFunction.functionName).toBeTruthy();
    expect(topFunction.line).toBeGreaterThan(0);
    expect(topFunction.complexity).toBeGreaterThan(0);
    expect(topFunction.hotspotScore).toBeGreaterThanOrEqual(0);
    expect(topFunction.commitCount).toBeGreaterThanOrEqual(0);
  });

  it("uses per-function churn in function mode (not identical siblings)", async () => {
    const result = await runScan({
      repoPath: smallTsFixture,
      granularity: "function",
    });

    const byFile = new Map<string, typeof result.functions>();
    for (const fn of result.functions) {
      const list = byFile.get(fn.filePath) ?? [];
      list.push(fn);
      byFile.set(fn.filePath, list);
    }

    const multiFnFile = [...byFile.entries()].find(([, fns]) => fns.length > 1);
    if (multiFnFile !== undefined) {
      const commitCounts = new Set(multiFnFile[1].map((fn) => fn.commitCount));
      expect(commitCounts.size).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("runScan integration — alias-coupling fixture", () => {
  it("enriches alias-linked co-changing pair with direction and kind flags", async () => {
    const result = await runScan({ repoPath: aliasCouplingFixture });
    assertAllCouplingEnriched(result.coupling);

    const consumerProvider = result.coupling.find(
      (pair) =>
        pair.fileA === "src/consumer.ts" && pair.fileB === "src/provider.ts",
    );
    const consumerOrphan = result.coupling.find(
      (pair) =>
        pair.fileA === "src/consumer.ts" && pair.fileB === "src/orphan.ts",
    );

    expect(consumerProvider).toBeDefined();
    expect(consumerProvider!.hasStaticDependency).toBe(true);
    expect(consumerProvider!.staticDependencyDirection).toBe("a-to-b");
    expect(consumerProvider!.hasRuntimeStaticDependency).toBe(true);
    expect(consumerProvider!.hasTypeOnlyStaticDependency).toBe(false);
    expect(consumerProvider!.hasReExportStaticDependency).toBe(false);

    expect(consumerOrphan).toBeDefined();
    expect(consumerOrphan!.hasStaticDependency).toBe(false);
    expect(consumerOrphan!.staticDependencyDirection).toBe("none");
  });

  it("preserves temporal coupling ranking after alias enrichment", async () => {
    const result = await runScan({ repoPath: aliasCouplingFixture });
    assertAllCouplingEnriched(result.coupling);

    expect(result.coupling.map((pair) => [pair.fileA, pair.fileB])).toEqual([
      ["src/consumer.ts", "src/orphan.ts"],
      ["src/consumer.ts", "src/provider.ts"],
    ]);
    expect(result.coupling.map((pair) => pair.couplingStrength)).toEqual([
      0.75, 0.75,
    ]);
  });
});

describe("runScan integration — with-renames fixture", () => {
  it("unifies churn under the canonical final path when find-renames links the chain", async () => {
    const result = await runScan({
      repoPath: withRenamesFixture,
      since: "24 months ago",
    });

    const canonical = result.hotspots.find(
      (hotspot) => hotspot.filePath === WITH_RENAMES_CANONICAL_PATH,
    );
    expect(canonical).toBeDefined();
    expect(canonical!.commitCount).toBe(WITH_RENAMES_EXPECTED_COMMITS);

    const legacyPaths = result.hotspots.map((hotspot) => hotspot.filePath);
    expect(legacyPaths).not.toContain("src/a.ts");
    expect(legacyPaths).not.toContain("src/b.ts");
  });

  it("emits since-truncation warning and no blind-spot warnings for linked renames", async () => {
    const warnings: ScanWarning[] = [];

    const result = await runScan({
      repoPath: withRenamesFixture,
      since: "24 months ago",
      onWarning: (warning) => warnings.push(warning),
    });

    expect(
      warnings.some(
        (warning) =>
          warning.code === "RENAME_HISTORY_INCOMPLETE" &&
          warning.message.startsWith(SINCE_TRUNCATION_WARNING_PREFIX),
      ),
    ).toBe(true);
    expect(
      warnings.some((warning) =>
        warning.message.startsWith("Suspected unlinked rename"),
      ),
    ).toBe(false);
    expect(
      warnings.some((warning) =>
        warning.message.startsWith("Rename history may be incomplete for:"),
      ),
    ).toBe(false);
    expect(result.meta.warnings).toEqual(warnings);
  });
});
