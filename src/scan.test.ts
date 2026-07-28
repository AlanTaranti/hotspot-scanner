import { readFile } from "node:fs/promises";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  ConfigError,
  HOTSPOT_SCANNER_CONFIG_FILENAME,
} from "./config/index.js";
import { GitLogError } from "./git/spawn.js";
import { isPathInScope } from "./paths/index.js";
import {
  createScanPathScope,
  DEFAULT_SINCE,
  DEFAULT_TOP,
  runScan,
} from "#scan";

const execFileAsync = promisify(execFile);

const createGitMinerSpy = vi.hoisted(() => vi.fn());
const mineSpy = vi.hoisted(() => vi.fn());
const mineOverride = vi.hoisted(() => ({
  fn: null as
    | ((
        options: import("./git/index.js").GitMinerOptions,
      ) => Promise<import("./git/index.js").GitMinerResult>)
    | null,
}));
const createComplexityAnalyzerSpy = vi.hoisted(() => vi.fn());
const analyzeSpy = vi.hoisted(() => vi.fn());
const analyzeOverride = vi.hoisted(() => ({
  fn: null as
    | ((
        options: import("./complexity/index.js").ComplexityAnalyzerOptions,
      ) => Promise<import("./complexity/index.js").ComplexityAnalyzerResult>)
    | null,
}));
const scoreHotspotsSpy = vi.hoisted(() => vi.fn());

vi.mock("./git/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./git/index.js")>();
  return {
    ...actual,
    createGitMiner: (...args: Parameters<typeof actual.createGitMiner>) => {
      createGitMinerSpy(...args);
      if (mineOverride.fn) {
        return {
          mine: (
            mineArgs: Parameters<
              ReturnType<typeof actual.createGitMiner>["mine"]
            >[0],
          ) => {
            mineSpy(mineArgs);
            return mineOverride.fn!(mineArgs);
          },
        };
      }
      const miner = actual.createGitMiner(...args);
      const originalMine = miner.mine.bind(miner);
      return {
        mine: (...mineArgs: Parameters<typeof miner.mine>) => {
          mineSpy(...mineArgs);
          return originalMine(...mineArgs);
        },
      };
    },
  };
});

vi.mock("./complexity/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./complexity/index.js")>();
  return {
    ...actual,
    createComplexityAnalyzer: (
      ...args: Parameters<typeof actual.createComplexityAnalyzer>
    ) => {
      createComplexityAnalyzerSpy(...args);
      if (analyzeOverride.fn) {
        return {
          analyze: (
            analyzeArgs: Parameters<
              ReturnType<typeof actual.createComplexityAnalyzer>["analyze"]
            >[0],
          ) => {
            analyzeSpy(analyzeArgs);
            return analyzeOverride.fn!(analyzeArgs);
          },
        };
      }
      const analyzer = actual.createComplexityAnalyzer(...args);
      const originalAnalyze = analyzer.analyze.bind(analyzer);
      return {
        analyze: (...analyzeArgs: Parameters<typeof analyzer.analyze>) => {
          analyzeSpy(...analyzeArgs);
          return originalAnalyze(...analyzeArgs);
        },
      };
    },
  };
});

vi.mock("./scoring/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./scoring/index.js")>();
  return {
    ...actual,
    createHotspotScorer: () => {
      const scorer = actual.createHotspotScorer();
      return {
        score: (...args: Parameters<typeof scorer.score>) => {
          scoreHotspotsSpy(...args);
          return scorer.score(...args);
        },
      };
    },
  };
});

const smallTsFixture = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../tests/fixtures/repos/small-ts",
);

async function createIsolatedSmallTsRepo(): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scan-config-"));
  await cp(smallTsFixture, tempDir, { recursive: true });
  return tempDir;
}

async function createNestedMonorepoFixture(): Promise<{
  workspaceDir: string;
  packageDir: string;
}> {
  const workspaceDir = await mkdtemp(join(tmpdir(), "hotspot-scan-monorepo-"));
  const packageDir = join(workspaceDir, "packages", "api");
  await mkdir(packageDir, { recursive: true });
  await cp(smallTsFixture, packageDir, { recursive: true });
  await rm(join(packageDir, ".git"), { recursive: true, force: true });
  await execFileAsync("git", ["init"], { cwd: workspaceDir });
  await execFileAsync("git", ["config", "user.email", "test@example.com"], {
    cwd: workspaceDir,
  });
  await execFileAsync("git", ["config", "user.name", "Test User"], {
    cwd: workspaceDir,
  });
  await execFileAsync("git", ["add", "."], { cwd: workspaceDir });
  await execFileAsync("git", ["commit", "-m", "init"], { cwd: workspaceDir });
  return { workspaceDir, packageDir };
}

