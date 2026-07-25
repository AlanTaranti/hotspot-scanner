import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ConfigError,
  HOTSPOT_SCANNER_CONFIG_FILENAME,
  loadHotspotScannerConfig,
  parseHotspotScannerConfig,
} from "./load-config.js";

async function withTempRepo(
  files: Record<string, string>,
  run: (repoPath: string) => Promise<void>,
): Promise<void> {
  const repoPath = await mkdtemp(join(tmpdir(), "hotspot-config-"));
  try {
    for (const [name, content] of Object.entries(files)) {
      const filePath = join(repoPath, name);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, content, "utf8");
    }
    await run(repoPath);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
}

describe("parseHotspotScannerConfig", () => {
  it("accepts valid keys", () => {
    expect(
      parseHotspotScannerConfig({
        since: "6 months ago",
        include: ["src/**"],
        exclude: ["**/*.test.ts"],
        granularity: "function",
        minCochange: 5,
        megaCommitThreshold: 200,
        top: 10,
        concurrency: 2,
      }),
    ).toEqual({
      config: {
        since: "6 months ago",
        include: ["src/**"],
        exclude: ["**/*.test.ts"],
        granularity: "function",
        minCochange: 5,
        megaCommitThreshold: 200,
        top: 10,
        concurrency: 2,
      },
      unknownKeys: [],
    });
  });

  it("accepts empty object", () => {
    expect(parseHotspotScannerConfig({})).toEqual({
      config: {},
      unknownKeys: [],
    });
  });

  it("collects unknown keys without applying them", () => {
    const parsed = parseHotspotScannerConfig({
      since: "1 year ago",
      format: "json",
      output: "/tmp/out.json",
      unknownKey: true,
    });
    expect(parsed.config).toEqual({ since: "1 year ago" });
    expect(parsed.unknownKeys).toEqual(["format", "output", "unknownKey"]);
  });

  it("accepts config with only unknown keys", () => {
    expect(
      parseHotspotScannerConfig({
        format: "json",
        unknownKey: true,
      }),
    ).toEqual({
      config: {},
      unknownKeys: ["format", "unknownKey"],
    });
  });

  it("rejects non-object root", () => {
    expect(() => parseHotspotScannerConfig(null)).toThrow(ConfigError);
    expect(() => parseHotspotScannerConfig(null)).toThrow(/JSON object/);
    expect(() => parseHotspotScannerConfig([])).toThrow(/JSON object/);
  });

  it("rejects invalid since type", () => {
    expect(() => parseHotspotScannerConfig({ since: 12 })).toThrow(ConfigError);
    expect(() => parseHotspotScannerConfig({ since: 12 })).toThrow(/"since"/);
  });

  it("rejects include as a single string", () => {
    expect(() => parseHotspotScannerConfig({ include: "src/**" })).toThrow(
      ConfigError,
    );
    expect(() => parseHotspotScannerConfig({ include: "src/**" })).toThrow(
      /"include"/,
    );
  });

  it("rejects exclude as a single string", () => {
    expect(() =>
      parseHotspotScannerConfig({ exclude: "**/*.test.ts" }),
    ).toThrow(ConfigError);
    expect(() =>
      parseHotspotScannerConfig({ exclude: "**/*.test.ts" }),
    ).toThrow(/"exclude"/);
  });

  it("rejects non-string include entries", () => {
    expect(() => parseHotspotScannerConfig({ include: ["src/**", 1] })).toThrow(
      /"include"/,
    );
  });

  it("rejects empty include patterns", () => {
    expect(() => parseHotspotScannerConfig({ include: [""] })).toThrow(
      /"include" patterns must not be empty/,
    );
  });

  it("rejects empty exclude patterns", () => {
    expect(() => parseHotspotScannerConfig({ exclude: ["valid", ""] })).toThrow(
      /"exclude" patterns must not be empty/,
    );
  });

  it("rejects invalid granularity", () => {
    expect(() => parseHotspotScannerConfig({ granularity: "module" })).toThrow(
      /"granularity"/,
    );
  });

  it("rejects non-positive minCochange", () => {
    expect(() => parseHotspotScannerConfig({ minCochange: 0 })).toThrow(
      /"minCochange"/,
    );
    expect(() => parseHotspotScannerConfig({ minCochange: 1.5 })).toThrow(
      /"minCochange"/,
    );
  });

  it("rejects non-positive megaCommitThreshold", () => {
    expect(() =>
      parseHotspotScannerConfig({ megaCommitThreshold: 0 }),
    ).toThrow(/"megaCommitThreshold"/);
    expect(() =>
      parseHotspotScannerConfig({ megaCommitThreshold: 1.5 }),
    ).toThrow(/"megaCommitThreshold"/);
    expect(() =>
      parseHotspotScannerConfig({ megaCommitThreshold: -1 }),
    ).toThrow(/"megaCommitThreshold"/);
    expect(() =>
      parseHotspotScannerConfig({ megaCommitThreshold: "100" }),
    ).toThrow(/"megaCommitThreshold"/);
  });

  it("rejects non-positive top", () => {
    expect(() => parseHotspotScannerConfig({ top: -1 })).toThrow(/"top"/);
    expect(() => parseHotspotScannerConfig({ top: "20" })).toThrow(/"top"/);
  });

  it("rejects non-positive concurrency", () => {
    expect(() => parseHotspotScannerConfig({ concurrency: 0 })).toThrow(
      ConfigError,
    );
    expect(() => parseHotspotScannerConfig({ concurrency: 0 })).toThrow(
      /"concurrency"/,
    );
    expect(() => parseHotspotScannerConfig({ concurrency: -1 })).toThrow(
      /"concurrency"/,
    );
    expect(() => parseHotspotScannerConfig({ concurrency: 1.5 })).toThrow(
      /"concurrency"/,
    );
    expect(() => parseHotspotScannerConfig({ concurrency: "2" })).toThrow(
      /"concurrency"/,
    );
  });
});

