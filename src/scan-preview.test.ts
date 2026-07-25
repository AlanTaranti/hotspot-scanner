import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ConfigError,
  HOTSPOT_SCANNER_CONFIG_FILENAME,
} from "./config/index.js";
import { DEFAULT_WORKER_CONCURRENCY } from "./complexity/pool.js";
import {
  formatScanScopePreview,
  previewScanScope,
} from "./scan-preview.js";
import { DEFAULT_SINCE } from "./scan.js";

const createGitMinerSpy = vi.hoisted(() => vi.fn());
const mineSpy = vi.hoisted(() => vi.fn());
const createComplexityAnalyzerSpy = vi.hoisted(() => vi.fn());
const analyzeSpy = vi.hoisted(() => vi.fn());
const scoreCouplingSpy = vi.hoisted(() => vi.fn());
const scoreHotspotsSpy = vi.hoisted(() => vi.fn());
const scoreFunctionHotspotsSpy = vi.hoisted(() => vi.fn());

vi.mock("./git/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./git/index.js")>();
  return {
    ...actual,
    createGitMiner: (
      ...args: Parameters<typeof actual.createGitMiner>
    ) => {
      createGitMinerSpy(...args);
      const miner = actual.createGitMiner(...args);
      return {
        mine: (...mineArgs: Parameters<typeof miner.mine>) => {
          mineSpy(...mineArgs);
          return miner.mine(...mineArgs);
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
      const analyzer = actual.createComplexityAnalyzer(...args);
      return {
        analyze: (...analyzeArgs: Parameters<typeof analyzer.analyze>) => {
          analyzeSpy(...analyzeArgs);
          return analyzer.analyze(...analyzeArgs);
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
    createFunctionHotspotScorer: () => {
      const scorer = actual.createFunctionHotspotScorer();
      return {
        score: (...args: Parameters<typeof scorer.score>) => {
          scoreFunctionHotspotsSpy(...args);
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

const tempDirs: string[] = [];

async function createIsolatedSmallTsRepo(): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), "hotspot-preview-"));
  tempDirs.push(tempDir);
  await cp(smallTsFixture, tempDir, { recursive: true });
  return tempDir;
}

afterEach(async () => {
  createGitMinerSpy.mockClear();
  mineSpy.mockClear();
  createComplexityAnalyzerSpy.mockClear();
  analyzeSpy.mockClear();
  scoreCouplingSpy.mockClear();
  scoreHotspotsSpy.mockClear();
  scoreFunctionHotspotsSpy.mockClear();

  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("previewScanScope", () => {
  it("returns effective scope fields and eligible file count", async () => {
    const repoPath = await createIsolatedSmallTsRepo();

    const preview = await previewScanScope({
      repoPath,
      since: "6 months ago",
      include: ["src/**"],
      exclude: ["src/low.ts"],
      concurrency: 2,
    });

    expect(preview).toEqual({
      repoPath,
      since: "6 months ago",
      include: ["src/**"],
      exclude: ["src/low.ts"],
      eligibleFileCount: 2,
      concurrency: 2,
    });
    expect(createGitMinerSpy).not.toHaveBeenCalled();
    expect(mineSpy).not.toHaveBeenCalled();
    expect(createComplexityAnalyzerSpy).not.toHaveBeenCalled();
    expect(analyzeSpy).not.toHaveBeenCalled();
    expect(scoreCouplingSpy).not.toHaveBeenCalled();
    expect(scoreHotspotsSpy).not.toHaveBeenCalled();
    expect(scoreFunctionHotspotsSpy).not.toHaveBeenCalled();
  });

  it("merges repo config the same way as a full scan prelude", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    await writeFile(
      join(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME),
      JSON.stringify({
        since: "3 months ago",
        include: ["src/**"],
        exclude: ["src/medium.ts"],
        concurrency: 4,
      }),
      "utf8",
    );

    const preview = await previewScanScope({
      repoPath,
      since: "1 week ago",
      concurrency: 1,
    });

    expect(preview.since).toBe("1 week ago");
    expect(preview.include).toEqual(["src/**"]);
    expect(preview.exclude).toEqual(["src/medium.ts"]);
    expect(preview.concurrency).toBe(1);
    expect(preview.eligibleFileCount).toBe(2);
  });

  it("uses defaults when include and exclude are unset", async () => {
    const repoPath = await createIsolatedSmallTsRepo();

    const preview = await previewScanScope({ repoPath });

    expect(preview.since).toBe(DEFAULT_SINCE);
    expect(preview.include).toEqual([]);
    expect(preview.exclude).toEqual([]);
    expect(preview.concurrency).toBe(DEFAULT_WORKER_CONCURRENCY);
    expect(preview.eligibleFileCount).toBeGreaterThan(0);
  });

  it("returns eligibleFileCount 0 without throwing when no eligible files match", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    await rm(join(repoPath, "src"), { recursive: true, force: true });
    await mkdir(join(repoPath, "docs"), { recursive: true });
    await writeFile(join(repoPath, "docs/readme.md"), "# docs", "utf8");

    const preview = await previewScanScope({
      repoPath,
      include: ["docs/**"],
    });

    expect(preview.eligibleFileCount).toBe(0);
    expect(createGitMinerSpy).not.toHaveBeenCalled();
    expect(analyzeSpy).not.toHaveBeenCalled();
  });

  it("throws when repoPath does not exist", async () => {
    const missingPath = join(tmpdir(), `hotspot-preview-missing-${Date.now()}`);

    await expect(previewScanScope({ repoPath: missingPath })).rejects.toThrow(
      /does not exist or is not accessible/i,
    );
  });

  it("throws when repoPath is not a directory", async () => {
    await expect(
      previewScanScope({ repoPath: "package.json" }),
    ).rejects.toThrow(/not a directory/i);
  });

  it("throws when repoPath is not a git repository", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-preview-nogit-"));
    tempDirs.push(tempDir);

    await expect(previewScanScope({ repoPath: tempDir })).rejects.toThrow(
      /not a git repository/i,
    );
  });

  it("throws ConfigError when configPath file is missing", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    const missingPath = join(tmpdir(), `missing-config-${Date.now()}.json`);

    await expect(
      previewScanScope({ repoPath, configPath: missingPath }),
    ).rejects.toThrow(ConfigError);
    await expect(
      previewScanScope({ repoPath, configPath: missingPath }),
    ).rejects.toThrow(/Config file not found/);
  });

  it("throws ConfigError when repo config is invalid", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    await writeFile(
      join(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME),
      "{ not-json",
      "utf8",
    );

    await expect(previewScanScope({ repoPath })).rejects.toThrow(ConfigError);
    await expect(previewScanScope({ repoPath })).rejects.toThrow(/Invalid JSON/);
  });
});

describe("formatScanScopePreview", () => {
  it("prints effective scope fields as plain text lines", () => {
    const output = formatScanScopePreview({
      repoPath: "/tmp/repo",
      since: "12 months ago",
      include: [],
      exclude: ["src/legacy/**"],
      eligibleFileCount: 7,
      concurrency: 4,
    });

    expect(output).toBe(
      [
        "repo: /tmp/repo",
        "since: 12 months ago",
        "include: []",
        'exclude: ["src/legacy/**"]',
        "default excludes: always on",
        "eligible files: 7",
        "concurrency: 4",
      ].join("\n") + "\n",
    );
  });
});
