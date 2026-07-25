import { execFileSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildGitPatchLogArgv,
  PATCH_PATHSPEC_FALLBACK_THRESHOLD,
  PATHSPEC_ARG_MAX_FALLBACK_CODE,
  partitionPathspecs,
} from "./git/function-churn/index.js";
import * as pathsModule from "./paths/index.js";
import { filterGitMinerResult as realFilterGitMinerResult } from "./paths/filter-git.js";
import { GitLogError } from "./git/spawn.js";
import { DEFAULT_MIN_COCHANGE } from "./scoring/index.js";
import type { CouplingPair, ScanWarning, StaticDependencyDirection } from "./types/index.js";
import { runScan } from "#scan";

const streamGitPatchLogSpy = vi.hoisted(() => vi.fn());
const patchStreamFailure = vi.hoisted(() => ({
  argMaxOnPathspec: false,
}));
const gitMineFailure = vi.hoisted(() => ({ error: null as Error | null }));
const analyzeFailure = vi.hoisted(() => ({ error: null as Error | null }));

vi.mock("./git/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./git/index.js")>();
  return {
    ...actual,
    createGitMiner: (
      ...args: Parameters<typeof actual.createGitMiner>
    ) => {
      const miner = actual.createGitMiner(...args);
      return {
        mine: async (
          opts: Parameters<typeof miner.mine>[0],
        ) => {
          if (gitMineFailure.error) {
            throw gitMineFailure.error;
          }
          return miner.mine(opts);
        },
      };
    },
  };
});

vi.mock("./complexity/index.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./complexity/index.js")>();
  return {
    ...actual,
    createComplexityAnalyzer: (
      ...args: Parameters<typeof actual.createComplexityAnalyzer>
    ) => {
      const analyzer = actual.createComplexityAnalyzer(...args);
      return {
        analyze: async (
          opts: Parameters<typeof analyzer.analyze>[0],
        ) => {
          if (analyzeFailure.error) {
            throw analyzeFailure.error;
          }
          return analyzer.analyze(opts);
        },
      };
    },
  };
});

vi.mock("./git/function-churn/index.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./git/function-churn/index.js")>();
  return {
    ...actual,
    createFunctionChurnMiner: (
      deps: Parameters<typeof actual.createFunctionChurnMiner>[0] = {},
    ) => {
      const stream = deps.streamGitPatchLog ?? actual.streamGitPatchLog;
      return actual.createFunctionChurnMiner({
        ...deps,
        streamGitPatchLog: (options) => {
          streamGitPatchLogSpy(options);
          if (
            patchStreamFailure.argMaxOnPathspec &&
            options.paths !== undefined &&
            options.paths.length > 0
          ) {
            throw Object.assign(new Error("spawn E2BIG"), { code: "E2BIG" });
          }
          return stream(options);
        },
      });
    },
  };
});

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

const mergeHeavyFixture = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../tests/fixtures/repos/merge-heavy",
);

const monorepoNestedFixture = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../tests/fixtures/repos/monorepo-nested",
);

const MONOREPO_API_PACKAGE_DIR = join(monorepoNestedFixture, "packages", "api");
const MONOREPO_API_TOP_HOTSPOT = "packages/api/src/high.ts";
const MONOREPO_OTHER_HOTSPOT = "packages/other/src/other.ts";

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

function assertFileModeRankingBaseline(
  result: Awaited<ReturnType<typeof runScan>>,
): void {
  expect(result.meta.granularity).toBe("file");
  expect(result.meta.since).toBe(OVERLAP_FILE_SCAN_OPTIONS.since);
  expect(result.hotspots.map((hotspot) => hotspot.filePath)).toEqual([
    ...EXPECTED_FILE_HOTSPOT_ORDER,
  ]);
  expect(result.hotspots[0]!.filePath).toBe(EXPECTED_TOP_HOTSPOT);
  expect(result.hotspots[0]!.hotspotScore).toBeGreaterThan(
    result.hotspots[1]!.hotspotScore,
  );
  expect(result.coupling.map((pair) => [pair.fileA, pair.fileB])).toEqual([
    ...EXPECTED_FILE_COUPLING_ORDER,
  ]);
  expect(result.coupling.map((pair) => pair.couplingStrength)).toEqual([
    ...EXPECTED_FILE_COUPLING_STRENGTHS,
  ]);
  assertAllCouplingEnriched(result.coupling);
}

