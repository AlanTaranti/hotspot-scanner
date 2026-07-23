import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BaselineError, loadBaseline, parseScanResult } from "./load-baseline.js";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures/report/sample-result.json",
);

describe("parseScanResult", () => {
  it("accepts valid M11 ScanResult JSON", () => {
    const raw = JSON.parse(readFileSync(fixturePath, "utf8"));
    const result = parseScanResult(raw);

    expect(result.version).toBe("1.0");
    expect(result.hotspots).toHaveLength(3);
    expect(result.meta.granularity).toBe("file");
  });

  it("rejects malformed JSON root", () => {
    expect(() => parseScanResult(null)).toThrow(BaselineError);
    expect(() => parseScanResult(null)).toThrow(/must be an object/);
  });

  it("rejects unsupported version", () => {
    const raw = JSON.parse(readFileSync(fixturePath, "utf8"));
    expect(() => parseScanResult({ ...raw, version: "2.0" })).toThrow(
      /Unsupported baseline version/,
    );
  });

  it("rejects missing required keys", () => {
    const raw = JSON.parse(readFileSync(fixturePath, "utf8"));
    const { hotspots: _hotspots, ...withoutHotspots } = raw;
    expect(() => parseScanResult(withoutHotspots)).toThrow(/hotspots/);

    const { functions: _functions, ...withoutFunctions } = raw;
    expect(() => parseScanResult(withoutFunctions)).toThrow(/functions/);

    const { coupling: _coupling, ...withoutCoupling } = raw;
    expect(() => parseScanResult(withoutCoupling)).toThrow(/coupling/);

    const { meta: _meta, ...withoutMeta } = raw;
    expect(() => parseScanResult(withoutMeta)).toThrow(/meta/);
  });

  it("rejects invalid meta fields", () => {
    const raw = JSON.parse(readFileSync(fixturePath, "utf8"));
    expect(() =>
      parseScanResult({
        ...raw,
        meta: { ...raw.meta, since: 12 },
      }),
    ).toThrow(/meta.since must be a string/);

    expect(() =>
      parseScanResult({
        ...raw,
        meta: { ...raw.meta, scannedAt: null },
      }),
    ).toThrow(/meta.scannedAt must be a string/);
  });

  it("rejects invalid granularity", () => {
    const raw = JSON.parse(readFileSync(fixturePath, "utf8"));
    expect(() =>
      parseScanResult({
        ...raw,
        meta: { ...raw.meta, granularity: "module" },
      }),
    ).toThrow(/Invalid baseline meta.granularity/);
  });
});

describe("loadBaseline", () => {
  it("reads valid fixture file", async () => {
    const result = await loadBaseline(fixturePath);
    expect(result.version).toBe("1.0");
    expect(result.hotspots[0]?.filePath).toBe("src/hot.ts");
  });

  it("throws on missing file", async () => {
    const invalidPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../tests/fixtures/report/sample-result-missing.json",
    );
    await expect(loadBaseline(invalidPath)).rejects.toThrow(BaselineError);
    await expect(loadBaseline(invalidPath)).rejects.toThrow(
      /Failed to read baseline file/,
    );
  });

  it("throws on malformed JSON file", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-test-"));
    const invalidPath = join(tempDir, "invalid.json");
    await writeFile(invalidPath, "{ not json", "utf8");
    try {
      await expect(loadBaseline(invalidPath)).rejects.toThrow(BaselineError);
      await expect(loadBaseline(invalidPath)).rejects.toThrow(
        /Failed to parse baseline JSON/,
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
