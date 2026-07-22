import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_MIN_COCHANGE } from "./scoring/index.js";
import { DEFAULT_SINCE, DEFAULT_TOP, runScan } from "#scan";

describe("runScan", () => {
  it("returns empty typed ScanResult with default meta", async () => {
    const result = await runScan({ repoPath: "." });

    expect(result.version).toBe("1.0");
    expect(result.hotspots).toEqual([]);
    expect(result.coupling).toEqual([]);
    expect(result.meta.since).toBe(DEFAULT_SINCE);
    expect(new Date(result.meta.scannedAt).toISOString()).toBe(
      result.meta.scannedAt,
    );
  });

  it("uses provided since when set", async () => {
    const result = await runScan({ repoPath: ".", since: "6 months ago" });

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

  it("accepts optional diagnostics callbacks without invoking pipeline modules", async () => {
    const onWarning = vi.fn();
    const onProgress = vi.fn();
    const result = await runScan({
      repoPath: ".",
      top: 5,
      minCochange: 4,
      onWarning,
      onProgress,
    });

    expect(result.hotspots).toEqual([]);
    expect(result.coupling).toEqual([]);
    expect(onWarning).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();
  });

  it("validates a temporary directory path", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-"));
    try {
      const result = await runScan({ repoPath: tempDir });
      expect(result.hotspots).toEqual([]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