const EXPECTED_TOP_HOTSPOT = "src/high.ts";
/** M34 file-mode ranking parity baseline under fixed overlap scan options. */
const OVERLAP_FILE_SCAN_OPTIONS = {
  repoPath: smallTsFixture,
  since: "24 months ago",
  granularity: "file" as const,
  minCochange: DEFAULT_MIN_COCHANGE,
};
const EXPECTED_FILE_HOTSPOT_ORDER = [
  "src/high.ts",
  "src/medium.ts",
  "bootstrap-repo.mjs",
  "src/low.ts",
] as const;
const EXPECTED_FILE_COUPLING_ORDER = [
  ["src/low.ts", "src/medium.ts"],
  ["src/high.ts", "src/medium.ts"],
] as const;
const EXPECTED_FILE_COUPLING_STRENGTHS = [0.75, 0.6] as const;
/** M35 ranking parity baseline: churned functions on small-ts (tie-break: filePath). */
const EXPECTED_CHURNED_FUNCTION_RANKING = [
  { filePath: "bootstrap-repo.mjs", functionName: "git" },
  { filePath: "bootstrap-repo.mjs", functionName: "gitWithDate" },
  { filePath: "bootstrap-repo.mjs", functionName: "writeFile" },
  { filePath: "bootstrap-repo.mjs", functionName: "createTree" },
  { filePath: "bootstrap-repo.mjs", functionName: "createRef" },
  { filePath: "src/high.ts", functionName: "high" },
  { filePath: "src/low.ts", functionName: "low" },
  { filePath: "src/medium.ts", functionName: "medium" },
] as const;
const WITH_RENAMES_CANONICAL_PATH = "src/c.ts";
const WITH_RENAMES_EXPECTED_COMMITS = 5;
const SINCE_TRUNCATION_WARNING_PREFIX =
  "Rename history before the --since window";

beforeEach(() => {
  gitMineFailure.error = null;
  analyzeFailure.error = null;
});

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
      concurrency: 1,
      onProgress,
      onWarning,
    });

    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "git",
        commitsProcessed: expect.any(Number),
      }),
    );
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "complexity",
        commitsProcessed: 0,
        filesProcessed: expect.any(Number),
        batchesProcessed: expect.any(Number),
        totalFiles: expect.any(Number),
        totalBatches: expect.any(Number),
      }),
    );
    expect(onWarning).not.toHaveBeenCalled();
    expect(result.meta.warnings).toEqual([]);
  });

  it("forwards git, complexity, and function-churn progress in function mode", async () => {
    const onProgress = vi.fn();

    await runScan({
      repoPath: smallTsFixture,
      granularity: "function",
      concurrency: 1,
      onProgress,
    });

    const phases = onProgress.mock.calls.map(([progress]) => progress.phase);
    expect(phases).toContain("git");
    expect(phases).toContain("complexity");
    expect(phases).toContain("function-churn");
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

const callbacksIifeFixture = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../tests/fixtures/complexity/callbacks-iife.ts",
);

async function createIsolatedSmallTsRepo(): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scan-integration-"));
  await cp(smallTsFixture, tempDir, { recursive: true });
  return tempDir;
}

function configureGitForTest(repoPath: string): void {
  execFileSync("git", ["config", "user.email", "test@example.com"], {
    cwd: repoPath,
  });
  execFileSync("git", ["config", "user.name", "Test User"], {
    cwd: repoPath,
  });
}

