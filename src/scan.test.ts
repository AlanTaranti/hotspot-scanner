import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_MIN_COCHANGE } from "./scoring/index.js";
import { DEFAULT_SINCE, DEFAULT_TOP, runScan } from "#scan";

const smallTsFixture = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../tests/fixtures/repos/small-ts",
);

describe("runScan", () => {
  it("uses provided since when set", async () => {
    const result = await runScan({
      repoPath: smallTsFixture,
      since: "6 months ago",
    });

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

  it("accepts optional diagnostics callbacks", async () => {
    const onWarning = vi.fn();
    const onProgress = vi.fn();

    const result = await runScan({
      repoPath: smallTsFixture,
      top: 5,
      minCochange: 4,
      onWarning,
      onProgress,
    });

    expect(result.hotspots.length).toBeGreaterThanOrEqual(1);
    expect(onProgress).toHaveBeenCalled();
  });

  it("validates a temporary directory path and throws on non-git repo", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-"));
    try {
      await expect(runScan({ repoPath: tempDir })).rejects.toThrow(
        /not a git repository/i,
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
