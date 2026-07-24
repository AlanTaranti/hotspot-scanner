import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
      await writeFile(join(repoPath, name), content, "utf8");
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
        top: 10,
      }),
    ).toEqual({
      since: "6 months ago",
      include: ["src/**"],
      exclude: ["**/*.test.ts"],
      granularity: "function",
      minCochange: 5,
      top: 10,
    });
  });

  it("accepts empty object", () => {
    expect(parseHotspotScannerConfig({})).toEqual({});
  });

  it("ignores unknown keys", () => {
    expect(
      parseHotspotScannerConfig({
        since: "1 year ago",
        format: "json",
        output: "/tmp/out.json",
        unknownKey: true,
      }),
    ).toEqual({ since: "1 year ago" });
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
    expect(() => parseHotspotScannerConfig({ exclude: "**/*.test.ts" })).toThrow(
      ConfigError,
    );
    expect(() => parseHotspotScannerConfig({ exclude: "**/*.test.ts" })).toThrow(
      /"exclude"/,
    );
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

  it("rejects non-positive top", () => {
    expect(() => parseHotspotScannerConfig({ top: -1 })).toThrow(/"top"/);
    expect(() => parseHotspotScannerConfig({ top: "20" })).toThrow(/"top"/);
  });
});

describe("loadHotspotScannerConfig", () => {
  it("returns null when config file is missing", async () => {
    await withTempRepo({}, async (repoPath) => {
      await expect(loadHotspotScannerConfig(repoPath)).resolves.toBeNull();
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
          since: "3 months ago",
          top: 15,
        });
      },
    );
  });

  it("reads only .hotspot-scanner.json, not .hotspotrc", async () => {
    await withTempRepo(
      {
        ".hotspotrc": JSON.stringify({ since: "from-rc", top: 99 }),
      },
      async (repoPath) => {
        await expect(loadHotspotScannerConfig(repoPath)).resolves.toBeNull();
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
          since: "from-json",
          top: 5,
        });
      },
    );
  });
});
