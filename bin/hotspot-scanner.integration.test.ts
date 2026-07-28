import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runCli } from "./hotspot-scanner.js";

const smallTsFixture = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../tests/fixtures/repos/small-ts",
);

const monorepoNestedFixture = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../tests/fixtures/repos/monorepo-nested",
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
  let tempDir: string;

  afterEach(async () => {
    vi.restoreAllMocks();
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  async function createTempDir(): Promise<string> {
    tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-integration-"));
    return tempDir;
  }

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
      meta: { since: string; scannedAt: string };
    };

    expect(parsed.version).toBe("3.0");
    expect(Array.isArray(parsed.hotspots)).toBe(true);
    expect(parsed.hotspots.length).toBeGreaterThanOrEqual(1);
    expect(parsed.meta.since).toBeTruthy();
    expect(parsed.meta.scannedAt).toBeTruthy();
  });

  it("writes markdown report to file with --output on small-ts fixture", async () => {
    const dir = await createTempDir();
    const outputPath = join(dir, "report.md");
    const { chunks } = captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      smallTsFixture,
      "--format",
      "markdown",
      "--output",
      outputPath,
    ]);

    expect(chunks.join("")).toBe("");
    const content = await readFile(outputPath, "utf8");
    expect(content).toContain("# Hotspot Scanner Report");
    expect(content).toContain("## Top Hotspots");
  });

  it("writes JSON report to file with --output on small-ts fixture", async () => {
    const dir = await createTempDir();
    const outputPath = join(dir, "report.json");
    const { chunks } = captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      smallTsFixture,
      "--format",
      "json",
      "--output",
      outputPath,
    ]);

    expect(chunks.join("")).toBe("");
    const content = await readFile(outputPath, "utf8");
    const parsed = JSON.parse(content) as {
      version: string;
      hotspots: Array<{
        filePath: string;
        ncloc: number;
        linesChanged: number;
        authorCount: number;
      }>;
      meta: { since: string; scannedAt: string };
    };

    expect(parsed.version).toBe("3.0");
    expect(Array.isArray(parsed.hotspots)).toBe(true);
    expect(parsed.hotspots.length).toBeGreaterThanOrEqual(1);
    expect(parsed.hotspots[0]).toMatchObject({
      filePath: expect.any(String),
      ncloc: expect.any(Number),
      linesChanged: expect.any(Number),
      authorCount: expect.any(Number),
    });
    expect(parsed.meta.since).toBeTruthy();
    expect(parsed.meta.scannedAt).toBeTruthy();
  });

  it("rejects unknown --granularity flag on small-ts fixture", async () => {
    captureStdout();

    await expect(
      runCli([
        "node",
        "hotspot-scanner",
        "scan",
        smallTsFixture,
        "--format",
        "json",
        "--granularity",
        "function",
      ]),
    ).rejects.toThrow();
  });

  it("exits 0 with --concurrency 1 on small-ts fixture", async () => {
    const { chunks } = captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      smallTsFixture,
      "--concurrency",
      "1",
      "--format",
      "json",
    ]);

    const parsed = JSON.parse(chunks.join("")) as { version: string };
    expect(parsed.version).toBe("3.0");
  });

  it("rejects invalid --concurrency on small-ts fixture", async () => {
    captureStdout();

    await expect(
      runCli([
        "node",
        "hotspot-scanner",
        "scan",
        smallTsFixture,
        "--concurrency",
        "0",
      ]),
    ).rejects.toThrow(/--concurrency must be a positive integer/);
  });

  it("returns hotspot rankings without granularity flag", async () => {
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
      hotspots: unknown[];
      meta: { since: string };
    };

    expect(parsed.hotspots.length).toBeGreaterThanOrEqual(1);
    expect(parsed).not.toHaveProperty("functions");
    expect(parsed.meta).not.toHaveProperty("granularity");
  });

  it("writes CSV bundle to stem-derived files with --output on small-ts fixture", async () => {
    const dir = await createTempDir();
    const outputPath = join(dir, "report.csv");
    const { chunks } = captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      smallTsFixture,
      "--format",
      "csv",
      "--output",
      outputPath,
    ]);

    expect(chunks.join("")).toBe("");
    const metaPath = join(dir, "report.meta.json");
    const hotspotsPath = join(dir, "report.hotspots.csv");

    await expect(access(metaPath)).resolves.toBeUndefined();
    await expect(access(hotspotsPath)).resolves.toBeUndefined();

    const meta = JSON.parse(await readFile(metaPath, "utf8")) as {
      kind: string;
    };
    const hotspotsContent = await readFile(hotspotsPath, "utf8");

    expect(meta.kind).toBe("scan");
    expect(hotspotsContent.split("\n")[0]).toBe(
      "rank,file,score,ncloc,nclocN,churn,churnN,authors,lines",
    );
  });

  it("fails when --format csv is used without --output", async () => {
    captureStdout();

    await expect(
      runCli([
        "node",
        "hotspot-scanner",
        "scan",
        smallTsFixture,
        "--format",
        "csv",
      ]),
    ).rejects.toThrow(/--format csv requires --output/);
  });

  it("exports all hotspot rows with --top 1 --format csv", async () => {
    const dir = await createTempDir();
    const outputPath = join(dir, "report-top.csv");
    captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      smallTsFixture,
      "--format",
      "csv",
      "--top",
      "1",
      "--output",
      outputPath,
    ]);

    const hotspotsContent = await readFile(
      join(dir, "report-top.hotspots.csv"),
      "utf8",
    );
    const dataRows = hotspotsContent
      .split("\n")
      .filter((line) => /^\d+,src\//.test(line));
    expect(dataRows.length).toBeGreaterThan(1);
  });

  it("exports all hotspot rows with --top 1 --format json", async () => {
    const { chunks } = captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      smallTsFixture,
      "--format",
      "json",
      "--top",
      "1",
    ]);

    const parsed = JSON.parse(chunks.join("")) as {
      hotspots: unknown[];
    };
    expect(parsed.hotspots.length).toBeGreaterThan(1);
  });

  it("exits 0 when scan omits path from small-ts cwd", async () => {
    const originalCwd = process.cwd();
    const { chunks } = captureStdout();

    try {
      process.chdir(smallTsFixture);

      await runCli(["node", "hotspot-scanner", "scan", "--format", "json"]);

      const parsed = JSON.parse(chunks.join("")) as {
        version: string;
        hotspots: unknown[];
      };
      expect(parsed.version).toBe("3.0");
      expect(parsed.hotspots.length).toBeGreaterThanOrEqual(1);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("exits 0 when scanning a nested monorepo package path (HOTSPOT-586)", async () => {
    const { chunks } = captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      join(monorepoNestedFixture, "packages", "api"),
      "--format",
      "json",
    ]);

    const parsed = JSON.parse(chunks.join("")) as {
      version: string;
      hotspots: Array<{ filePath: string }>;
      meta: {
        warnings: Array<{ code?: string }>;
      };
    };

    expect(parsed.version).toBe("3.0");
    expect(parsed.hotspots.length).toBeGreaterThanOrEqual(1);
    expect(
      parsed.hotspots.every((hotspot) =>
        hotspot.filePath.startsWith("packages/api/"),
      ),
    ).toBe(true);
    expect(
      parsed.meta.warnings.some(
        (warning) => warning.code === "MONOREPO_PATH_REMOUNT",
      ),
    ).toBe(true);
  });
});
