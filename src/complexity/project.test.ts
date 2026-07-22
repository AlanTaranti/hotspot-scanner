import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { createTsMorphProject } from "./project.js";

const tempDirs: string[] = [];

async function createTempRepo(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "complexity-project-"));
  tempDirs.push(dir);

  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = join(dir, relativePath);
    await mkdir(join(absolutePath, ".."), { recursive: true });
    await writeFile(absolutePath, content, "utf8");
  }

  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("createTsMorphProject", () => {
  it("loads valid source files", async () => {
    const repoPath = await createTempRepo({
      "valid.ts": "export function ok() { return 1; }",
    });
    const project = createTsMorphProject({ repoPath });

    const sourceFiles = await project.loadBatch(["valid.ts"]);

    expect(sourceFiles).toHaveLength(1);
    expect(project.getParseFailures()).toEqual([]);
  });

  it("records parse failures for invalid syntax", async () => {
    const repoPath = await createTempRepo({
      "invalid.ts": "export function broken( { return; }",
    });
    const project = createTsMorphProject({ repoPath });

    const sourceFiles = await project.loadBatch(["invalid.ts"]);

    expect(sourceFiles).toHaveLength(0);
    expect(project.getParseFailures()).toHaveLength(1);
    expect(project.getParseFailures()[0]).toMatchObject({
      filePath: "invalid.ts",
    });
    expect(project.getParseFailures()[0]?.message.length).toBeGreaterThan(0);
  });

  it("processes at most one batch per loadBatch call", async () => {
    const repoPath = await createTempRepo({
      "a.ts": "export const a = 1;",
      "b.ts": "export const b = 2;",
    });
    const project = createTsMorphProject({ repoPath });

    const firstBatch = await project.loadBatch(["a.ts"]);
    const secondBatch = await project.loadBatch(["b.ts"]);

    expect(firstBatch).toHaveLength(1);
    expect(secondBatch).toHaveLength(1);
    expect(firstBatch[0]?.getBaseName()).toBe("a.ts");
    expect(secondBatch[0]?.getBaseName()).toBe("b.ts");
  });
});
