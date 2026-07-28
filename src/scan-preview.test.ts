import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ConfigError,
  HOTSPOT_SCANNER_CONFIG_FILENAME,
} from "./config/index.js";
import { DEFAULT_WORKER_CONCURRENCY } from "./complexity/pool.js";
import { formatScanScopePreview, previewScanScope } from "./scan-preview.js";
import { DEFAULT_SINCE } from "./scan.js";

const execFileAsync = promisify(execFile);

const createGitMinerSpy = vi.hoisted(() => vi.fn());
const mineSpy = vi.hoisted(() => vi.fn());
const createComplexityAnalyzerSpy = vi.hoisted(() => vi.fn());
const analyzeSpy = vi.hoisted(() => vi.fn());
const scoreHotspotsSpy = vi.hoisted(() => vi.fn());

vi.mock("./git/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./git/index.js")>();
  return {
    ...actual,
    createGitMiner: (...args: Parameters<typeof actual.createGitMiner>) => {
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
  const actual = await importOriginal<typeof import("./complexity/index.js")>();
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

const tempDirs: string[] = [];

async function createIsolatedSmallTsRepo(): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), "hotspot-preview-"));
  tempDirs.push(tempDir);
  await cp(smallTsFixture, tempDir, { recursive: true });
  return tempDir;
}

async function createNestedMonorepoFixture(): Promise<{
  workspaceDir: string;
  packageDir: string;
}> {
  const workspaceDir = await mkdtemp(
    join(tmpdir(), "hotspot-preview-monorepo-"),
  );
  tempDirs.push(workspaceDir);
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

afterEach(async () => {
  createGitMinerSpy.mockClear();
  mineSpy.mockClear();
  createComplexityAnalyzerSpy.mockClear();
  analyzeSpy.mockClear();
  scoreHotspotsSpy.mockClear();

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
      includeTests: false,
      eligibleFileCount: 2,
      concurrency: 2,
      configPath: null,
      unknownConfigKeys: [],
    });
    expect(createGitMinerSpy).not.toHaveBeenCalled();
    expect(mineSpy).not.toHaveBeenCalled();
    expect(createComplexityAnalyzerSpy).not.toHaveBeenCalled();
    expect(analyzeSpy).not.toHaveBeenCalled();
    expect(scoreHotspotsSpy).not.toHaveBeenCalled();
  });

  it("excludes test files by default and includes them when includeTests is true", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    await writeFile(
      join(repoPath, "src/app.test.ts"),
      "export const test = 1;\n",
      "utf8",
    );
    await execFileAsync("git", ["add", "src/app.test.ts"], { cwd: repoPath });

    const defaultPreview = await previewScanScope({ repoPath });
    const withTestsPreview = await previewScanScope({
      repoPath,
      includeTests: true,
    });

    expect(defaultPreview.includeTests).toBe(false);
    expect(withTestsPreview.includeTests).toBe(true);
    expect(withTestsPreview.eligibleFileCount).toBe(
      defaultPreview.eligibleFileCount + 1,
    );
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
    expect(preview.configPath).toBe(
      resolve(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME),
    );
    expect(preview.unknownConfigKeys).toEqual([]);
  });

  it("reports configPath none when no config file is found", async () => {
    const repoPath = await createIsolatedSmallTsRepo();

    const preview = await previewScanScope({ repoPath });

    expect(preview.configPath).toBeNull();
    expect(preview.unknownConfigKeys).toEqual([]);
  });

  it("loads explicit configPath and surfaces its absolute path", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    const explicitConfigPath = join(repoPath, "custom-config.json");
    await writeFile(
      explicitConfigPath,
      JSON.stringify({ since: "9 months ago" }),
      "utf8",
    );

    const preview = await previewScanScope({
      repoPath,
      configPath: explicitConfigPath,
    });

    expect(preview.configPath).toBe(resolve(explicitConfigPath));
    expect(preview.since).toBe("9 months ago");
  });

  it("includes remount message when scanning a nested package path", async () => {
    const { workspaceDir, packageDir } = await createNestedMonorepoFixture();

    const preview = await previewScanScope({ repoPath: packageDir });

    expect(preview.repoPath).toBe(workspaceDir);
    expect(preview.remountMessage).toContain("remounted to git root");
    expect(preview.remountMessage).toContain(workspaceDir);
    expect(preview.remountMessage).toContain("packages/api/**");
    expect(createGitMinerSpy).not.toHaveBeenCalled();
    expect(analyzeSpy).not.toHaveBeenCalled();
  });

  it("lists unknown config keys and ignores reserved meta keys", async () => {
    const repoPath = await createIsolatedSmallTsRepo();
    await writeFile(
      join(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME),
      JSON.stringify({
        $schema: "https://example.com/schema.json",
        $comments: ["docs"],
        typoKey: true,
        anotherTypo: "x",
      }),
      "utf8",
    );

    const preview = await previewScanScope({ repoPath });

    expect(preview.unknownConfigKeys).toEqual(["anotherTypo", "typoKey"]);
    expect(preview.configPath).toBe(
      resolve(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME),
    );
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
    await expect(previewScanScope({ repoPath })).rejects.toThrow(
      /Invalid JSON/,
    );
  });
});

describe("formatScanScopePreview", () => {
  it("prints effective scope fields as plain text lines", () => {
    const output = formatScanScopePreview({
      repoPath: "/tmp/repo",
      since: "12 months ago",
      include: [],
      exclude: ["src/legacy/**"],
      includeTests: false,
      eligibleFileCount: 7,
      concurrency: 4,
      configPath: null,
      unknownConfigKeys: [],
    });

    expect(output).toBe(
      [
        "repo: /tmp/repo",
        "config file: none",
        "since: 12 months ago",
        "include: []",
        'exclude: ["src/legacy/**"]',
        "default excludes: always on",
        "test files: excluded",
        "eligible files: 7",
        "concurrency: 4",
      ].join("\n") + "\n",
    );
  });

  it("prints remount and unknown config key lines when present", () => {
    const output = formatScanScopePreview({
      repoPath: "/tmp/repo",
      since: "12 months ago",
      include: [],
      exclude: [],
      includeTests: false,
      eligibleFileCount: 3,
      concurrency: 4,
      configPath: "/tmp/repo/.hotspot-scanner.json",
      remountMessage:
        "Scan path remounted to git root /tmp/repo; auto-including packages/api/**",
      unknownConfigKeys: ["typoKey"],
    });

    expect(output).toBe(
      [
        "repo: /tmp/repo",
        "config file: /tmp/repo/.hotspot-scanner.json",
        "Scan path remounted to git root /tmp/repo; auto-including packages/api/**",
        "Unknown config key(s) ignored: typoKey",
        "since: 12 months ago",
        "include: []",
        "exclude: []",
        "default excludes: always on",
        "test files: excluded",
        "eligible files: 3",
        "concurrency: 4",
      ].join("\n") + "\n",
    );
  });

  it("prints test files included when includeTests is true", () => {
    const output = formatScanScopePreview({
      repoPath: "/tmp/repo",
      since: "12 months ago",
      include: [],
      exclude: [],
      includeTests: true,
      eligibleFileCount: 8,
      concurrency: 4,
      configPath: null,
      unknownConfigKeys: [],
    });

    expect(output).toContain("test files: included");
    expect(output).not.toContain("test files: excluded");
  });
});
