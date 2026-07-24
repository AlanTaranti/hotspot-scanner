import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { createPathScope } from "../paths/scope.js";
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
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
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

    await expect(
      discoverSourceFiles(join(repoPath, "file.ts")),
    ).rejects.toThrow(/repoPath/);
  });

  it("excludes node_modules by default", async () => {
    const repoPath = await createTempRepo({
      "src/app.ts": "export const app = 1;",
      "node_modules/lib/index.ts": "export const lib = 2;",
    });

    const files = await discoverSourceFiles(repoPath);

    expect(files).toEqual(["src/app.ts"]);
  });

  it("respects include scope", async () => {
    const repoPath = await createTempRepo({
      "src/app.ts": "export const app = 1;",
      "lib/utils.ts": "export const util = 2;",
    });

    const scope = createPathScope({ include: ["src/**"] });
    const files = await discoverSourceFiles(repoPath, scope);

    expect(files).toEqual(["src/app.ts"]);
  });

  it("filters and sorts paths from injected listTrackedFiles", async () => {
    const repoPath = await createTempRepo({
      "src/app.ts": "export const app = 1;",
    });

    const files = await discoverSourceFiles(repoPath, undefined, {
      listTrackedFiles: async () => [
        "src/app.ts",
        "src/readme.md",
        "node_modules/pkg/index.ts",
        "nested/deep/z.ts",
      ],
    });

    expect(files).toEqual(["nested/deep/z.ts", "src/app.ts"]);
  });

  it("applies include scope to injected listTrackedFiles", async () => {
    const repoPath = await createTempRepo({
      "src/app.ts": "export const app = 1;",
      "lib/utils.ts": "export const util = 2;",
    });
    const scope = createPathScope({ include: ["src/**"] });

    const files = await discoverSourceFiles(repoPath, scope, {
      listTrackedFiles: async () => ["src/app.ts", "lib/utils.ts"],
    });

    expect(files).toEqual(["src/app.ts"]);
  });

  it("returns empty array when injected listTrackedFiles yields no eligible paths", async () => {
    const repoPath = await createTempRepo({
      "src/app.ts": "export const app = 1;",
    });

    const files = await discoverSourceFiles(repoPath, undefined, {
      listTrackedFiles: async () => [],
    });

    expect(files).toEqual([]);
  });

  it("falls back to walk when injected listTrackedFiles rejects", async () => {
    const repoPath = await createTempRepo({
      "src/app.ts": "export const app = 1;",
      "src/other.ts": "export const other = 2;",
    });

    const files = await discoverSourceFiles(repoPath, undefined, {
      listTrackedFiles: async () => {
        throw new Error("not a git repository");
      },
    });

    expect(files).toEqual(["src/app.ts", "src/other.ts"]);
  });
});
