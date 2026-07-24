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
      coupling: unknown[];
      meta: { since: string; scannedAt: string };
    };

    expect(parsed.version).toBe("1.0");
    expect(Array.isArray(parsed.hotspots)).toBe(true);
    expect(parsed.hotspots.length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(parsed.coupling)).toBe(true);
    expect(parsed.coupling.length).toBeGreaterThanOrEqual(1);
    for (const pair of parsed.coupling as Array<{
      hasStaticDependency: boolean;
    }>) {
      expect(typeof pair.hasStaticDependency).toBe("boolean");
    }
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
    expect(content).toContain("## Top Coupling Pairs");
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
        cyclomaticComplexity: number;
        linesChanged: number;
        authorCount: number;
      }>;
      coupling: unknown[];
      meta: { since: string; scannedAt: string };
    };

    expect(parsed.version).toBe("1.0");
    expect(Array.isArray(parsed.hotspots)).toBe(true);
    expect(parsed.hotspots.length).toBeGreaterThanOrEqual(1);
    expect(parsed.hotspots[0]).toMatchObject({
      filePath: expect.any(String),
      cyclomaticComplexity: expect.any(Number),
      linesChanged: expect.any(Number),
      authorCount: expect.any(Number),
    });
    expect(Array.isArray(parsed.coupling)).toBe(true);
    expect(parsed.meta.since).toBeTruthy();
    expect(parsed.meta.scannedAt).toBeTruthy();
  });

  it("prints valid JSON with function rankings on small-ts fixture", async () => {
    const { chunks } = captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      smallTsFixture,
      "--format",
      "json",
      "--granularity",
      "function",
    ]);

    const parsed = JSON.parse(chunks.join("")) as {
      version: string;
      hotspots: unknown[];
      functions: Array<{
        filePath: string;
        functionName: string;
        line: number;
        complexity: number;
        hotspotScore: number;
      }>;
      coupling: unknown[];
      meta: { since: string; scannedAt: string; granularity: string };
    };

    expect(parsed.version).toBe("1.0");
    expect(parsed.meta.granularity).toBe("function");
    expect(parsed.hotspots).toEqual([]);
    expect(parsed.functions.length).toBeGreaterThanOrEqual(1);
    expect(parsed.functions[0]).toMatchObject({
      filePath: expect.any(String),
      functionName: expect.any(String),
      line: expect.any(Number),
      complexity: expect.any(Number),
      hotspotScore: expect.any(Number),
    });
    expect(Array.isArray(parsed.coupling)).toBe(true);
  });

  it("prints markdown with Top Functions section in function mode", async () => {
    const { chunks } = captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      smallTsFixture,
      "--format",
      "markdown",
      "--granularity",
      "function",
    ]);

    const output = chunks.join("");
    expect(output).toContain("## Top Functions");
    expect(output).toContain("**Granularity:** function");
  });

  it("defaults to file mode when granularity is omitted", async () => {
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
      functions: unknown[];
      meta: { granularity: string };
    };

    expect(parsed.meta.granularity).toBe("file");
    expect(parsed.hotspots.length).toBeGreaterThanOrEqual(1);
    expect(parsed.functions).toEqual([]);
  });

  it("exits 0 and produces parseable compare JSON with --baseline on small-ts", async () => {
    const dir = await createTempDir();
    const baselinePath = join(dir, "baseline.json");
    const { chunks: baselineChunks } = captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      smallTsFixture,
      "--format",
      "json",
      "--output",
      baselinePath,
    ]);

    expect(baselineChunks.join("")).toBe("");

    const { chunks } = captureStdout();
    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      smallTsFixture,
      "--format",
      "json",
      "--baseline",
      baselinePath,
    ]);

    const parsed = JSON.parse(chunks.join("")) as {
      version: string;
      hotspots: {
        new: unknown[];
        removed: unknown[];
        rankChanged: unknown[];
      };
      functions: {
        new: unknown[];
        removed: unknown[];
        rankChanged: unknown[];
      };
      coupling: {
        new: unknown[];
        removed: unknown[];
        rankChanged: unknown[];
      };
      meta: { baseline: unknown; current: unknown; warnings: string[] };
    };

    expect(parsed.version).toBe("1.0");
    expect(parsed.hotspots).toMatchObject({
      new: expect.any(Array),
      removed: expect.any(Array),
      rankChanged: expect.any(Array),
    });
    expect(parsed.coupling).toMatchObject({
      new: expect.any(Array),
      removed: expect.any(Array),
      rankChanged: expect.any(Array),
    });
    expect(parsed.meta.baseline).toBeTruthy();
    expect(parsed.meta.current).toBeTruthy();
    expect(Array.isArray(parsed.meta.warnings)).toBe(true);
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
    const couplingPath = join(dir, "report.coupling.csv");

    await expect(access(metaPath)).resolves.toBeUndefined();
    await expect(access(hotspotsPath)).resolves.toBeUndefined();
    await expect(access(couplingPath)).resolves.toBeUndefined();

    const meta = JSON.parse(await readFile(metaPath, "utf8")) as { kind: string };
    const hotspotsContent = await readFile(hotspotsPath, "utf8");
    const couplingContent = await readFile(couplingPath, "utf8");

    expect(meta.kind).toBe("scan");
    expect(hotspotsContent.split("\n")[0]).toBe(
      "rank,file,score,cpx,cpxN,churn,churnN,funcs,authors,lines",
    );
    expect(couplingContent.split("\n")[0]).toBe(
      "rank,fileA,fileB,strength,coChanges,hasStaticDependency",
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
      coupling: unknown[];
    };
    expect(parsed.hotspots.length).toBeGreaterThan(1);
    expect(parsed.coupling.length).toBeGreaterThan(0);
  });

  it("exports full compare JSON with --top 1 --format json --baseline", async () => {
    const dir = await createTempDir();
    const baselinePath = join(dir, "baseline.json");
    const baselineCapture = captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      smallTsFixture,
      "--format",
      "json",
      "--output",
      baselinePath,
    ]);
    baselineCapture.restore();

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
      "--baseline",
      baselinePath,
    ]);

    const parsed = JSON.parse(chunks.join("")) as {
      hotspots: {
        new: unknown[];
        removed: unknown[];
        rankChanged: unknown[];
      };
      coupling: {
        new: unknown[];
        removed: unknown[];
        rankChanged: unknown[];
      };
    };

    const { chunks: fullChunks } = captureStdout();
    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      smallTsFixture,
      "--format",
      "json",
      "--baseline",
      baselinePath,
    ]);
    const fullParsed = JSON.parse(fullChunks.join("")) as typeof parsed;

    expect(parsed.hotspots.new).toHaveLength(fullParsed.hotspots.new.length);
    expect(parsed.hotspots.removed).toHaveLength(
      fullParsed.hotspots.removed.length,
    );
    expect(parsed.hotspots.rankChanged).toHaveLength(
      fullParsed.hotspots.rankChanged.length,
    );
    expect(parsed.coupling.new).toHaveLength(fullParsed.coupling.new.length);
    expect(parsed.coupling.removed).toHaveLength(
      fullParsed.coupling.removed.length,
    );
    expect(parsed.coupling.rankChanged).toHaveLength(
      fullParsed.coupling.rankChanged.length,
    );
  });

  it("writes compare CSV bundle with --baseline on small-ts fixture", async () => {
    const dir = await createTempDir();
    const baselinePath = join(dir, "baseline.json");
    const comparePath = join(dir, "compare.csv");
    captureStdout();

    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      smallTsFixture,
      "--format",
      "json",
      "--output",
      baselinePath,
    ]);

    const { chunks } = captureStdout();
    await runCli([
      "node",
      "hotspot-scanner",
      "scan",
      smallTsFixture,
      "--format",
      "csv",
      "--baseline",
      baselinePath,
      "--output",
      comparePath,
    ]);

    expect(chunks.join("")).toBe("");

    const stem = join(dir, "compare");
    const expectedFiles = [
      "compare.meta.json",
      "compare.hotspots.new.csv",
      "compare.hotspots.removed.csv",
      "compare.hotspots.rank-changed.csv",
      "compare.coupling.new.csv",
      "compare.coupling.removed.csv",
      "compare.coupling.rank-changed.csv",
    ];

    for (const file of expectedFiles) {
      await expect(access(join(dir, file))).resolves.toBeUndefined();
    }

    const meta = JSON.parse(await readFile(`${stem}.meta.json`, "utf8")) as {
      kind: string;
    };
    expect(meta.kind).toBe("compare");
    const newHotspots = await readFile(`${stem}.hotspots.new.csv`, "utf8");
    expect(newHotspots.split("\n")[0]).toBe(
      "rank,file,score,cpx,cpxN,churn,churnN,funcs,authors",
    );
  });

  it("scan without --baseline remains unchanged regression guard", async () => {
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
      meta: { granularity: string };
    };

    expect(parsed.version).toBe("1.0");
    expect(parsed.meta.granularity).toBe("file");
    expect(parsed.hotspots.length).toBeGreaterThanOrEqual(1);
    expect(parsed.coupling.length).toBeGreaterThanOrEqual(1);
    expect(parsed).not.toHaveProperty("functions.new");
  });
});