describe("loadHotspotScannerConfig", () => {
  it("returns null config when config file is missing", async () => {
    await withTempRepo({}, async (repoPath) => {
      await expect(loadHotspotScannerConfig(repoPath)).resolves.toEqual({
        config: null,
        unknownKeys: [],
      });
    });
  });

  it("throws on invalid JSON", async () => {
    await withTempRepo(
      { [HOTSPOT_SCANNER_CONFIG_FILENAME]: "{ not json" },
      async (repoPath) => {
        await expect(loadHotspotScannerConfig(repoPath)).rejects.toThrow(
          ConfigError,
        );
        await expect(loadHotspotScannerConfig(repoPath)).rejects.toThrow(
          /Invalid JSON/,
        );
      },
    );
  });

  it("loads valid config from repo root", async () => {
    await withTempRepo(
      {
        [HOTSPOT_SCANNER_CONFIG_FILENAME]: JSON.stringify({
          since: "3 months ago",
          top: 15,
        }),
      },
      async (repoPath) => {
        await expect(loadHotspotScannerConfig(repoPath)).resolves.toEqual({
          config: {
            since: "3 months ago",
            top: 15,
          },
          unknownKeys: [],
        });
      },
    );
  });

  it("walks parents and loads nearest ancestor config", async () => {
    await withTempRepo(
      {
        [HOTSPOT_SCANNER_CONFIG_FILENAME]: JSON.stringify({
          since: "workspace default",
          top: 20,
        }),
        "repo/nested/.gitkeep": "",
      },
      async (repoPath) => {
        const nestedRepoPath = join(repoPath, "repo", "nested");
        await expect(loadHotspotScannerConfig(nestedRepoPath)).resolves.toEqual({
          config: {
            since: "workspace default",
            top: 20,
          },
          unknownKeys: [],
        });
      },
    );
  });

  it("prefers repo-local config over ancestor config", async () => {
    await withTempRepo(
      {
        [HOTSPOT_SCANNER_CONFIG_FILENAME]: JSON.stringify({
          since: "workspace default",
          top: 20,
        }),
        [`repo/${HOTSPOT_SCANNER_CONFIG_FILENAME}`]: JSON.stringify({
          since: "repo override",
          top: 5,
        }),
      },
      async (repoPath) => {
        const repoLocalPath = join(repoPath, "repo");
        await expect(loadHotspotScannerConfig(repoLocalPath)).resolves.toEqual({
          config: {
            since: "repo override",
            top: 5,
          },
          unknownKeys: [],
        });
      },
    );
  });

  it("loads explicit configPath and skips parent walk", async () => {
    await withTempRepo(
      {
        [HOTSPOT_SCANNER_CONFIG_FILENAME]: JSON.stringify({
          since: "walked config",
          top: 99,
        }),
        "explicit/.hotspot-scanner.json": JSON.stringify({
          since: "explicit config",
          top: 7,
        }),
      },
      async (repoPath) => {
        const explicitPath = join(repoPath, "explicit", ".hotspot-scanner.json");
        const nestedRepoPath = join(repoPath, "repo", "nested");
        await expect(
          loadHotspotScannerConfig(nestedRepoPath, { configPath: explicitPath }),
        ).resolves.toEqual({
          config: {
            since: "explicit config",
            top: 7,
          },
          unknownKeys: [],
        });
      },
    );
  });

  it("throws ConfigError when explicit configPath is missing", async () => {
    await withTempRepo({}, async (repoPath) => {
      const missingPath = join(repoPath, "missing.json");
      await expect(
        loadHotspotScannerConfig(repoPath, { configPath: missingPath }),
      ).rejects.toThrow(ConfigError);
      await expect(
        loadHotspotScannerConfig(repoPath, { configPath: missingPath }),
      ).rejects.toThrow(/Config file not found/);
      await expect(
        loadHotspotScannerConfig(repoPath, { configPath: missingPath }),
      ).rejects.toThrow(/Hint:.*must exist/);
    });
  });

  it("ignores .hotspotrc on parent walk and loads .hotspot-scanner.json", async () => {
    await withTempRepo(
      {
        ".hotspotrc": JSON.stringify({ since: "from-rc", top: 99 }),
        [HOTSPOT_SCANNER_CONFIG_FILENAME]: JSON.stringify({
          since: "from-json",
          top: 5,
        }),
        "repo/nested/.gitkeep": "",
      },
      async (repoPath) => {
        const nestedRepoPath = join(repoPath, "repo", "nested");
        await expect(loadHotspotScannerConfig(nestedRepoPath)).resolves.toEqual({
          config: {
            since: "from-json",
            top: 5,
          },
          unknownKeys: [],
        });
      },
    );
  });

  it("reads only .hotspot-scanner.json at repoPath, not .hotspotrc", async () => {
    await withTempRepo(
      {
        ".hotspotrc": JSON.stringify({ since: "from-rc", top: 99 }),
      },
      async (repoPath) => {
        await expect(loadHotspotScannerConfig(repoPath)).resolves.toEqual({
          config: null,
          unknownKeys: [],
        });
      },
    );

    await withTempRepo(
      {
        ".hotspotrc": JSON.stringify({ since: "from-rc", top: 99 }),
        [HOTSPOT_SCANNER_CONFIG_FILENAME]: JSON.stringify({
          since: "from-json",
          top: 5,
        }),
      },
      async (repoPath) => {
        await expect(loadHotspotScannerConfig(repoPath)).resolves.toEqual({
          config: {
            since: "from-json",
            top: 5,
          },
          unknownKeys: [],
        });
      },
    );
  });

  it("loads unknown keys from repo config without failing", async () => {
    await withTempRepo(
      {
        [HOTSPOT_SCANNER_CONFIG_FILENAME]: JSON.stringify({
          format: "json",
          unknownKey: true,
        }),
      },
      async (repoPath) => {
        await expect(loadHotspotScannerConfig(repoPath)).resolves.toEqual({
          config: {},
          unknownKeys: ["format", "unknownKey"],
        });
      },
    );
  });
});
