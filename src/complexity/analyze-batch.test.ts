import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { analyzeBatch } from "./analyze-batch.js";
import { createTsMorphProject } from "./project.js";

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
  it("creates a one-shot adapter when project is omitted", async () => {
    const repoPath = await createTempRepo({
      "valid.ts": "export function ok() { return 1; }",
    });

    const output = await analyzeBatch({ repoPath, batch: ["valid.ts"] });

    expect(output.results).toEqual([
      {
        filePath: "valid.ts",
        cyclomaticComplexity: 1,
        functionCount: 1,
      },
    ]);
    expect(output.functions).toHaveLength(1);
    expect(output.functions[0]).toMatchObject({
      filePath: "valid.ts",
      functionName: "ok",
      complexity: 1,
    });
    expect(output.warnings).toEqual([]);
  });

  it("reuses a shared adapter across two sequential batches", async () => {
    const repoPath = await createTempRepo({
      "a.ts": "export function a() { return 1; }",
      "b.ts": "export function b() { if (true) return 2; return 3; }",
    });
    const adapter = createTsMorphProject({ repoPath });

    const first = await analyzeBatch({ repoPath, batch: ["a.ts"] }, adapter);
    const second = await analyzeBatch({ repoPath, batch: ["b.ts"] }, adapter);

    expect(first.results).toEqual([
      {
        filePath: "a.ts",
        cyclomaticComplexity: 1,
        functionCount: 1,
      },
    ]);
    expect(first.functions).toHaveLength(1);
    expect(first.functions[0]).toMatchObject({
      filePath: "a.ts",
      functionName: "a",
      complexity: 1,
    });
    expect(first.warnings).toEqual([]);

    expect(second.results).toEqual([
      {
        filePath: "b.ts",
        cyclomaticComplexity: 2,
        functionCount: 1,
      },
    ]);
    expect(second.functions).toHaveLength(1);
    expect(second.functions[0]).toMatchObject({
      filePath: "b.ts",
      functionName: "b",
      complexity: 2,
    });
    expect(second.warnings).toEqual([]);
  });

  it("emits PARSE_FAILED warnings and partial results for invalid files", async () => {
    const repoPath = await createTempRepo({
      "valid.ts": "export function ok() { return 1; }",
      "invalid.ts": "export function broken( { return; }",
    });

    const output = await analyzeBatch({
      repoPath,
      batch: ["valid.ts", "invalid.ts"],
    });

    expect(output.results).toEqual([
      {
        filePath: "valid.ts",
        cyclomaticComplexity: 1,
        functionCount: 1,
      },
    ]);
    expect(output.functions).toHaveLength(1);
    expect(output.warnings).toHaveLength(1);
    expect(output.warnings[0]).toEqual({
      code: "PARSE_FAILED",
      severity: "warning",
      message: expect.stringMatching(/^Failed to parse invalid\.ts: /),
    });
  });
});