describe("createScanPathScope", () => {
  it("forwards merged include/exclude and includeTests into PathScope", () => {
    const withTests = createScanPathScope(
      { include: ["src/**"], exclude: ["legacy/**"] },
      { includeTests: true },
    );
    expect(isPathInScope("src/app.test.ts", withTests)).toBe(true);
    expect(isPathInScope("legacy/foo.ts", withTests)).toBe(false);

    const withoutTests = createScanPathScope({
      include: ["src/**"],
      exclude: ["legacy/**"],
    });
    expect(isPathInScope("src/app.test.ts", withoutTests)).toBe(false);
    expect(isPathInScope("src/high.ts", withoutTests)).toBe(true);
  });
});

describe("runScan", () => {
  it("loads scan defaults from repo config when options omit fields", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    try {
      await writeFile(
        join(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME),
        JSON.stringify({ since: "6 months ago" }),
        "utf8",
      );

      const result = await runScan({ repoPath });

      expect(result.version).toBe("3.0");
      expect(result).not.toHaveProperty("functions");
      expect(result.meta).not.toHaveProperty("granularity");
      expect(result.meta.since).toBe("6 months ago");
      expect(result.hotspots.length).toBeGreaterThanOrEqual(1);
      expect(result.hotspots[0]!.ncloc).toBeGreaterThan(0);
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("uses explicit options over repo config", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    try {
      await writeFile(
        join(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME),
        JSON.stringify({ since: "6 months ago" }),
        "utf8",
      );

      const result = await runScan({
        repoPath,
        since: "1 week ago",
      });

      expect(result.version).toBe("3.0");
      expect(result.meta.since).toBe("1 week ago");
      expect(result.hotspots.length).toBeGreaterThanOrEqual(1);
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("loads config from explicit configPath and skips repo-local file", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    const workspaceDir = await mkdtemp(
      join(tmpdir(), "hotspot-scan-explicit-"),
    );
    try {
      const explicitConfigPath = join(workspaceDir, "ci-config.json");
      await writeFile(
        explicitConfigPath,
        JSON.stringify({ since: "3 months ago" }),
        "utf8",
      );
      await writeFile(
        join(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME),
        JSON.stringify({ since: "6 months ago" }),
        "utf8",
      );

      const result = await runScan({
        repoPath,
        configPath: explicitConfigPath,
      });

      expect(result.version).toBe("3.0");
      expect(result.meta.since).toBe("3 months ago");
    } finally {
      await rm(repoPath, { recursive: true, force: true });
      await rm(workspaceDir, { recursive: true, force: true });
    }
  });

  it("uses explicit options over configPath file", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    const workspaceDir = await mkdtemp(
      join(tmpdir(), "hotspot-scan-override-"),
    );
    try {
      const explicitConfigPath = join(workspaceDir, "ci-config.json");
      await writeFile(
        explicitConfigPath,
        JSON.stringify({ since: "6 months ago" }),
        "utf8",
      );

      const result = await runScan({
        repoPath,
        configPath: explicitConfigPath,
        since: "1 week ago",
      });

      expect(result.version).toBe("3.0");
      expect(result.meta.since).toBe("1 week ago");
    } finally {
      await rm(repoPath, { recursive: true, force: true });
      await rm(workspaceDir, { recursive: true, force: true });
    }
  });

  it("throws ConfigError when configPath file is missing", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    const missingPath = join(tmpdir(), `missing-config-${Date.now()}.json`);
    try {
      await expect(
        runScan({ repoPath, configPath: missingPath }),
      ).rejects.toThrow(ConfigError);
      await expect(
        runScan({ repoPath, configPath: missingPath }),
      ).rejects.toThrow(/Config file not found/);
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("loads parent-walked config when configPath is omitted", async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), "hotspot-scan-walk-"));
    const repoPath = join(workspaceDir, "repo");
    try {
      await mkdir(repoPath, { recursive: true });
      await cp(smallTsFixture, repoPath, { recursive: true });
      await writeFile(
        join(workspaceDir, HOTSPOT_SCANNER_CONFIG_FILENAME),
        JSON.stringify({ since: "9 months ago" }),
        "utf8",
      );

      const result = await runScan({ repoPath });

      expect(result.meta.since).toBe("9 months ago");
    } finally {
      await rm(workspaceDir, { recursive: true, force: true });
    }
  });

  it("warns on unknown config keys without failing the scan", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    const onWarning = vi.fn();
    try {
      await writeFile(
        join(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME),
        JSON.stringify({ format: "json", unknownKey: true }),
        "utf8",
      );

      const result = await runScan({ repoPath, onWarning });

      const unknownConfigWarning = result.meta.warnings.find(
        (warning) => warning.code === "UNKNOWN_CONFIG_KEY",
      );
      expect(unknownConfigWarning).toEqual({
        code: "UNKNOWN_CONFIG_KEY",
        severity: "warning",
        message: "Unknown config key(s) ignored: format, unknownKey",
      });
      expect(onWarning).toHaveBeenCalledWith(unknownConfigWarning);
      expect(result.hotspots.length).toBeGreaterThanOrEqual(1);
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("throws ConfigError when repo config is invalid", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    try {
      await writeFile(
        join(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME),
        "{ not-json",
        "utf8",
      );

      await expect(runScan({ repoPath })).rejects.toThrow(ConfigError);
      await expect(runScan({ repoPath })).rejects.toThrow(/Invalid JSON/);
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("uses provided since when set", async () => {
    const result = await runScan({
      repoPath: smallTsFixture,
      since: "6 months ago",
    });

    expect(result.meta.since).toBe("6 months ago");
  });

  it("exports default constants", () => {
    expect(DEFAULT_SINCE).toBe("12 months ago");
    expect(DEFAULT_TOP).toBe(20);
  });

  it("throws when repoPath is not a directory", async () => {
    await expect(runScan({ repoPath: "package.json" })).rejects.toThrow(
      /not a directory/i,
    );
  });

  it("throws when repoPath does not exist", async () => {
    const missingPath = join(tmpdir(), `hotspot-scanner-missing-${Date.now()}`);
    await expect(runScan({ repoPath: missingPath })).rejects.toThrow(
      /does not exist or is not accessible/i,
    );
  });

  it("accepts optional diagnostics callbacks", async () => {
    const onWarning = vi.fn();
    const onProgress = vi.fn();

    const result = await runScan({
      repoPath: smallTsFixture,
      top: 5,
      onWarning,
      onProgress,
    });

    expect(result.hotspots.length).toBeGreaterThanOrEqual(1);
    expect(onProgress).toHaveBeenCalled();
    expect(Array.isArray(result.meta.warnings)).toBe(true);
  });

  it("always includes meta.warnings array and emits version 3.0 without functions", async () => {
    const result = await runScan({ repoPath: smallTsFixture });

    expect(result.version).toBe("3.0");
    expect(result).not.toHaveProperty("functions");
    expect(result).not.toHaveProperty("coupling");
    expect(result.meta).not.toHaveProperty("granularity");
    expect(result.meta.warnings).toEqual([]);
    expect(result.hotspots[0]!.ncloc).toBeGreaterThan(0);
  });

  it("includes meta.scannerVersion matching package.json", async () => {
    const packageJsonPath = join(
      fileURLToPath(new URL(".", import.meta.url)),
      "../package.json",
    );
    const { version } = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
      version: string;
    };

    const result = await runScan({ repoPath: smallTsFixture });

    expect(result.meta.scannerVersion).toBe(version);
    expect(result.meta.scannerVersion!.length).toBeGreaterThan(0);
  });

  it("passes merged concurrency from repo config to createComplexityAnalyzer", async () => {
    createComplexityAnalyzerSpy.mockClear();
    const repoPath = await createIsolatedSmallTsRepo();
    try {
      await writeFile(
        join(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME),
        JSON.stringify({ concurrency: 3 }),
        "utf8",
      );

      await runScan({ repoPath });

      expect(createComplexityAnalyzerSpy).toHaveBeenCalledWith({
        concurrency: 3,
      });
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("uses explicit concurrency option over repo config", async () => {
    createComplexityAnalyzerSpy.mockClear();
    const repoPath = await createIsolatedSmallTsRepo();
    try {
      await writeFile(
        join(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME),
        JSON.stringify({ concurrency: 3 }),
        "utf8",
      );

      await runScan({ repoPath, concurrency: 1 });

      expect(createComplexityAnalyzerSpy).toHaveBeenCalledWith({
        concurrency: 1,
      });
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("validates a temporary directory path and throws on non-git repo", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-"));
    try {
      await expect(runScan({ repoPath: tempDir })).rejects.toThrow(
        /not a git repository/i,
      );
      await expect(runScan({ repoPath: tempDir })).rejects.toThrow(
        /Hint:.*\.git/,
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("omits pathAllowlist from complexity analyze", async () => {
    analyzeSpy.mockClear();

    await runScan({ repoPath: smallTsFixture });

    expect(analyzeSpy).toHaveBeenCalledWith(
      expect.not.objectContaining({
        pathAllowlist: expect.anything(),
      }),
    );
  });

  it("runs git mine and complexity analyze concurrently by default", async () => {
    const { createGitMiner } =
      await vi.importActual<typeof import("./git/index.js")>("./git/index.js");
    const { createComplexityAnalyzer } = await vi.importActual<
      typeof import("./complexity/index.js")
    >("./complexity/index.js");

    let releaseMine!: () => void;
    let releaseAnalyze!: () => void;
    const mineGate = new Promise<void>((resolve) => {
      releaseMine = resolve;
    });
    const analyzeGate = new Promise<void>((resolve) => {
      releaseAnalyze = resolve;
    });

    let mineInFlight = false;
    let analyzeInFlight = false;
    let overlapObserved = false;

    mineOverride.fn = async (opts) => {
      mineInFlight = true;
      if (analyzeInFlight) {
        overlapObserved = true;
      }
      await mineGate;
      mineInFlight = false;
      return createGitMiner().mine(opts);
    };
    analyzeOverride.fn = async (opts) => {
      analyzeInFlight = true;
      if (mineInFlight) {
        overlapObserved = true;
      }
      await analyzeGate;
      analyzeInFlight = false;
      return createComplexityAnalyzer().analyze(opts);
    };

    const scanPromise = runScan({
      repoPath: smallTsFixture,
    });

    await vi.waitFor(() => {
      expect(mineInFlight).toBe(true);
      expect(analyzeInFlight).toBe(true);
    });
    expect(overlapObserved).toBe(true);

    releaseMine();
    releaseAnalyze();
    await scanPromise;

    mineOverride.fn = null;
    analyzeOverride.fn = null;
  });

  it("runs git mine then complexity analyze sequentially when sequential is true", async () => {
    const { createGitMiner } =
      await vi.importActual<typeof import("./git/index.js")>("./git/index.js");
    const { createComplexityAnalyzer } = await vi.importActual<
      typeof import("./complexity/index.js")
    >("./complexity/index.js");

    let releaseMine!: () => void;
    let releaseAnalyze!: () => void;
    const mineGate = new Promise<void>((resolve) => {
      releaseMine = resolve;
    });
    const analyzeGate = new Promise<void>((resolve) => {
      releaseAnalyze = resolve;
    });

    let mineInFlight = false;
    let analyzeInFlight = false;
    let overlapObserved = false;
    let mineCompleted = false;
    let analyzeStartedBeforeMineDone = false;

    mineOverride.fn = async (opts) => {
      mineInFlight = true;
      if (analyzeInFlight) {
        overlapObserved = true;
      }
      await mineGate;
      mineInFlight = false;
      mineCompleted = true;
      return createGitMiner().mine(opts);
    };
    analyzeOverride.fn = async (opts) => {
      if (!mineCompleted) {
        analyzeStartedBeforeMineDone = true;
      }
      analyzeInFlight = true;
      if (mineInFlight) {
        overlapObserved = true;
      }
      await analyzeGate;
      analyzeInFlight = false;
      return createComplexityAnalyzer().analyze(opts);
    };

    const scanPromise = runScan({
      repoPath: smallTsFixture,
      sequential: true,
    });

    await vi.waitFor(() => {
      expect(mineInFlight).toBe(true);
    });
    expect(analyzeInFlight).toBe(false);
    expect(overlapObserved).toBe(false);

    releaseMine();
    await vi.waitFor(() => {
      expect(analyzeInFlight).toBe(true);
    });
    expect(overlapObserved).toBe(false);
    expect(analyzeStartedBeforeMineDone).toBe(false);

    releaseAnalyze();
    await scanPromise;

    mineOverride.fn = null;
    analyzeOverride.fn = null;
  });

  it("does not score until both git and complexity complete", async () => {
    const { createGitMiner } =
      await vi.importActual<typeof import("./git/index.js")>("./git/index.js");
    const { createComplexityAnalyzer } = await vi.importActual<
      typeof import("./complexity/index.js")
    >("./complexity/index.js");

    let releaseMine!: () => void;
    let releaseAnalyze!: () => void;
    const mineGate = new Promise<void>((resolve) => {
      releaseMine = resolve;
    });
    const analyzeGate = new Promise<void>((resolve) => {
      releaseAnalyze = resolve;
    });

    scoreHotspotsSpy.mockClear();

    mineOverride.fn = async (opts) => {
      await mineGate;
      return createGitMiner().mine(opts);
    };
    analyzeOverride.fn = async (opts) => {
      await analyzeGate;
      return createComplexityAnalyzer().analyze(opts);
    };

    const scanPromise = runScan({
      repoPath: smallTsFixture,
    });

    await vi.waitFor(() => {
      expect(mineSpy).toHaveBeenCalled();
      expect(analyzeSpy).toHaveBeenCalled();
    });
    expect(scoreHotspotsSpy).not.toHaveBeenCalled();

    releaseMine();
    releaseAnalyze();
    await scanPromise;

    expect(scoreHotspotsSpy).toHaveBeenCalled();

    mineOverride.fn = null;
    analyzeOverride.fn = null;
  });

  it("aborts complexity and rethrows when git mine fails during overlap", async () => {
    const gitError = new GitLogError(
      smallTsFixture,
      "git log --numstat",
      "fatal",
    );

    let analyzeSignal: AbortSignal | undefined;
    let analyzeAborted = false;

    mineOverride.fn = async () => {
      throw gitError;
    };
    analyzeOverride.fn = async (opts) => {
      analyzeSignal = opts.signal;
      await new Promise<void>((_resolve, reject) => {
        if (opts.signal?.aborted) {
          analyzeAborted = true;
          reject(opts.signal.reason);
          return;
        }
        opts.signal?.addEventListener("abort", () => {
          analyzeAborted = true;
          reject(opts.signal?.reason);
        });
      });
      return { results: [], warnings: [] };
    };

    const rejection = runScan({
      repoPath: smallTsFixture,
    });

    await expect(rejection).rejects.toBe(gitError);
    await vi.waitFor(() => {
      expect(analyzeAborted).toBe(true);
    });
    expect(analyzeSignal?.aborted).toBe(true);

    mineOverride.fn = null;
    analyzeOverride.fn = null;
  });

  it("aborts git and rethrows when complexity analyze fails during overlap", async () => {
    const { createGitMiner } =
      await vi.importActual<typeof import("./git/index.js")>("./git/index.js");
    const cxError = new Error("complexity analyze failed");

    let mineSignal: AbortSignal | undefined;
    let mineAborted = false;

    mineOverride.fn = async (opts) => {
      mineSignal = opts.signal;
      opts.signal?.addEventListener("abort", () => {
        mineAborted = true;
      });
      return createGitMiner().mine(opts);
    };
    analyzeOverride.fn = async () => {
      throw cxError;
    };

    scoreHotspotsSpy.mockClear();

    await expect(runScan({ repoPath: smallTsFixture })).rejects.toBe(cxError);

    await vi.waitFor(() => {
      expect(mineAborted).toBe(true);
    });
    expect(mineSignal?.aborted).toBe(true);
    expect(scoreHotspotsSpy).not.toHaveBeenCalled();

    mineOverride.fn = null;
    analyzeOverride.fn = null;
  });

  it("rejects without scoring when git mine fails in sequential mode", async () => {
    const gitError = new GitLogError(
      smallTsFixture,
      "git log --numstat",
      "fatal",
    );

    mineOverride.fn = async () => {
      throw gitError;
    };
    analyzeOverride.fn = async () => ({
      results: [],
      warnings: [],
    });

    analyzeSpy.mockClear();
    scoreHotspotsSpy.mockClear();

    await expect(
      runScan({
        repoPath: smallTsFixture,
        sequential: true,
      }),
    ).rejects.toBe(gitError);
    expect(analyzeSpy).not.toHaveBeenCalled();
    expect(scoreHotspotsSpy).not.toHaveBeenCalled();

    mineOverride.fn = null;
    analyzeOverride.fn = null;
  });

  it("rejects without scoring when complexity analyze fails in sequential mode", async () => {
    const { createGitMiner } =
      await vi.importActual<typeof import("./git/index.js")>("./git/index.js");
    const cxError = new Error("complexity analyze failed");

    mineOverride.fn = async (opts) => createGitMiner().mine(opts);
    analyzeOverride.fn = async () => {
      throw cxError;
    };

    scoreHotspotsSpy.mockClear();

    await expect(
      runScan({
        repoPath: smallTsFixture,
        sequential: true,
      }),
    ).rejects.toBe(cxError);
    expect(scoreHotspotsSpy).not.toHaveBeenCalled();

    mineOverride.fn = null;
    analyzeOverride.fn = null;
  });

  it("aggregates git warnings before complexity warnings after overlap succeeds", async () => {
    const { createGitMiner } =
      await vi.importActual<typeof import("./git/index.js")>("./git/index.js");
    const { createComplexityAnalyzer } = await vi.importActual<
      typeof import("./complexity/index.js")
    >("./complexity/index.js");

    const gitWarning = {
      code: "GIT_WARNING",
      severity: "warning" as const,
      message: "git-stage warning",
    };
    const complexityWarning = {
      code: "CX_WARNING",
      severity: "warning" as const,
      message: "complexity-stage warning",
    };

    mineOverride.fn = async (opts) => {
      const result = await createGitMiner().mine(opts);
      return { ...result, warnings: [gitWarning] };
    };
    analyzeOverride.fn = async (opts) => {
      const result = await createComplexityAnalyzer().analyze(opts);
      return { ...result, warnings: [complexityWarning] };
    };

    const onWarning = vi.fn();
    const result = await runScan({
      repoPath: smallTsFixture,
      onWarning,
    });

    expect(result.meta.warnings).toEqual([gitWarning, complexityWarning]);
    expect(onWarning.mock.calls.map(([warning]) => warning)).toEqual([
      gitWarning,
      complexityWarning,
    ]);

    mineOverride.fn = null;
    analyzeOverride.fn = null;
  });

  it("passes AbortSignal to git mine and complexity analyze", async () => {
    mineSpy.mockClear();
    analyzeSpy.mockClear();

    await runScan({ repoPath: smallTsFixture });

    expect(mineSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
    expect(analyzeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("forwards onSpawnArgv to git miner", async () => {
    mineSpy.mockClear();
    const onSpawnArgv = vi.fn();

    await runScan({ repoPath: smallTsFixture, onSpawnArgv });

    expect(mineSpy).toHaveBeenCalledWith(
      expect.objectContaining({ onSpawnArgv }),
    );
  });

  it("includes meta.timings on successful scan without functionChurnMs", async () => {
    const result = await runScan({
      repoPath: smallTsFixture,
    });

    expect(result.meta.timings).toEqual(
      expect.objectContaining({
        gitMs: expect.any(Number),
        complexityMs: expect.any(Number),
        totalMs: expect.any(Number),
      }),
    );
    expect(result.meta.timings!.gitMs).toBeGreaterThanOrEqual(0);
    expect(result.meta.timings!.complexityMs).toBeGreaterThanOrEqual(0);
    expect(result.meta.timings!.totalMs).toBeGreaterThanOrEqual(0);
    expect(result.meta.timings).not.toHaveProperty("functionChurnMs");
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

  it("emits finalize once after git and complexity before scoring", async () => {
    const { createGitMiner } =
      await vi.importActual<typeof import("./git/index.js")>("./git/index.js");
    const { createComplexityAnalyzer } = await vi.importActual<
      typeof import("./complexity/index.js")
    >("./complexity/index.js");

    let releaseMine!: () => void;
    let releaseAnalyze!: () => void;
    const mineGate = new Promise<void>((resolve) => {
      releaseMine = resolve;
    });
    const analyzeGate = new Promise<void>((resolve) => {
      releaseAnalyze = resolve;
    });

    mineOverride.fn = async (opts) => {
      await mineGate;
      return createGitMiner().mine(opts);
    };
    analyzeOverride.fn = async (opts) => {
      await analyzeGate;
      return createComplexityAnalyzer().analyze(opts);
    };

    const onProgress = vi.fn();
    scoreHotspotsSpy.mockClear();

    const scanPromise = runScan({
      repoPath: smallTsFixture,
      onProgress,
    });

    await vi.waitFor(() => {
      expect(mineSpy).toHaveBeenCalled();
      expect(analyzeSpy).toHaveBeenCalled();
    });
    expect(onProgress).not.toHaveBeenCalledWith(
      expect.objectContaining({ phase: "finalize" }),
    );
    expect(scoreHotspotsSpy).not.toHaveBeenCalled();

    releaseMine();
    releaseAnalyze();
    await scanPromise;

    const finalizeCalls = onProgress.mock.calls.filter(
      ([progress]) => progress.phase === "finalize",
    );
    expect(finalizeCalls).toHaveLength(1);
    expect(finalizeCalls[0]![0]).toEqual({
      phase: "finalize",
      commitsProcessed: 0,
    });

    const phases = onProgress.mock.calls.map(([progress]) => progress.phase);
    const lastGitOrComplexity = Math.max(
      phases.lastIndexOf("git"),
      phases.lastIndexOf("complexity"),
    );
    const finalizeIndex = phases.lastIndexOf("finalize");
    expect(finalizeIndex).toBeGreaterThan(lastGitOrComplexity);
    expect(scoreHotspotsSpy).toHaveBeenCalled();

    mineOverride.fn = null;
    analyzeOverride.fn = null;
  });

  it("cancels in-flight stages when external signal aborts", async () => {
    const externalController = new AbortController();

    let mineSignal: AbortSignal | undefined;
    let analyzeSignal: AbortSignal | undefined;
    let mineAborted = false;
    let analyzeAborted = false;

    mineOverride.fn = async (opts) => {
      mineSignal = opts.signal;
      await new Promise<void>((_resolve, reject) => {
        if (opts.signal?.aborted) {
          mineAborted = true;
          reject(opts.signal.reason);
          return;
        }
        opts.signal?.addEventListener("abort", () => {
          mineAborted = true;
          reject(opts.signal?.reason);
        });
      });
      return {
        fileStats: new Map(),
        warnings: [],
        canonicalizePath: (path: string) => path,
      };
    };
    analyzeOverride.fn = async (opts) => {
      analyzeSignal = opts.signal;
      await new Promise<void>((_resolve, reject) => {
        if (opts.signal?.aborted) {
          analyzeAborted = true;
          reject(opts.signal.reason);
          return;
        }
        opts.signal?.addEventListener("abort", () => {
          analyzeAborted = true;
          reject(opts.signal?.reason);
        });
      });
      return { results: [], warnings: [] };
    };

    const scanPromise = runScan({
      repoPath: smallTsFixture,
      signal: externalController.signal,
    });

    await vi.waitFor(() => {
      expect(mineSignal).toBeDefined();
      expect(analyzeSignal).toBeDefined();
    });

    externalController.abort();

    await expect(scanPromise).rejects.toBeDefined();
    await vi.waitFor(() => {
      expect(mineAborted || analyzeAborted).toBe(true);
    });
    expect(mineSignal?.aborted || analyzeSignal?.aborted).toBe(true);

    mineOverride.fn = null;
    analyzeOverride.fn = null;
  });

  it("rejects when external signal is already aborted before mining", async () => {
    const externalController = new AbortController();
    externalController.abort(new DOMException("Aborted", "AbortError"));

    await expect(
      runScan({
        repoPath: smallTsFixture,
        signal: externalController.signal,
      }),
    ).rejects.toBeInstanceOf(DOMException);
  });

  it("passes onProgress to complexity analyze", async () => {
    analyzeSpy.mockClear();
    const onProgress = vi.fn();

    await runScan({
      repoPath: smallTsFixture,
      onProgress,
    });

    expect(analyzeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        onProgress,
      }),
    );
  });

  it("forwards complexity phase progress to onProgress", async () => {
    const onProgress = vi.fn();

    await runScan({
      repoPath: smallTsFixture,
      concurrency: 1,
      onProgress,
    });

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
  });

  it("remounts nested repoPath to git root with auto-include before PathScope", async () => {
    const { workspaceDir, packageDir } = await createNestedMonorepoFixture();
    mineSpy.mockClear();
    analyzeSpy.mockClear();

    try {
      const result = await runScan({ repoPath: packageDir });

      expect(mineSpy).toHaveBeenCalledWith(
        expect.objectContaining({ repoPath: workspaceDir }),
      );
      expect(analyzeSpy).toHaveBeenCalledWith(
        expect.objectContaining({ repoPath: workspaceDir }),
      );

      const scope = analyzeSpy.mock.calls[0]![0]!.scope;
      expect(isPathInScope("packages/api/src/high.ts", scope)).toBe(true);
      expect(isPathInScope("packages/other/src/high.ts", scope)).toBe(false);

      const remountWarning = result.meta.warnings.find(
        (warning) => warning.code === "MONOREPO_PATH_REMOUNT",
      );
      expect(remountWarning).toEqual({
        code: "MONOREPO_PATH_REMOUNT",
        severity: "info",
        message: expect.stringContaining(workspaceDir),
      });
      expect(remountWarning?.message).toContain("packages/api/**");
    } finally {
      await rm(workspaceDir, { recursive: true, force: true });
    }
  });

  it("remounts nested path without auto-include when include is explicit", async () => {
    const { workspaceDir, packageDir } = await createNestedMonorepoFixture();
    analyzeSpy.mockClear();

    try {
      const result = await runScan({
        repoPath: packageDir,
        include: ["packages/other/**"],
      });

      const scope = analyzeSpy.mock.calls[0]![0]!.scope;
      expect(isPathInScope("packages/other/src/high.ts", scope)).toBe(true);
      expect(isPathInScope("packages/api/src/high.ts", scope)).toBe(false);

      const remountWarning = result.meta.warnings.find(
        (warning) => warning.code === "MONOREPO_PATH_REMOUNT",
      );
      expect(remountWarning?.message).toContain(workspaceDir);
      expect(remountWarning?.message).not.toContain("auto-including");
    } finally {
      await rm(workspaceDir, { recursive: true, force: true });
    }
  });

  it("loads config from nested request path after remount", async () => {
    const { workspaceDir, packageDir } = await createNestedMonorepoFixture();

    try {
      await writeFile(
        join(packageDir, HOTSPOT_SCANNER_CONFIG_FILENAME),
        JSON.stringify({ since: "4 months ago" }),
        "utf8",
      );

      const result = await runScan({ repoPath: packageDir });

      expect(result.meta.since).toBe("4 months ago");
    } finally {
      await rm(workspaceDir, { recursive: true, force: true });
    }
  });

  it("auto-include beats config include when CLI include is absent", async () => {
    const { workspaceDir, packageDir } = await createNestedMonorepoFixture();
    analyzeSpy.mockClear();

    try {
      await writeFile(
        join(packageDir, HOTSPOT_SCANNER_CONFIG_FILENAME),
        JSON.stringify({ include: ["packages/other/**"] }),
        "utf8",
      );

      await runScan({ repoPath: packageDir });

      const scope = analyzeSpy.mock.calls[0]![0]!.scope;
      expect(isPathInScope("packages/api/src/high.ts", scope)).toBe(true);
      expect(isPathInScope("packages/other/src/high.ts", scope)).toBe(false);
    } finally {
      await rm(workspaceDir, { recursive: true, force: true });
    }
  });

  it("does not emit MONOREPO_PATH_REMOUNT for git-root scans", async () => {
    const result = await runScan({ repoPath: smallTsFixture });

    expect(
      result.meta.warnings.some(
        (warning) => warning.code === "MONOREPO_PATH_REMOUNT",
      ),
    ).toBe(false);
  });
});
