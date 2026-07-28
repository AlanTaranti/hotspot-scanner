import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
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
        top: 10,
        concurrency: 2,
      }),
    ).toEqual({
      config: {
        since: "6 months ago",
        include: ["src/**"],
        exclude: ["**/*.test.ts"],
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

  it("treats removed coupling keys as unknown", () => {
    const parsed = parseHotspotScannerConfig({
      since: "1 year ago",
      minCochange: 5,
      megaCommitThreshold: 200,
    });
    expect(parsed.config).toEqual({ since: "1 year ago" });
    expect(parsed.unknownKeys).toEqual(["megaCommitThreshold", "minCochange"]);
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

  it("treats leftover granularity as unknown key", () => {
    const parsed = parseHotspotScannerConfig({
      since: "1 year ago",
      granularity: "function",
    });
    expect(parsed.config).toEqual({ since: "1 year ago" });
    expect(parsed.unknownKeys).toEqual(["granularity"]);
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

  it("skips reserved meta keys without unknown-key warnings", () => {
    expect(
      parseHotspotScannerConfig({
        $schema:
          "https://raw.githubusercontent.com/AlanTaranti/hotspot-scanner/main/schemas/hotspot-scanner-config.json",
        $comment: "single-line hint",
        $comments: ["array hint"],
      }),
    ).toEqual({
      config: {},
      unknownKeys: [],
    });
  });

  it("skips reserved meta by name regardless of value shape", () => {
    expect(
      parseHotspotScannerConfig({
        $comments: "not-an-array",
        $schema: 123,
      }),
    ).toEqual({
      config: {},
      unknownKeys: [],
    });
  });

  it("warns only for non-meta unknown keys when meta is present", () => {
    expect(
      parseHotspotScannerConfig({
        $schema:
          "https://raw.githubusercontent.com/AlanTaranti/hotspot-scanner/main/schemas/hotspot-scanner-config.json",
        since: "1 year ago",
        typoKey: true,
      }),
    ).toEqual({
      config: { since: "1 year ago" },
      unknownKeys: ["typoKey"],
    });
  });
});

describe("loadHotspotScannerConfig", () => {
  it("returns null config when config file is missing", async () => {
    await withTempRepo({}, async (repoPath) => {
      await expect(loadHotspotScannerConfig(repoPath)).resolves.toEqual({
        config: null,
        unknownKeys: [],
        path: null,
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
          path: resolve(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME),
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
        await expect(loadHotspotScannerConfig(nestedRepoPath)).resolves.toEqual(
          {
            config: {
              since: "workspace default",
              top: 20,
            },
            unknownKeys: [],
            path: resolve(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME),
          },
        );
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
          path: resolve(repoPath, "repo", HOTSPOT_SCANNER_CONFIG_FILENAME),
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
        const explicitPath = join(
          repoPath,
          "explicit",
          ".hotspot-scanner.json",
        );
        const nestedRepoPath = join(repoPath, "repo", "nested");
        await expect(
          loadHotspotScannerConfig(nestedRepoPath, {
            configPath: explicitPath,
          }),
        ).resolves.toEqual({
          config: {
            since: "explicit config",
            top: 7,
          },
          unknownKeys: [],
          path: resolve(explicitPath),
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
        await expect(loadHotspotScannerConfig(nestedRepoPath)).resolves.toEqual(
          {
            config: {
              since: "from-json",
              top: 5,
            },
            unknownKeys: [],
            path: resolve(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME),
          },
        );
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
          path: null,
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
          path: resolve(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME),
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
          path: resolve(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME),
        });
      },
    );
  });

  it("loads meta-only config without unknown keys", async () => {
    await withTempRepo(
      {
        [HOTSPOT_SCANNER_CONFIG_FILENAME]: JSON.stringify({
          $schema:
            "https://raw.githubusercontent.com/AlanTaranti/hotspot-scanner/main/schemas/hotspot-scanner-config.json",
          $comments: ["hint"],
        }),
      },
      async (repoPath) => {
        await expect(loadHotspotScannerConfig(repoPath)).resolves.toEqual({
          config: {},
          unknownKeys: [],
          path: resolve(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME),
        });
      },
    );
  });

  it("loads meta with typo and reports only the typo", async () => {
    await withTempRepo(
      {
        [HOTSPOT_SCANNER_CONFIG_FILENAME]: JSON.stringify({
          $schema:
            "https://raw.githubusercontent.com/AlanTaranti/hotspot-scanner/main/schemas/hotspot-scanner-config.json",
          typoKey: true,
        }),
      },
      async (repoPath) => {
        await expect(loadHotspotScannerConfig(repoPath)).resolves.toEqual({
          config: {},
          unknownKeys: ["typoKey"],
          path: resolve(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME),
        });
      },
    );
  });
});
