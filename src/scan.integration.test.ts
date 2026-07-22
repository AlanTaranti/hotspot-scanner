import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_MIN_COCHANGE } from "./scoring/index.js";
import { runScan } from "#scan";

const smallTsFixture = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../tests/fixtures/repos/small-ts",
);

const EXPECTED_TOP_HOTSPOT = "src/high.ts";

describe("runScan integration", () => {
  it("returns non-empty hotspot and coupling rankings on small-ts fixture", async () => {
    const result = await runScan({ repoPath: smallTsFixture });

    expect(result.hotspots.length).toBeGreaterThanOrEqual(1);
    expect(result.hotspots[0]!.filePath).toBe(EXPECTED_TOP_HOTSPOT);

    expect(result.coupling.length).toBeGreaterThanOrEqual(1);
    const topCoupling = result.coupling[0]!;
    expect(topCoupling.coChangeCount).toBeGreaterThanOrEqual(
      DEFAULT_MIN_COCHANGE,
    );
  });

  it("forwards git progress and warnings via callbacks", async () => {
    const onProgress = vi.fn();
    const onWarning = vi.fn();

    await runScan({
      repoPath: smallTsFixture,
      onProgress,
      onWarning,
    });

    expect(onProgress).toHaveBeenCalled();
    expect(onWarning).not.toHaveBeenCalled();
  });
});
