import { chmod, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { analyzeBatch } from "./analyze-batch.js";

const tempDirs: string[] = [];

async function createTempRepo(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "complexity-analyze-batch-"));
  tempDirs.push(dir);

  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = join(dir, relativePath);
    await mkdir(join(absolutePath, ".."), { recursive: true });
    await writeFile(absolutePath, content, "utf8");
  }

  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("analyzeBatch", () => {
  it("reads files and returns NCLOC results", async () => {
    const repoPath = await createTempRepo({
      "valid.ts": "export function ok() { return 1; }",
    });

    const output = await analyzeBatch({ repoPath, batch: ["valid.ts"] });

    expect(output.results).toEqual([
      {
        filePath: "valid.ts",
        ncloc: 1,
      },
    ]);
    expect(output.warnings).toEqual([]);
  });

  it("analyzes multiple files in one batch", async () => {
    const repoPath = await createTempRepo({
      "a.ts": "export const a = 1;",
      "b.ts": "export const b = 2;\n// comment",
    });

    const output = await analyzeBatch({ repoPath, batch: ["a.ts", "b.ts"] });

    expect(output.results).toEqual([
      { filePath: "a.ts", ncloc: 1 },
      { filePath: "b.ts", ncloc: 1 },
    ]);
    expect(output.warnings).toEqual([]);
  });

  it("still counts NCLOC for syntactically invalid source", async () => {
    const repoPath = await createTempRepo({
      "valid.ts": "export function ok() { return 1; }",
      "invalid.ts": "export function broken( { return; }",
    });

    const output = await analyzeBatch({
      repoPath,
      batch: ["valid.ts", "invalid.ts"],
    });

    expect(output.results).toEqual([
      { filePath: "valid.ts", ncloc: 1 },
      { filePath: "invalid.ts", ncloc: 1 },
    ]);
    expect(output.warnings).toEqual([]);
  });

  it("emits READ_FAILED warnings and skips unreadable files", async () => {
    const repoPath = await createTempRepo({
      "valid.ts": "export function ok() { return 1; }",
      "unreadable.ts": "export const hidden = 1;",
    });
    const unreadablePath = join(repoPath, "unreadable.ts");
    await chmod(unreadablePath, 0o000);

    try {
      const output = await analyzeBatch({
        repoPath,
        batch: ["valid.ts", "unreadable.ts"],
      });

      expect(output.results).toEqual([
        { filePath: "valid.ts", ncloc: 1 },
      ]);
      expect(output.warnings).toHaveLength(1);
      expect(output.warnings[0]).toEqual({
        code: "READ_FAILED",
        severity: "warning",
        message: expect.stringMatching(/^Failed to read unreadable\.ts: /),
      });
    } finally {
      await chmod(unreadablePath, 0o644);
    }
  });
});
