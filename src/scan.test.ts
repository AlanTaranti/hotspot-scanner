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
import { DEFAULT_MIN_COCHANGE } from "./scoring/index.js";
import {
  buildFunctionModePathAllowlist,
  DEFAULT_SINCE,
  DEFAULT_TOP,
  runScan,
} from "#scan";
import type { FileChangeStats } from "./types/index.js";

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
const createFunctionChurnMinerSpy = vi.hoisted(() => vi.fn());
const churnMineSpy = vi.hoisted(() => vi.fn());
const scoreCouplingSpy = vi.hoisted(() => vi.fn());
const scoreHotspotsSpy = vi.hoisted(() => vi.fn());

vi.mock("./git/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./git/index.js")>();
  return {
    ...actual,
    createGitMiner: (
      ...args: Parameters<typeof actual.createGitMiner>
    ) => {
      createGitMinerSpy(...args);
      if (mineOverride.fn) {
        return {
          mine: (mineArgs: Parameters<
            ReturnType<typeof actual.createGitMiner>["mine"]
          >[0]) => {
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
  const actual =
    await importOriginal<typeof import("./complexity/index.js")>();
  return {
    ...actual,
    createComplexityAnalyzer: (
      ...args: Parameters<typeof actual.createComplexityAnalyzer>
    ) => {
      createComplexityAnalyzerSpy(...args);
      if (analyzeOverride.fn) {
        return {
          analyze: (analyzeArgs: Parameters<
            ReturnType<typeof actual.createComplexityAnalyzer>["analyze"]
          >[0]) => {
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

vi.mock("./git/function-churn/index.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./git/function-churn/index.js")>();
  return {
    ...actual,
    createFunctionChurnMiner: (
      ...args: Parameters<typeof actual.createFunctionChurnMiner>
    ) => {
      createFunctionChurnMinerSpy(...args);
      const miner = actual.createFunctionChurnMiner(...args);
      return {
        mine: (...mineArgs: Parameters<typeof miner.mine>) => {
          churnMineSpy(...mineArgs);
          return miner.mine(...mineArgs);
        },
      };
    },
  };
});

vi.mock("./scoring/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./scoring/index.js")>();
  return {
    ...actual,
    createTemporalCouplingScorer: () => {
      const scorer = actual.createTemporalCouplingScorer();
      return {
        score: (...args: Parameters<typeof scorer.score>) => {
          scoreCouplingSpy(...args);
          return scorer.score(...args);
        },
      };
    },
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
  await execFileAsync(
    "git",
    ["config", "user.email", "test@example.com"],
    { cwd: workspaceDir },
  );
  await execFileAsync(
    "git",
    ["config", "user.name", "Test User"],
    { cwd: workspaceDir },
  );
  await execFileAsync("git", ["add", "."], { cwd: workspaceDir });
  await execFileAsync("git", ["commit", "-m", "init"], { cwd: workspaceDir });
  return { workspaceDir, packageDir };
}

describe("runScan", () => {
  it("loads scan defaults from repo config when options omit fields", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    try {
      await writeFile(
        join(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME),
        JSON.stringify({ since: "6 months ago", granularity: "function" }),
        "utf8",
      );

      const result = await runScan({ repoPath });

      expect(result.meta.since).toBe("6 months ago");
      expect(result.meta.granularity).toBe("function");
      expect(result.functions.length).toBeGreaterThanOrEqual(1);
      expect(result.hotspots).toEqual([]);
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("uses explicit options over repo config", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    try {
      await writeFile(
        join(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME),
        JSON.stringify({ since: "6 months ago", granularity: "function" }),
        "utf8",
      );

      const result = await runScan({
        repoPath,
        since: "1 week ago",
        granularity: "file",
      });

      expect(result.meta.since).toBe("1 week ago");
      expect(result.meta.granularity).toBe("file");
      expect(result.hotspots.length).toBeGreaterThanOrEqual(1);
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("loads config from explicit configPath and skips repo-local file", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    const workspaceDir = await mkdtemp(join(tmpdir(), "hotspot-scan-explicit-"));
    try {
      const explicitConfigPath = join(workspaceDir, "ci-config.json");
      await writeFile(
        explicitConfigPath,
        JSON.stringify({ since: "3 months ago", granularity: "function" }),
        "utf8",
      );
      await writeFile(
        join(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME),
        JSON.stringify({ since: "6 months ago", granularity: "file" }),
        "utf8",
      );

      const result = await runScan({
        repoPath,
        configPath: explicitConfigPath,
      });

      expect(result.meta.since).toBe("3 months ago");
      expect(result.meta.granularity).toBe("function");
    } finally {
      await rm(repoPath, { recursive: true, force: true });
      await rm(workspaceDir, { recursive: true, force: true });
    }
  });

  it("uses explicit options over configPath file", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    const workspaceDir = await mkdtemp(join(tmpdir(), "hotspot-scan-override-"));
    try {
      const explicitConfigPath = join(workspaceDir, "ci-config.json");
      await writeFile(
        explicitConfigPath,
        JSON.stringify({ since: "6 months ago", granularity: "function" }),
        "utf8",
      );

      const result = await runScan({
        repoPath,
        configPath: explicitConfigPath,
        since: "1 week ago",
        granularity: "file",
      });

      expect(result.meta.since).toBe("1 week ago");
      expect(result.meta.granularity).toBe("file");
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
    expect(DEFAULT_MIN_COCHANGE).toBe(3);
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
      minCochange: 4,
      onWarning,
      onProgress,
    });

    expect(result.hotspots.length).toBeGreaterThanOrEqual(1);
    expect(onProgress).toHaveBeenCalled();
    expect(Array.isArray(result.meta.warnings)).toBe(true);
  });

  it("always includes meta.warnings array", async () => {
    const result = await runScan({ repoPath: smallTsFixture });

    expect(result.meta.warnings).toEqual([]);
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

  it("does not construct or invoke the function churn miner in file mode", async () => {
    createFunctionChurnMinerSpy.mockClear();
    churnMineSpy.mockClear();

    await runScan({ repoPath: smallTsFixture, granularity: "file" });

    expect(createFunctionChurnMinerSpy).not.toHaveBeenCalled();
    expect(churnMineSpy).not.toHaveBeenCalled();
  });

  it("passes pathAllowlist to complexity analyze in function mode", async () => {
    analyzeSpy.mockClear();

    await runScan({ repoPath: smallTsFixture, granularity: "function" });

    expect(analyzeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        pathAllowlist: expect.arrayContaining(["src/high.ts"]),
      }),
    );
    const analyzeArgs = analyzeSpy.mock.calls[0]![0]!;
    expect(analyzeArgs.pathAllowlist).toEqual(
      [...analyzeArgs.pathAllowlist!].sort(),
    );
  });

  it("passes the same allowlist paths to function churn miner in function mode", async () => {
    analyzeSpy.mockClear();
    churnMineSpy.mockClear();

    await runScan({ repoPath: smallTsFixture, granularity: "function" });

    const pathAllowlist = analyzeSpy.mock.calls[0]![0]!.pathAllowlist;
    expect(churnMineSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        paths: pathAllowlist,
      }),
    );
  });

  it("omits pathAllowlist from complexity analyze in file mode", async () => {
    analyzeSpy.mockClear();

    await runScan({ repoPath: smallTsFixture, granularity: "file" });

    expect(analyzeSpy).toHaveBeenCalledWith(
      expect.not.objectContaining({
        pathAllowlist: expect.anything(),
      }),
    );
  });

  it("runs git mine and complexity analyze concurrently in file mode", async () => {
    const { createGitMiner } =
      await vi.importActual<typeof import("./git/index.js")>("./git/index.js");
    const { createComplexityAnalyzer } =
      await vi.importActual<typeof import("./complexity/index.js")>(
        "./complexity/index.js",
      );

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
      granularity: "file",
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

  it("does not score until both git and complexity complete in file mode", async () => {
    const { createGitMiner } =
      await vi.importActual<typeof import("./git/index.js")>("./git/index.js");
    const { createComplexityAnalyzer } =
      await vi.importActual<typeof import("./complexity/index.js")>(
        "./complexity/index.js",
      );

    let releaseMine!: () => void;
    let releaseAnalyze!: () => void;
    const mineGate = new Promise<void>((resolve) => {
      releaseMine = resolve;
    });
    const analyzeGate = new Promise<void>((resolve) => {
      releaseAnalyze = resolve;
    });

    scoreCouplingSpy.mockClear();
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
      granularity: "file",
    });

    await vi.waitFor(() => {
      expect(mineSpy).toHaveBeenCalled();
      expect(analyzeSpy).toHaveBeenCalled();
    });
    expect(scoreCouplingSpy).not.toHaveBeenCalled();
    expect(scoreHotspotsSpy).not.toHaveBeenCalled();

    releaseMine();
    releaseAnalyze();
    await scanPromise;

    expect(scoreCouplingSpy).toHaveBeenCalled();
    expect(scoreHotspotsSpy).toHaveBeenCalled();

    mineOverride.fn = null;
    analyzeOverride.fn = null;
  });

  it("starts function churn only after complexity and not during numstat", async () => {
    const { createGitMiner } =
      await vi.importActual<typeof import("./git/index.js")>("./git/index.js");
    const { createComplexityAnalyzer } =
      await vi.importActual<typeof import("./complexity/index.js")>(
        "./complexity/index.js",
      );

    let releaseMine!: () => void;
    let releaseAnalyze!: () => void;
    const mineGate = new Promise<void>((resolve) => {
      releaseMine = resolve;
    });
    const analyzeGate = new Promise<void>((resolve) => {
      releaseAnalyze = resolve;
    });

    let numstatInFlight = false;
    let analyzeCompleted = false;
    let churnStartedDuringNumstat = false;
    let churnStartedBeforeAnalyze = false;

    churnMineSpy.mockClear();

    mineOverride.fn = async (opts) => {
      numstatInFlight = true;
      await mineGate;
      numstatInFlight = false;
      return createGitMiner().mine(opts);
    };
    analyzeOverride.fn = async (opts) => {
      await analyzeGate;
      analyzeCompleted = true;
      return createComplexityAnalyzer().analyze(opts);
    };

    churnMineSpy.mockImplementation(async (opts) => {
      if (numstatInFlight) {
        churnStartedDuringNumstat = true;
      }
      if (!analyzeCompleted) {
        churnStartedBeforeAnalyze = true;
      }
      const { createFunctionChurnMiner } =
        await vi.importActual<typeof import("./git/function-churn/index.js")>(
          "./git/function-churn/index.js",
        );
      return createFunctionChurnMiner().mine(opts);
    });

    const scanPromise = runScan({
      repoPath: smallTsFixture,
      granularity: "function",
    });

    releaseMine();
    await vi.waitFor(() => {
      expect(analyzeSpy).toHaveBeenCalled();
    });
    expect(churnMineSpy).not.toHaveBeenCalled();

    releaseAnalyze();
    await scanPromise;

    expect(churnMineSpy).toHaveBeenCalled();
    expect(churnStartedDuringNumstat).toBe(false);
    expect(churnStartedBeforeAnalyze).toBe(false);

    mineOverride.fn = null;
    analyzeOverride.fn = null;
    churnMineSpy.mockRestore();
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
      return { results: [], functions: [], warnings: [] };
    };

    const rejection = runScan({
      repoPath: smallTsFixture,
      granularity: "file",
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

    scoreCouplingSpy.mockClear();
    scoreHotspotsSpy.mockClear();

    await expect(
      runScan({ repoPath: smallTsFixture, granularity: "file" }),
    ).rejects.toBe(cxError);

    await vi.waitFor(() => {
      expect(mineAborted).toBe(true);
    });
    expect(mineSignal?.aborted).toBe(true);
    expect(scoreCouplingSpy).not.toHaveBeenCalled();
    expect(scoreHotspotsSpy).not.toHaveBeenCalled();

    mineOverride.fn = null;
    analyzeOverride.fn = null;
  });

  it("aggregates git warnings before complexity warnings after overlap succeeds", async () => {
    const { createGitMiner } =
      await vi.importActual<typeof import("./git/index.js")>("./git/index.js");
    const { createComplexityAnalyzer } =
      await vi.importActual<typeof import("./complexity/index.js")>(
        "./complexity/index.js",
      );

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
      granularity: "file",
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

    await runScan({ repoPath: smallTsFixture, granularity: "file" });

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

  it.each(["file", "function"] as const)(
    "passes onProgress to complexity analyze in %s mode",
    async (granularity) => {
      analyzeSpy.mockClear();
      const onProgress = vi.fn();

      await runScan({
        repoPath: smallTsFixture,
        granularity,
        onProgress,
      });

      expect(analyzeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          onProgress,
        }),
      );
    },
  );

  it("forwards complexity phase progress to onProgress in file mode", async () => {
    const onProgress = vi.fn();

    await runScan({
      repoPath: smallTsFixture,
      granularity: "file",
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

describe("buildFunctionModePathAllowlist", () => {
  it("returns eligible churned paths in stable sort order", () => {
    const fileStats = new Map<string, FileChangeStats>([
      [
        "src/z.ts",
        {
          filePath: "src/z.ts",
          commitCount: 1,
          linesChanged: 1,
          authors: new Set(),
          lastModified: new Date(),
        },
      ],
      [
        "src/a.ts",
        {
          filePath: "src/a.ts",
          commitCount: 2,
          linesChanged: 2,
          authors: new Set(),
          lastModified: new Date(),
        },
      ],
      [
        "README.md",
        {
          filePath: "README.md",
          commitCount: 1,
          linesChanged: 1,
          authors: new Set(),
          lastModified: new Date(),
        },
      ],
    ]);

    expect(
      buildFunctionModePathAllowlist(fileStats, [".ts", ".tsx", ".js", ".jsx"]),
    ).toEqual(["src/a.ts", "src/z.ts"]);
  });
});
