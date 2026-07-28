import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_WORKER_CONCURRENCY } from "../complexity/pool.js";
import { DEFAULT_SINCE, DEFAULT_TOP } from "../scan.js";
import { HOTSPOT_SCANNER_CONFIG_FILENAME } from "./load-config.js";
import {
  loadMergedScanConfigWithSources,
  mergeScanOptions,
  mergeScanOptionsWithSources,
} from "./merge-options.js";

describe("mergeScanOptions", () => {
  const config = {
    since: "6 months ago",
    include: ["src/**"],
    exclude: ["**/*.test.ts"],
    top: 10,
    concurrency: 3,
  };

  it("uses built-in defaults when config and cli are absent", () => {
    expect(mergeScanOptions({})).toEqual({
      since: DEFAULT_SINCE,
      include: undefined,
      exclude: undefined,
      top: DEFAULT_TOP,
      concurrency: DEFAULT_WORKER_CONCURRENCY,
    });
  });

  it("uses config values over defaults", () => {
    expect(mergeScanOptions({ config })).toEqual({
      since: "6 months ago",
      include: ["src/**"],
      exclude: ["**/*.test.ts"],
      top: 10,
      concurrency: 3,
    });
  });

  it("uses cli values over config and defaults", () => {
    expect(
      mergeScanOptions({
        config,
        cli: {
          since: "1 week ago",
          include: ["lib/**"],
          exclude: ["generated/**"],
          top: 50,
          concurrency: 1,
        },
      }),
    ).toEqual({
      since: "1 week ago",
      include: ["lib/**"],
      exclude: ["generated/**"],
      top: 50,
      concurrency: 1,
    });
  });

  it("applies per-field precedence CLI > config > defaults", () => {
    expect(
      mergeScanOptions({
        config: { since: "config-since", top: 15 },
        cli: { top: 25 },
      }),
    ).toEqual({
      since: "config-since",
      include: undefined,
      exclude: undefined,
      top: 25,
      concurrency: DEFAULT_WORKER_CONCURRENCY,
    });
  });

  it("treats null config as absent", () => {
    expect(
      mergeScanOptions({
        config: null,
        cli: { since: "cli-since" },
      }),
    ).toEqual({
      since: "cli-since",
      include: undefined,
      exclude: undefined,
      top: DEFAULT_TOP,
      concurrency: DEFAULT_WORKER_CONCURRENCY,
    });
  });

  it("allows cli empty include array to override config include", () => {
    expect(
      mergeScanOptions({
        config: { include: ["src/**"] },
        cli: { include: [] },
      }),
    ).toEqual({
      since: DEFAULT_SINCE,
      include: [],
      exclude: undefined,
      top: DEFAULT_TOP,
      concurrency: DEFAULT_WORKER_CONCURRENCY,
    });
  });

  it("uses DEFAULT_WORKER_CONCURRENCY when concurrency is unset", () => {
    expect(mergeScanOptions({})).toMatchObject({
      concurrency: DEFAULT_WORKER_CONCURRENCY,
    });
  });

  it("uses config concurrency over default", () => {
    expect(mergeScanOptions({ config: { concurrency: 2 } })).toMatchObject({
      concurrency: 2,
    });
  });

  it("uses cli concurrency over config and default", () => {
    expect(
      mergeScanOptions({
        config: { concurrency: 2 },
        cli: { concurrency: 8 },
      }),
    ).toMatchObject({
      concurrency: 8,
    });
  });
});

describe("mergeScanOptionsWithSources", () => {
  const config = {
    since: "6 months ago",
    include: ["src/**"],
    exclude: ["**/*.test.ts"],
    top: 10,
    concurrency: 3,
  };

  it("tags all fields as default when config and cli are absent", () => {
    expect(mergeScanOptionsWithSources({}, null)).toEqual({
      values: {
        since: DEFAULT_SINCE,
        include: undefined,
        exclude: undefined,
        top: DEFAULT_TOP,
        concurrency: DEFAULT_WORKER_CONCURRENCY,
      },
      sources: {
        since: "default",
        include: "default",
        exclude: "default",
        top: "default",
        concurrency: "default",
      },
      configPath: null,
    });
  });

  it("tags config-provided fields as config", () => {
    expect(
      mergeScanOptionsWithSources({ config }, "/repo/.hotspot-scanner.json"),
    ).toEqual({
      values: {
        since: "6 months ago",
        include: ["src/**"],
        exclude: ["**/*.test.ts"],
        top: 10,
        concurrency: 3,
      },
      sources: {
        since: "config",
        include: "config",
        exclude: "config",
        top: "config",
        concurrency: "config",
      },
      configPath: "/repo/.hotspot-scanner.json",
    });
  });

  it("tags cli overrides as cli per field", () => {
    expect(
      mergeScanOptionsWithSources(
        {
          config: { since: "config-since", top: 15 },
          cli: { top: 25, include: ["lib/**"] },
        },
        "/repo/.hotspot-scanner.json",
      ),
    ).toEqual({
      values: {
        since: "config-since",
        include: ["lib/**"],
        exclude: undefined,
        top: 25,
        concurrency: DEFAULT_WORKER_CONCURRENCY,
      },
      sources: {
        since: "config",
        include: "cli",
        exclude: "default",
        top: "cli",
        concurrency: "default",
      },
      configPath: "/repo/.hotspot-scanner.json",
    });
  });

  it("tags cli empty include array as cli", () => {
    expect(
      mergeScanOptionsWithSources(
        {
          config: { include: ["src/**"] },
          cli: { include: [] },
        },
        null,
      ).sources.include,
    ).toBe("cli");
  });
});

describe("loadMergedScanConfigWithSources", () => {
  it("loads config from repo and merges with cli overrides", async () => {
    const repoPath = await mkdtemp(join(tmpdir(), "hotspot-merge-sources-"));
    try {
      const configPath = join(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME);
      await writeFile(
        configPath,
        JSON.stringify({ since: "6 months ago", top: 15 }),
        "utf8",
      );

      const result = await loadMergedScanConfigWithSources({
        repoPath,
        cli: { top: 25 },
      });

      expect(result.configPath).toBe(configPath);
      expect(result.values).toMatchObject({
        since: "6 months ago",
        top: 25,
      });
      expect(result.sources).toMatchObject({
        since: "config",
        top: "cli",
      });
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("returns null configPath when no config file is found", async () => {
    const repoPath = await mkdtemp(join(tmpdir(), "hotspot-merge-sources-"));
    try {
      const result = await loadMergedScanConfigWithSources({ repoPath });

      expect(result.configPath).toBeNull();
      expect(result.sources.since).toBe("default");
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("uses explicit configPath when provided", async () => {
    const repoPath = await mkdtemp(join(tmpdir(), "hotspot-merge-sources-"));
    try {
      const nestedDir = join(repoPath, "packages", "app");
      const configPath = join(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME);
      await mkdir(nestedDir, { recursive: true });
      await writeFile(
        configPath,
        JSON.stringify({ since: "1 year ago" }),
        "utf8",
      );

      const result = await loadMergedScanConfigWithSources({
        repoPath: nestedDir,
        configPath,
      });

      expect(result.configPath).toBe(configPath);
      expect(result.values.since).toBe("1 year ago");
      expect(result.sources.since).toBe("config");
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });
});
