import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { discoverSourceFiles } from "./discover.js";

const tempDirs: string[] = [];

async function createTempRepo(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "complexity-discover-"));
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

describe("discoverSourceFiles", () => {
  it("returns only eligible extensions recursively", async () => {
    const repoPath = await createTempRepo({
      "src/a.ts": "export const a = 1;",
      "src/b.tsx": "export const b = 2;",
      "src/c.js": "export const c = 3;",
      "src/d.jsx": "export const d = 4;",
      "src/readme.md": "# nope",
      "src/data.json": "{}",
      "nested/deep/e.ts": "export const e = 5;",
    });

    const files = await discoverSourceFiles(repoPath);

    expect(files).toEqual([
      "nested/deep/e.ts",
      "src/a.ts",
      "src/b.tsx",
      "src/c.js",
      "src/d.jsx",
    ]);
  });

  it("throws when repoPath does not exist", async () => {
    await expect(
      discoverSourceFiles("/path/that/does/not/exist"),
    ).rejects.toThrow(/repoPath/);
  });

  it("throws when repoPath is not a directory", async () => {
    const repoPath = await createTempRepo({
      "file.ts": "export const x = 1;",
    });

    await expect(discoverSourceFiles(join(repoPath, "file.ts"))).rejects.toThrow(
      /repoPath/,
    );
  });
});