describe("runScan integration — pipeline stage overlap (M34)", () => {
  beforeEach(() => {
    streamGitPatchLogSpy.mockClear();
  });

  it("preserves file-mode hotspot and coupling rankings under fixed options (HOTSPOT-370)", async () => {
    const result = await runScan(OVERLAP_FILE_SCAN_OPTIONS);

    assertFileModeRankingBaseline(result);
  });

  it("matches default overlap rankings when sequential opt-out is used (HOTSPOT-716, HOTSPOT-720)", async () => {
    const overlapResult = await runScan(OVERLAP_FILE_SCAN_OPTIONS);
    const sequentialResult = await runScan({
      ...OVERLAP_FILE_SCAN_OPTIONS,
      sequential: true,
    });

    assertFileModeRankingBaseline(sequentialResult);
    expect(sequentialResult.hotspots.map((hotspot) => hotspot.filePath)).toEqual(
      overlapResult.hotspots.map((hotspot) => hotspot.filePath),
    );
    expect(
      sequentialResult.hotspots.map((hotspot) => hotspot.hotspotScore),
    ).toEqual(overlapResult.hotspots.map((hotspot) => hotspot.hotspotScore));
    expect(
      sequentialResult.coupling.map((pair) => [pair.fileA, pair.fileB]),
    ).toEqual(
      overlapResult.coupling.map((pair) => [pair.fileA, pair.fileB]),
    );
    expect(
      sequentialResult.coupling.map((pair) => pair.couplingStrength),
    ).toEqual(overlapResult.coupling.map((pair) => pair.couplingStrength));
  });

  it("preserves function-mode churn ranking under fixed options (HOTSPOT-370)", async () => {
    const result = await runScan({
      repoPath: smallTsFixture,
      since: "24 months ago",
      granularity: "function",
      minCochange: DEFAULT_MIN_COCHANGE,
    });

    expect(result.meta.granularity).toBe("function");
    expect(result.hotspots).toEqual([]);
    expect(result.functions.length).toBeGreaterThan(0);
    expect(
      result.functions.map((fn) => ({
        filePath: fn.filePath,
        functionName: fn.functionName,
      })),
    ).toEqual([...EXPECTED_CHURNED_FUNCTION_RANKING]);
    assertAllCouplingEnriched(result.coupling);
  });

  it("preserves function-mode churn ranking when sequential is true (HOTSPOT-714)", async () => {
    const overlapResult = await runScan({
      repoPath: smallTsFixture,
      since: "24 months ago",
      granularity: "function",
      minCochange: DEFAULT_MIN_COCHANGE,
    });
    const sequentialResult = await runScan({
      repoPath: smallTsFixture,
      since: "24 months ago",
      granularity: "function",
      minCochange: DEFAULT_MIN_COCHANGE,
      sequential: true,
    });

    expect(sequentialResult.meta.granularity).toBe("function");
    expect(sequentialResult.hotspots).toEqual([]);
    expect(sequentialResult.functions.length).toBeGreaterThan(0);
    expect(
      sequentialResult.functions.map((fn) => ({
        filePath: fn.filePath,
        functionName: fn.functionName,
      })),
    ).toEqual([...EXPECTED_CHURNED_FUNCTION_RANKING]);
    expect(
      sequentialResult.functions.map((fn) => ({
        filePath: fn.filePath,
        functionName: fn.functionName,
        hotspotScore: fn.hotspotScore,
      })),
    ).toEqual(
      overlapResult.functions.map((fn) => ({
        filePath: fn.filePath,
        functionName: fn.functionName,
        hotspotScore: fn.hotspotScore,
      })),
    );
    assertAllCouplingEnriched(sequentialResult.coupling);
  });

  it("does not spawn patch stream in file mode under overlap (HOTSPOT-371)", async () => {
    await runScan(OVERLAP_FILE_SCAN_OPTIONS);

    expect(streamGitPatchLogSpy).not.toHaveBeenCalled();
  });

  it("rejects without partial scan result when git mine fails during overlap (HOTSPOT-378)", async () => {
    const gitError = new GitLogError(
      smallTsFixture,
      "git log --numstat",
      "fatal: simulated git failure",
    );
    gitMineFailure.error = gitError;

    try {
      await expect(runScan(OVERLAP_FILE_SCAN_OPTIONS)).rejects.toBe(gitError);
    } finally {
      gitMineFailure.error = null;
    }
  });

  it("rejects without partial scan result when complexity analyze fails during overlap (HOTSPOT-378)", async () => {
    const cxError = new Error("complexity analyze failed");
    analyzeFailure.error = cxError;

    try {
      await expect(runScan(OVERLAP_FILE_SCAN_OPTIONS)).rejects.toBe(cxError);
    } finally {
      analyzeFailure.error = null;
    }
  });
});

