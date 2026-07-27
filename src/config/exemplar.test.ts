import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EXEMPLAR_HOTSPOT_SCANNER_CONFIG,
  HOTSPOT_SCANNER_CONFIG_SCHEMA_URL,
  formatExemplarConfig,
  InitError,
  writeInitConfig,
} from "./exemplar.js";
import {
  HOTSPOT_SCANNER_CONFIG_FILENAME,
  parseHotspotScannerConfig,
} from "./load-config.js";

const LOCKED_EXEMPLAR_JSON = `{
  "$schema": "https://vitals.dev/hotspot-scanner/schemas/hotspot-scanner-config.json",
  "$comments": [
    "include: extra globs added to PathScope beyond defaults.",
    "exclude: additional patterns; built-in excludes always apply.",
    "concurrency is omitted — the scanner host default applies.",
    "Precedence: CLI flags override config; config overrides built-in defaults."
  ],
  "since": "12 months ago",
  "include": [
    "src/**"
  ],
  "exclude": [
    "**/*.generated.ts"
  ],
  "top": 20
}
`;

describe("EXEMPLAR_HOTSPOT_SCANNER_CONFIG", () => {
  it("matches locked exemplar keys and values", () => {
    expect(EXEMPLAR_HOTSPOT_SCANNER_CONFIG).toEqual({
      $schema: HOTSPOT_SCANNER_CONFIG_SCHEMA_URL,
      $comments: [
        "include: extra globs added to PathScope beyond defaults.",
        "exclude: additional patterns; built-in excludes always apply.",
        "concurrency is omitted — the scanner host default applies.",
        "Precedence: CLI flags override config; config overrides built-in defaults.",
      ],
      since: "12 months ago",
      include: ["src/**"],
      exclude: ["**/*.generated.ts"],
      top: 20,
    });
    expect(EXEMPLAR_HOTSPOT_SCANNER_CONFIG).not.toHaveProperty("concurrency");
  });
});

describe("formatExemplarConfig", () => {
  it("returns 2-space indented JSON with trailing newline", () => {
    expect(formatExemplarConfig()).toBe(LOCKED_EXEMPLAR_JSON);
  });

  it("round-trips through parseHotspotScannerConfig without meta in unknownKeys", () => {
    const parsed = parseHotspotScannerConfig(
      JSON.parse(formatExemplarConfig()),
    );

    expect(parsed.unknownKeys).toEqual([]);
    expect(parsed.config).toEqual({
      since: "12 months ago",
      include: ["src/**"],
      exclude: ["**/*.generated.ts"],
      top: 20,
    });
    expect(parsed.config).not.toHaveProperty("concurrency");
  });
});

describe("writeInitConfig", () => {
  it("creates the config file in the target directory", async () => {
    const targetDir = await mkdtemp(join(tmpdir(), "hotspot-init-"));
    try {
      const result = await writeInitConfig({ targetDir, force: false });
      const configPath = join(targetDir, HOTSPOT_SCANNER_CONFIG_FILENAME);

      expect(result.path).toBe(configPath);
      await expect(readFile(configPath, "utf8")).resolves.toBe(
        LOCKED_EXEMPLAR_JSON,
      );
    } finally {
      await rm(targetDir, { recursive: true, force: true });
    }
  });

  it("refuses to overwrite an existing file without force", async () => {
    const targetDir = await mkdtemp(join(tmpdir(), "hotspot-init-"));
    const configPath = join(targetDir, HOTSPOT_SCANNER_CONFIG_FILENAME);
    try {
      await writeFile(configPath, '{"since":"old"}\n', "utf8");

      await expect(
        writeInitConfig({ targetDir, force: false }),
      ).rejects.toThrow(InitError);
      await expect(
        writeInitConfig({ targetDir, force: false }),
      ).rejects.toThrow(/already exists/);
      await expect(
        writeInitConfig({ targetDir, force: false }),
      ).rejects.toThrow(/--force/);
      await expect(readFile(configPath, "utf8")).resolves.toBe(
        '{"since":"old"}\n',
      );
    } finally {
      await rm(targetDir, { recursive: true, force: true });
    }
  });

  it("overwrites an existing file when force is true", async () => {
    const targetDir = await mkdtemp(join(tmpdir(), "hotspot-init-"));
    const configPath = join(targetDir, HOTSPOT_SCANNER_CONFIG_FILENAME);
    try {
      await writeFile(configPath, '{"since":"old"}\n', "utf8");

      const result = await writeInitConfig({ targetDir, force: true });

      expect(result.path).toBe(configPath);
      await expect(readFile(configPath, "utf8")).resolves.toBe(
        LOCKED_EXEMPLAR_JSON,
      );
    } finally {
      await rm(targetDir, { recursive: true, force: true });
    }
  });

  it("throws when the target directory does not exist", async () => {
    const targetDir = join(tmpdir(), "hotspot-init-missing-dir");

    await expect(
      writeInitConfig({ targetDir, force: false }),
    ).rejects.toThrow(InitError);
    await expect(
      writeInitConfig({ targetDir, force: false }),
    ).rejects.toThrow(/does not exist/);
  });

  it("throws when the target path is not a directory", async () => {
    const targetDir = await mkdtemp(join(tmpdir(), "hotspot-init-"));
    const filePath = join(targetDir, "not-a-dir");
    try {
      await writeFile(filePath, "not a directory\n", "utf8");

      await expect(
        writeInitConfig({ targetDir: filePath, force: false }),
      ).rejects.toThrow(InitError);
      await expect(
        writeInitConfig({ targetDir: filePath, force: false }),
      ).rejects.toThrow(/not a directory/);
    } finally {
      await rm(targetDir, { recursive: true, force: true });
    }
  });
});
