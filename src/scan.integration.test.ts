import { execFileSync } from "node:child_process";
import { cp, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GitLogError } from "./git/spawn.js";
import type { ScanWarning } from "./types/index.js";
import { runScan } from "#scan";
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
const smallTsFixture = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../tests/fixtures/repos/small-ts",
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

function assertFileModeRankingBaseline(
  result: Awaited<ReturnType<typeof runScan>>,
): void {
  expect(result.version).toBe("3.0");
  expect(result).not.toHaveProperty("functions");
  expect(result).not.toHaveProperty("coupling");
  expect(result.meta).not.toHaveProperty("granularity");
  expect(result.meta.since).toBe(OVERLAP_FILE_SCAN_OPTIONS.since);
  expect(result.hotspots.map((hotspot) => hotspot.filePath)).toEqual([
    ...EXPECTED_FILE_HOTSPOT_ORDER,
  ]);
  expect(result.hotspots[0]!.filePath).toBe(EXPECTED_TOP_HOTSPOT);
  expect(result.hotspots[0]!.ncloc).toBeGreaterThan(0);
  expect(result.hotspots[0]!.hotspotScore).toBeGreaterThan(
    result.hotspots[1]!.hotspotScore,
  );
}

const EXPECTED_TOP_HOTSPOT = "src/high.ts";
/** M34 file-mode ranking parity baseline under fixed overlap scan options. */
const OVERLAP_FILE_SCAN_OPTIONS = {
  repoPath: smallTsFixture,
  since: "24 months ago",
};
const EXPECTED_FILE_HOTSPOT_ORDER = [
  "src/high.ts",
  "src/medium.ts",
  "bootstrap-repo.mjs",
  "src/low.ts",
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
  it("returns non-empty hotspot rankings at version 3.0 without functions on small-ts fixture", async () => {
    const result = await runScan({ repoPath: smallTsFixture });

    expect(result.version).toBe("3.0");
    expect(result).not.toHaveProperty("functions");
    expect(result).not.toHaveProperty("coupling");
    expect(result.meta).not.toHaveProperty("granularity");
    expect(result.hotspots.length).toBeGreaterThanOrEqual(1);
    expect(result.hotspots[0]!.filePath).toBe(EXPECTED_TOP_HOTSPOT);

    const topHotspot = result.hotspots[0]!;
    expect(topHotspot.ncloc).toBeGreaterThan(0);
    expect(topHotspot.commitCount).toBeGreaterThan(0);
    expect(topHotspot.authorCount).toBeGreaterThan(0);
    expect(topHotspot.linesChanged).toBeDefined();
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

  it("never emits function-churn progress phase", async () => {
    const onProgress = vi.fn();

    await runScan({
      repoPath: smallTsFixture,
      concurrency: 1,
      onProgress,
    });

    const phases = onProgress.mock.calls.map(([progress]) => progress.phase);
    expect(phases).toContain("git");
    expect(phases).toContain("complexity");
    expect(phases).not.toContain("function-churn");
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
});

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
  it("preserves file-mode hotspot rankings under fixed options (HOTSPOT-370)", async () => {
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
  it("unifies heuristic rename churn for surviving paths (HOTSPOT-766)", async () => {
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

      expect(result.version).toBe("3.0");
      expect(result).not.toHaveProperty("functions");
      expect(result).not.toHaveProperty("coupling");

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
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("ranks syntax-broken files by NCLOC and churn (HOTSPOT-767)", async () => {
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

      expect(result.version).toBe("3.0");
      expect(result).not.toHaveProperty("functions");

      const broken = result.hotspots.find(
        (hotspot) => hotspot.filePath === "src/broken.ts",
      );
      expect(broken).toBeDefined();
      expect(broken!.ncloc).toBeGreaterThan(0);
      expect(broken!.commitCount).toBeGreaterThan(0);

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
