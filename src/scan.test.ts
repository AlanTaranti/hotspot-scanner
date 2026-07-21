import { describe, expect, it } from "vitest";
import { runScan } from "./scan.js";

describe("runScan", () => {
  it("returns empty typed ScanResult with default meta", async () => {
    const result = await runScan({ repoPath: "." });

    expect(result.version).toBe("1.0");
    expect(result.hotspots).toEqual([]);
    expect(result.coupling).toEqual([]);
    expect(result.meta.since).toBe("12 months ago");
    expect(new Date(result.meta.scannedAt).toISOString()).toBe(
      result.meta.scannedAt,
    );
  });

  it("uses provided since when set", async () => {
    const result = await runScan({ repoPath: ".", since: "6 months ago" });

    expect(result.meta.since).toBe("6 months ago");
  });
});
