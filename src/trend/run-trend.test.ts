import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatTruncationNote,
  runComplexityTrend,
} from "./run-trend.js";
import { TrendNotTrackedError, TrendUsageError } from "./types.js";

const execFileAsync = promisify(execFile);
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

async function createTempRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "hotspot-trend-run-"));
  tempDirs.push(dir);
  await execFileAsync("git", ["init"], { cwd: dir });
  await execFileAsync("git", ["config", "user.email", "test@example.com"], {
    cwd: dir,
  });
  await execFileAsync("git", ["config", "user.name", "Test User"], {
    cwd: dir,
  });
  return dir;
}

async function commitFile(
  repoPath: string,
  relativePath: string,
  content: string,
  message: string,
): Promise<void> {
  const fullPath = join(repoPath, relativePath);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, "utf8");
  await execFileAsync("git", ["add", relativePath], { cwd: repoPath });
  await execFileAsync("git", ["commit", "-m", message], { cwd: repoPath });
}

describe.sequential("runComplexityTrend", () => {
  it("rejects mixed since and start/end", async () => {
    await expect(
      runComplexityTrend({
        filePath: "src/a.ts",
        since: "1 year ago",
        start: "abc",
        end: "def",
      }),
    ).rejects.toBeInstanceOf(TrendUsageError);
  });

  it("rejects directory paths", async () => {
    const repoPath = await createTempRepo();
    await expect(
      runComplexityTrend({ filePath: repoPath }),
    ).rejects.toBeInstanceOf(TrendUsageError);
  });

  it("throws when file was never tracked", async () => {
    const repoPath = await createTempRepo();
    await commitFile(repoPath, "src/a.ts", "a\n", "first");
    const missingPath = join(repoPath, "src/missing.ts");
    await writeFile(missingPath, "x\n", "utf8");

    await expect(
      runComplexityTrend({ filePath: missingPath, since: "10 years ago" }),
    ).rejects.toBeInstanceOf(TrendNotTrackedError);
  });

  it("returns ascending points with sparklines", async () => {
    const repoPath = await createTempRepo();
    await commitFile(repoPath, "src/a.ts", "a\n", "first");
    await commitFile(repoPath, "src/a.ts", "a\n    b\n", "second");
    await commitFile(repoPath, "src/a.ts", "a\n    b\n        c\n", "third");

    const filePath = join(repoPath, "src/a.ts");
    const result = await runComplexityTrend({
      filePath,
      since: "10 years ago",
      includeScannerVersion: false,
    });

    expect(result.version).toBe("1.0");
    expect(result.kind).toBe("complexity-trend");
    expect(result.points).toHaveLength(3);
    expect(result.points[0]!.mean).toBeLessThanOrEqual(result.points.at(-1)!.mean);
    expect(result.meta.sparklines.mean.length).toBeGreaterThan(0);
    expect(result.meta.sparklines.ncloc.length).toBeGreaterThan(0);
  });

  it("sets truncated meta when sampling", async () => {
    const repoPath = await createTempRepo();
    for (let i = 0; i < 5; i += 1) {
      await commitFile(repoPath, "src/a.ts", `${"x".repeat(i + 1)}\n`, `c${i}`);
    }

    const result = await runComplexityTrend({
      filePath: join(repoPath, "src/a.ts"),
      since: "10 years ago",
      maxRevisions: 2,
      includeScannerVersion: false,
    });

    expect(result.meta.truncated).toBe(true);
    expect(result.points).toHaveLength(2);
    expect(formatTruncationNote(result)).toContain("uniform sample");
  });

  it("returns empty points with warning for empty since window", async () => {
    const repoPath = await createTempRepo();
    await commitFile(repoPath, "src/a.ts", "a\n", "first");
    const filePath = join(repoPath, "src/a.ts");

    const result = await runComplexityTrend({
      filePath,
      since: "2099-01-01",
      includeScannerVersion: false,
    });

    expect(result.points).toEqual([]);
    expect(result.meta.warnings[0]?.code).toBe("EMPTY_HISTORY");
  });

  it("records warning when show fails", async () => {
    const repoPath = await createTempRepo();
    await commitFile(repoPath, "src/a.ts", "a\n", "first");
    const filePath = join(repoPath, "src/a.ts");

    const fileHistory = await import("../git/file-history.js");
    const showSpy = vi
      .spyOn(fileHistory, "showFileAtRevision")
      .mockRejectedValueOnce(new Error("boom"))
      .mockImplementation(fileHistory.showFileAtRevision);

    const result = await runComplexityTrend({
      filePath,
      since: "10 years ago",
      includeScannerVersion: false,
    });

    showSpy.mockRestore();
    expect(result.meta.warnings.some((w) => w.code === "SHOW_FAILED")).toBe(true);
  });
});
