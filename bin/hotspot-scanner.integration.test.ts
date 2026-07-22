import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runCli } from "./hotspot-scanner.js";

const smallTsFixture = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../tests/fixtures/repos/small-ts",
);

function captureStdout(): { chunks: string[]; restore: () => void } {
  const chunks: string[] = [];
  const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    chunks.push(String(chunk));
    return true;
  });
  return {
    chunks,
    restore: () => spy.mockRestore(),
  };
}

describe("hotspot-scanner CLI integration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exits 0 and prints table with since header on small-ts fixture", async () => {
    const { chunks } = captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      smallTsFixture,
      "--format",
      "table",
    ]);

    const output = chunks.join("");
    expect(output).toContain("Scan window:");
    expect(output).toContain("Top Hotspots");
    expect(output).toContain("src/high.ts");
  });

  it("prints valid JSON with required fields on small-ts fixture", async () => {
    const { chunks } = captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      smallTsFixture,
      "--format",
      "json",
    ]);

    const parsed = JSON.parse(chunks.join("")) as {
      version: string;
      hotspots: unknown[];
      coupling: unknown[];
      meta: { since: string; scannedAt: string };
    };

    expect(parsed.version).toBe("1.0");
    expect(Array.isArray(parsed.hotspots)).toBe(true);
    expect(parsed.hotspots.length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(parsed.coupling)).toBe(true);
    expect(parsed.coupling.length).toBeGreaterThanOrEqual(1);
    expect(parsed.meta.since).toBeTruthy();
    expect(parsed.meta.scannedAt).toBeTruthy();
  });
});