describe("runScan integration — function-mode efficiency (M35)", () => {
  beforeEach(() => {
    streamGitPatchLogSpy.mockClear();
  });

  it("does not spawn the patch stream in file mode (HOTSPOT-392, HOTSPOT-397)", async () => {
    await runScan({ repoPath: smallTsFixture, granularity: "file" });

    expect(streamGitPatchLogSpy).not.toHaveBeenCalled();
  });

  it("spawns batched pathspec-restricted patch streams when allowlist exceeds threshold (HOTSPOT-668)", async () => {
    const syntheticCount = PATCH_PATHSPEC_FALLBACK_THRESHOLD + 1;
    const filterSpy = vi
      .spyOn(pathsModule, "filterGitMinerResult")
      .mockImplementation((result, scope) => {
        const filtered = realFilterGitMinerResult(result, scope);
        const inflatedStats = new Map(filtered.fileStats);
        for (let i = 0; i < syntheticCount; i += 1) {
          const filePath = `src/synth-${String(i).padStart(4, "0")}.ts`;
          inflatedStats.set(filePath, {
            filePath,
            commitCount: 1,
            linesChanged: 1,
            authors: new Set(["test"]),
            lastModified: new Date("2024-01-01T00:00:00.000Z"),
          });
        }
        return { ...filtered, fileStats: inflatedStats };
      });
    const allowlist = [
      ...Array.from({ length: syntheticCount }, (_, i) =>
        `src/synth-${String(i).padStart(4, "0")}.ts`,
      ),
      "bootstrap-repo.mjs",
      "src/high.ts",
      "src/low.ts",
      "src/medium.ts",
    ].sort();
    const expectedChunks = partitionPathspecs(allowlist);

    try {
      await runScan({ repoPath: smallTsFixture, granularity: "function" });

      expect(expectedChunks).toHaveLength(2);
      expect(streamGitPatchLogSpy).toHaveBeenCalledTimes(expectedChunks.length);
      for (let index = 0; index < expectedChunks.length; index += 1) {
        const spawnOptions = streamGitPatchLogSpy.mock.calls[index]![0]!;
        expect(spawnOptions.paths).toEqual(expectedChunks[index]);
        expect(spawnOptions.paths!.length).toBeGreaterThan(0);
        expect(spawnOptions.paths!.length).toBeLessThanOrEqual(
          PATCH_PATHSPEC_FALLBACK_THRESHOLD,
        );
        const argv = buildGitPatchLogArgv(spawnOptions);
        const separatorIndex = argv.indexOf("--");
        expect(separatorIndex).toBeGreaterThan(-1);
        expect(argv.slice(separatorIndex + 1).sort()).toEqual(
          [...spawnOptions.paths!].sort(),
        );
        expect(argv).toEqual(
          expect.arrayContaining(["-M", "-p", "--unified=0"]),
        );
      }
      expect(
        streamGitPatchLogSpy.mock.calls.some(
          (call) => call[0]?.paths === undefined,
        ),
      ).toBe(false);
    } finally {
      filterSpy.mockRestore();
    }
  });

  it("spawns pathspec-restricted patch stream in function mode (HOTSPOT-388)", async () => {
    await runScan({ repoPath: smallTsFixture, granularity: "function" });

    expect(streamGitPatchLogSpy).toHaveBeenCalledTimes(1);
    const spawnOptions = streamGitPatchLogSpy.mock.calls[0]![0]!;
    expect(spawnOptions.paths).toEqual(
      expect.arrayContaining([
        "bootstrap-repo.mjs",
        "src/high.ts",
        "src/low.ts",
        "src/medium.ts",
      ]),
    );
    expect(spawnOptions.paths!.length).toBeLessThanOrEqual(
      PATCH_PATHSPEC_FALLBACK_THRESHOLD,
    );

    const argv = buildGitPatchLogArgv(spawnOptions);
    const separatorIndex = argv.indexOf("--");
    expect(separatorIndex).toBeGreaterThan(-1);
    expect(argv.slice(separatorIndex + 1).sort()).toEqual(
      [...spawnOptions.paths!].sort(),
    );
    expect(argv).toEqual(
      expect.arrayContaining(["-M", "-p", "--unified=0"]),
    );
  });

  it("emits PATHSPEC_ARG_MAX_FALLBACK when pathspec spawn hits argv limits (HOTSPOT-667)", async () => {
    patchStreamFailure.argMaxOnPathspec = true;
    try {
      const result = await runScan({
        repoPath: smallTsFixture,
        granularity: "function",
      });

      expect(
        result.meta.warnings.some(
          (warning: ScanWarning) =>
            warning.code === PATHSPEC_ARG_MAX_FALLBACK_CODE,
        ),
      ).toBe(true);
      expect(
        streamGitPatchLogSpy.mock.calls.some(
          (call) => call[0]?.paths === undefined,
        ),
      ).toBe(true);
    } finally {
      patchStreamFailure.argMaxOnPathspec = false;
    }
  });

  it("preserves typical churned function ranking order on small-ts (HOTSPOT-388)", async () => {
    const result = await runScan({
      repoPath: smallTsFixture,
      granularity: "function",
    });

    expect(
      result.functions.map((fn) => ({
        filePath: fn.filePath,
        functionName: fn.functionName,
      })),
    ).toEqual([...EXPECTED_CHURNED_FUNCTION_RANKING]);
  });

  it("includes zero-churn eligible files in function rankings (HOTSPOT-761)", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    try {
      await writeFile(
        join(repoPath, "src/untouched.ts"),
        "export function untouched(): number { return 0; }\n",
        "utf8",
      );
      execFileSync("git", ["add", "src/untouched.ts"], { cwd: repoPath });

      const fileResult = await runScan({ repoPath, granularity: "file" });
      expect(
        fileResult.hotspots.some((hotspot) => hotspot.filePath === "src/untouched.ts"),
      ).toBe(true);

      const functionResult = await runScan({
        repoPath,
        granularity: "function",
      });
      expect(
        functionResult.functions.some(
          (fn) => fn.filePath === "src/untouched.ts",
        ),
      ).toBe(true);
    } finally {
      await rm(repoPath, { recursive: true, force: true });
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

describe("runScan integration — monorepo-nested fixture (M43)", () => {
  it("scopes rankings to the nested package prefix without explicit include (HOTSPOT-577, HOTSPOT-585)", async () => {
    const result = await runScan({ repoPath: MONOREPO_API_PACKAGE_DIR });

    expect(result.hotspots.length).toBeGreaterThanOrEqual(1);
    expect(result.hotspots[0]!.filePath).toBe(MONOREPO_API_TOP_HOTSPOT);
    for (const hotspot of result.hotspots) {
      expect(hotspot.filePath.startsWith("packages/api/")).toBe(true);
    }
    expect(
      result.hotspots.some(
        (hotspot) => hotspot.filePath === MONOREPO_OTHER_HOTSPOT,
      ),
    ).toBe(false);
  });

  it("includes both packages when scanning from git root without include (HOTSPOT-585)", async () => {
    const result = await runScan({ repoPath: monorepoNestedFixture });

    const hotspotPaths = result.hotspots.map((hotspot) => hotspot.filePath);
    expect(hotspotPaths).toContain(MONOREPO_API_TOP_HOTSPOT);
    expect(hotspotPaths).toContain(MONOREPO_OTHER_HOTSPOT);
  });

  it("emits MONOREPO_PATH_REMOUNT when remounting from a nested package path (HOTSPOT-581)", async () => {
    const warnings: ScanWarning[] = [];

    const result = await runScan({
      repoPath: MONOREPO_API_PACKAGE_DIR,
      onWarning: (warning) => warnings.push(warning),
    });

    expect(
      warnings.some((warning) => warning.code === "MONOREPO_PATH_REMOUNT"),
    ).toBe(true);
    expect(
      result.meta.warnings.some(
        (warning) => warning.code === "MONOREPO_PATH_REMOUNT",
      ),
    ).toBe(true);
    expect(result.meta.warnings[0]!.message).toContain("packages/api/**");
  });

  it("does not emit MONOREPO_PATH_REMOUNT when scanning from git root (HOTSPOT-582)", async () => {
    const result = await runScan({ repoPath: monorepoNestedFixture });

    expect(
      result.meta.warnings.some(
        (warning) => warning.code === "MONOREPO_PATH_REMOUNT",
      ),
    ).toBe(false);
  });
});

describe("runScan integration — ranking accuracy plus (M50)", () => {
  it("unifies heuristic rename churn and enriches coupling via PathAliasMap (HOTSPOT-766)", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    configureGitForTest(repoPath);
    try {
      await writeFile(
        join(repoPath, "src/consumer.ts"),
        "import { provide } from './foo';\nexport function consume() { return provide(); }\n",
        "utf8",
      );
      await writeFile(
        join(repoPath, "src/foo.ts"),
        "export function provide() { return 1; }\n",
        "utf8",
      );
      execFileSync("git", ["add", "src/consumer.ts", "src/foo.ts"], {
        cwd: repoPath,
      });
      execFileSync("git", ["commit", "-m", "add consumer and foo"], {
        cwd: repoPath,
      });

      for (let i = 0; i < 3; i += 1) {
        await writeFile(
          join(repoPath, "src/consumer.ts"),
          `import { provide } from './foo';\nexport function consume() { return provide() + ${String(i)}; }\n// co-change ${String(i)}\n`,
          "utf8",
        );
        await writeFile(
          join(repoPath, "src/foo.ts"),
          `export function provide() { return ${String(i + 1)}; }\n// co-change ${String(i)}\n`,
          "utf8",
        );
        execFileSync("git", ["add", "src/consumer.ts", "src/foo.ts"], {
          cwd: repoPath,
        });
        execFileSync("git", ["commit", "-m", `co-change ${String(i)}`], {
          cwd: repoPath,
        });
      }

      await writeFile(
        join(repoPath, "src/foo.tsx"),
        "export function provide() { return 99; }\n",
        "utf8",
      );
      await unlink(join(repoPath, "src/foo.ts"));
      execFileSync("git", ["add", "src/foo.ts", "src/foo.tsx"], {
        cwd: repoPath,
      });
      execFileSync("git", ["commit", "-m", "unlinked rename foo.ts to foo.tsx"], {
        cwd: repoPath,
      });

      const result = await runScan({ repoPath });

      const fooHotspot = result.hotspots.find(
        (hotspot) => hotspot.filePath === "src/foo.tsx",
      );
      expect(fooHotspot).toBeDefined();
      expect(fooHotspot!.commitCount).toBeGreaterThan(0);
      expect(result.hotspots.map((hotspot) => hotspot.filePath)).not.toContain(
        "src/foo.ts",
      );
      expect(
        result.meta.warnings.some(
          (warning) =>
            warning.code === "RENAME_HISTORY_INCOMPLETE" &&
            warning.message.includes("Suspected unlinked rename"),
        ),
      ).toBe(true);

      const pair = result.coupling.find(
        (entry) =>
          (entry.fileA === "src/consumer.ts" && entry.fileB === "src/foo.tsx") ||
          (entry.fileA === "src/foo.tsx" && entry.fileB === "src/consumer.ts"),
      );
      expect(pair).toBeDefined();
      expect(pair!.hasStaticDependency).toBe(true);
      expect(pair!.hasRuntimeStaticDependency).toBe(true);
      assertCompleteCouplingEnrichment(pair!);
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("ranks parse-failed files with parseFailed flag and score 0 (HOTSPOT-767)", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    configureGitForTest(repoPath);
    try {
      await writeFile(
        join(repoPath, "src/broken.ts"),
        "export function broken( {\n",
        "utf8",
      );
      execFileSync("git", ["add", "src/broken.ts"], { cwd: repoPath });
      execFileSync("git", ["commit", "-m", "add broken syntax"], {
        cwd: repoPath,
      });
      await writeFile(
        join(repoPath, "src/broken.ts"),
        "export function broken( {\n// edit\n",
        "utf8",
      );
      execFileSync("git", ["add", "src/broken.ts"], { cwd: repoPath });
      execFileSync("git", ["commit", "-m", "edit broken"], { cwd: repoPath });

      const result = await runScan({ repoPath, since: "24 months ago" });

      const broken = result.hotspots.find(
        (hotspot) => hotspot.filePath === "src/broken.ts",
      );
      expect(broken).toBeDefined();
      expect(broken!.parseFailed).toBe(true);
      expect(broken!.hotspotScore).toBe(0);
      expect(broken!.complexityNormalized).toBe(0);
      expect(broken!.churnNormalized).toBe(0);
      expect(broken!.commitCount).toBeGreaterThan(0);
      expect(
        result.meta.warnings.some((warning) => warning.code === "PARSE_FAILED"),
      ).toBe(true);
      expect(
        result.functions.some((fn) => fn.filePath === "src/broken.ts"),
      ).toBe(false);

      const high = result.hotspots.find(
        (hotspot) => hotspot.filePath === "src/high.ts",
      );
      const low = result.hotspots.find(
        (hotspot) => hotspot.filePath === "src/low.ts",
      );
      expect(high).toBeDefined();
      expect(low).toBeDefined();
      expect(high!.hotspotScore).toBeGreaterThan(low!.hotspotScore);
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("collects callbacks and IIFEs in function mode including zero-churn files (HOTSPOT-768)", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    try {
      const callbacksContent = await readFile(callbacksIifeFixture, "utf8");
      await writeFile(
        join(repoPath, "src/callbacks-iife.ts"),
        callbacksContent,
        "utf8",
      );
      execFileSync("git", ["add", "src/callbacks-iife.ts"], { cwd: repoPath });

      const result = await runScan({ repoPath, granularity: "function" });

      expect(
        result.functions.some(
          (fn) =>
            fn.filePath === "src/callbacks-iife.ts" &&
            fn.functionName === "usesCallbacks",
        ),
      ).toBe(true);
      expect(
        result.functions.some((fn) => fn.functionName === "<anonymous>:L12"),
      ).toBe(true);
      expect(
        result.functions.some((fn) => fn.functionName === "<anonymous>:L23"),
      ).toBe(true);
      expect(
        result.functions.some(
          (fn) =>
            fn.filePath === "src/callbacks-iife.ts" && fn.commitCount === 0,
        ),
      ).toBe(true);
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });
});

describe("runScan integration — merge-heavy fixture", () => {
  it("ranks surviving files and omits deleted paths after merge and delete history", async () => {
    const result = await runScan({ repoPath: mergeHeavyFixture });

    expect(result.hotspots.length).toBeGreaterThanOrEqual(1);

    const hotspotPaths = result.hotspots.map((hotspot) => hotspot.filePath);
    expect(hotspotPaths).toContain("src/keep.ts");
    expect(hotspotPaths).not.toContain("src/remove.ts");
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
