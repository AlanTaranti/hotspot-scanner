import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", async (importOriginal) => {
  const mod = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...mod,
    stat: vi.fn(mod.stat),
  };
});

vi.mock("./load-config.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./load-config.js")>();
  return {
    ...mod,
    loadHotspotScannerConfig: vi.fn(mod.loadHotspotScannerConfig),
  };
});

import { stat } from "node:fs/promises";
import {
  ConfigError,
  HOTSPOT_SCANNER_CONFIG_FILENAME,
  loadHotspotScannerConfig,
} from "./load-config.js";
import { validateHotspotScannerConfigFile } from "./validate-config.js";

const actualFs =
  await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
const actualLoadConfig =
  await vi.importActual<typeof import("./load-config.js")>("./load-config.js");

async function withTempRepo(
  files: Record<string, string>,
  run: (repoPath: string) => Promise<void>,
): Promise<void> {
  const repoPath = await mkdtemp(join(tmpdir(), "hotspot-validate-"));
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

describe("validateHotspotScannerConfigFile", () => {
  beforeEach(() => {
    vi.mocked(stat).mockImplementation(actualFs.stat);
    vi.mocked(loadHotspotScannerConfig).mockImplementation(
      actualLoadConfig.loadHotspotScannerConfig,
    );
  });

  it("returns path for a valid explicit config file", async () => {
    await withTempRepo(
      {
        [HOTSPOT_SCANNER_CONFIG_FILENAME]: JSON.stringify({
          since: "6 months ago",
          top: 10,
        }),
      },
      async (repoPath) => {
        const configPath = join(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME);
        const result = await validateHotspotScannerConfigFile(configPath);
        expect(result.path).toBe(resolve(configPath));
      },
    );
  });

  it("discovers config when given a directory", async () => {
    await withTempRepo(
      {
        [HOTSPOT_SCANNER_CONFIG_FILENAME]: JSON.stringify({
          since: "1 year ago",
        }),
      },
      async (repoPath) => {
        const result = await validateHotspotScannerConfigFile(repoPath);
        expect(result.path).toBe(
          resolve(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME),
        );
      },
    );
  });

  it("discovers config in a parent directory when given a nested dir", async () => {
    await withTempRepo(
      {
        [HOTSPOT_SCANNER_CONFIG_FILENAME]: JSON.stringify({
          since: "1 year ago",
        }),
        "packages/app/package.json": "{}",
      },
      async (repoPath) => {
        const nestedDir = join(repoPath, "packages", "app");
        const result = await validateHotspotScannerConfigFile(nestedDir);
        expect(result.path).toBe(
          resolve(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME),
        );
      },
    );
  });

  it("throws ConfigError for invalid JSON", async () => {
    await withTempRepo(
      {
        [HOTSPOT_SCANNER_CONFIG_FILENAME]: "{ not json",
      },
      async (repoPath) => {
        const configPath = join(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME);
        await expect(
          validateHotspotScannerConfigFile(configPath),
        ).rejects.toThrow(ConfigError);
      },
    );
  });

  it("throws ConfigError for invalid known-key types", async () => {
    await withTempRepo(
      {
        [HOTSPOT_SCANNER_CONFIG_FILENAME]: JSON.stringify({
          top: "not-a-number",
        }),
      },
      async (repoPath) => {
        const configPath = join(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME);
        await expect(
          validateHotspotScannerConfigFile(configPath),
        ).rejects.toThrow(ConfigError);
      },
    );
  });

  it("throws ConfigError when explicit file is missing", async () => {
    await withTempRepo({}, async (repoPath) => {
      const missingPath = join(repoPath, "missing.json");
      await expect(
        validateHotspotScannerConfigFile(missingPath),
      ).rejects.toThrow(ConfigError);
      await expect(
        validateHotspotScannerConfigFile(missingPath),
      ).rejects.toThrow(/not found/i);
    });
  });

  it("throws ConfigError when directory has no discoverable config", async () => {
    await withTempRepo({}, async (repoPath) => {
      await expect(validateHotspotScannerConfigFile(repoPath)).rejects.toThrow(
        ConfigError,
      );
      await expect(validateHotspotScannerConfigFile(repoPath)).rejects.toThrow(
        /No .hotspot-scanner.json found/i,
      );
    });
  });

  it("rethrows non-ENOENT stat errors", async () => {
    vi.mocked(stat).mockRejectedValueOnce(
      Object.assign(new Error("permission denied"), { code: "EACCES" }),
    );

    await expect(
      validateHotspotScannerConfigFile("/some/path"),
    ).rejects.toThrow("permission denied");
  });

  it("throws ConfigError when path is neither a file nor a directory", async () => {
    const execFileAsync = promisify(execFile);
    await withTempRepo({}, async (repoPath) => {
      const fifoPath = join(repoPath, "my-fifo");
      try {
        await execFileAsync("mkfifo", [fifoPath]);
      } catch {
        return;
      }

      await expect(validateHotspotScannerConfigFile(fifoPath)).rejects.toThrow(
        ConfigError,
      );
      await expect(validateHotspotScannerConfigFile(fifoPath)).rejects.toThrow(
        /not a file or directory/i,
      );
    });
  });

  it("throws ConfigError when file load returns null path", async () => {
    vi.mocked(stat).mockResolvedValueOnce({
      isFile: () => true,
      isDirectory: () => false,
    } as Awaited<ReturnType<typeof stat>>);
    vi.mocked(loadHotspotScannerConfig).mockResolvedValueOnce({
      config: null,
      unknownKeys: [],
      path: null,
    });

    await expect(
      validateHotspotScannerConfigFile("/repo/.hotspot-scanner.json"),
    ).rejects.toThrow(ConfigError);
    await expect(
      validateHotspotScannerConfigFile("/repo/.hotspot-scanner.json"),
    ).rejects.toThrow(/not found/i);
  });

  it("throws ConfigError when explicit file path resolves to missing load", async () => {
    await withTempRepo(
      {
        [HOTSPOT_SCANNER_CONFIG_FILENAME]: JSON.stringify({
          since: "1 year ago",
        }),
      },
      async (repoPath) => {
        const configPath = join(repoPath, HOTSPOT_SCANNER_CONFIG_FILENAME);
        const danglingPath = join(repoPath, "dangling.json");
        await symlink(configPath, danglingPath);
        await rm(configPath);

        await expect(
          validateHotspotScannerConfigFile(danglingPath),
        ).rejects.toThrow(ConfigError);
      },
    );
  });
});
