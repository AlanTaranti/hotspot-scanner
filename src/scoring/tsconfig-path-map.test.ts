import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  TsconfigPathMap,
  loadPathMapForImporter,
  resolveAliasSpecifier,
} from "./tsconfig-path-map.js";

const tempDirs: string[] = [];

async function createTempRepo(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "tsconfig-path-map-"));
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

describe("TsconfigPathMap", () => {
  it("resolves a paths alias hit to repo-relative candidates", async () => {
    const repoPath = await createTempRepo({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "@app/*": ["src/*"],
          },
        },
      }),
      "src/consumer.ts": "export const value = 1;\n",
      "src/provider.ts": "export const value = 2;\n",
    });

    const pathMap = new TsconfigPathMap(repoPath);
    const resolver = pathMap.loadPathMapForImporter("src/consumer.ts");

    expect(resolver).not.toBeNull();
    expect(
      pathMap.resolveAliasSpecifier(
        resolver,
        "src/consumer.ts",
        "@app/provider",
      ),
    ).toEqual(["src/provider"]);
  });

  it("returns empty candidates on alias miss", async () => {
    const repoPath = await createTempRepo({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          paths: {
            "@app/*": ["src/*"],
          },
        },
      }),
      "src/consumer.ts": "export const value = 1;\n",
    });

    const pathMap = new TsconfigPathMap(repoPath);
    const resolver = pathMap.loadPathMapForImporter("src/consumer.ts");

    expect(
      pathMap.resolveAliasSpecifier(
        resolver,
        "src/consumer.ts",
        "@other/module",
      ),
    ).toEqual([]);
    expect(
      pathMap.resolveAliasSpecifier(resolver, "src/consumer.ts", "./relative"),
    ).toEqual([]);
  });

  it("returns null resolver when no config exists", async () => {
    const repoPath = await createTempRepo({
      "src/consumer.ts": "export const value = 1;\n",
    });

    const pathMap = new TsconfigPathMap(repoPath);

    expect(pathMap.loadPathMapForImporter("src/consumer.ts")).toBeNull();
    expect(
      pathMap.resolveAliasSpecifier(null, "src/consumer.ts", "@app/provider"),
    ).toEqual([]);
  });

  it("uses local options when extends target is missing", async () => {
    const repoPath = await createTempRepo({
      "tsconfig.json": JSON.stringify({
        extends: "./missing-base.json",
        compilerOptions: {
          paths: {
            "@local/*": ["lib/*"],
          },
        },
      }),
      "lib/helper.ts": "export const helper = true;\n",
      "src/consumer.ts": "export const value = 1;\n",
    });

    const pathMap = new TsconfigPathMap(repoPath);
    const resolver = pathMap.loadPathMapForImporter("src/consumer.ts");

    expect(
      pathMap.resolveAliasSpecifier(
        resolver,
        "src/consumer.ts",
        "@local/helper",
      ),
    ).toEqual(["lib/helper"]);
  });

  it("merges shallow extends for baseUrl and paths", async () => {
    const repoPath = await createTempRepo({
      "base.json": JSON.stringify({
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "@base/*": ["base-src/*"],
          },
        },
      }),
      "tsconfig.json": JSON.stringify({
        extends: "./base.json",
        compilerOptions: {
          paths: {
            "@app/*": ["src/*"],
          },
        },
      }),
      "src/target.ts": "export const target = 1;\n",
      "base-src/legacy.ts": "export const legacy = 1;\n",
      "src/consumer.ts": "export const value = 1;\n",
    });

    const pathMap = new TsconfigPathMap(repoPath);
    const resolver = pathMap.loadPathMapForImporter("src/consumer.ts");

    expect(
      pathMap.resolveAliasSpecifier(resolver, "src/consumer.ts", "@app/target"),
    ).toEqual(["src/target"]);
    expect(
      pathMap.resolveAliasSpecifier(
        resolver,
        "src/consumer.ts",
        "@base/legacy",
      ),
    ).toEqual([]);
  });

  it("prefers nested package config over repo root", async () => {
    const repoPath = await createTempRepo({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          paths: {
            "@root/*": ["root-src/*"],
          },
        },
      }),
      "packages/app/tsconfig.json": JSON.stringify({
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "@app/*": ["src/*"],
          },
        },
      }),
      "packages/app/src/consumer.ts": "export const value = 1;\n",
      "packages/app/src/provider.ts": "export const value = 2;\n",
      "root-src/other.ts": "export const other = 1;\n",
    });

    const pathMap = new TsconfigPathMap(repoPath);
    const resolver = pathMap.loadPathMapForImporter(
      "packages/app/src/consumer.ts",
    );

    expect(
      pathMap.resolveAliasSpecifier(
        resolver,
        "packages/app/src/consumer.ts",
        "@app/provider",
      ),
    ).toEqual(["packages/app/src/provider"]);
    expect(
      pathMap.resolveAliasSpecifier(
        resolver,
        "packages/app/src/consumer.ts",
        "@root/other",
      ),
    ).toEqual([]);
  });

  it("parses JSONC comments in config files", async () => {
    const repoPath = await createTempRepo({
      "tsconfig.json": `{
        // package paths
        "compilerOptions": {
          "paths": {
            "@app/*": ["src/*"]
          }
        }
      }`,
      "src/consumer.ts": "export const value = 1;\n",
      "src/module.ts": "export const module = 1;\n",
    });

    const pathMap = new TsconfigPathMap(repoPath);
    const resolver = pathMap.loadPathMapForImporter("src/consumer.ts");

    expect(
      pathMap.resolveAliasSpecifier(resolver, "src/consumer.ts", "@app/module"),
    ).toEqual(["src/module"]);
  });

  it("resolves baseUrl without paths mapping", async () => {
    const repoPath = await createTempRepo({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          baseUrl: "src",
        },
      }),
      "src/consumer.ts": "export const value = 1;\n",
      "src/utils/math.ts": "export const sum = (a: number, b: number) => a + b;\n",
    });

    const pathMap = new TsconfigPathMap(repoPath);
    const resolver = pathMap.loadPathMapForImporter("src/consumer.ts");

    expect(
      pathMap.resolveAliasSpecifier(
        resolver,
        "src/consumer.ts",
        "utils/math",
      ),
    ).toEqual(["src/utils/math"]);
  });

  it("caches resolver by config path within a pass", async () => {
    const repoPath = await createTempRepo({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          paths: {
            "@app/*": ["src/*"],
          },
        },
      }),
      "src/a.ts": "export const a = 1;\n",
      "src/b.ts": "export const b = 1;\n",
    });

    const pathMap = new TsconfigPathMap(repoPath);
    const first = pathMap.loadPathMapForImporter("src/a.ts");
    const second = pathMap.loadPathMapForImporter("src/b.ts");

    expect(first).not.toBeNull();
    expect(first).toBe(second);
  });

  it("inherits parent paths when child extends without paths", async () => {
    const repoPath = await createTempRepo({
      "base.json": JSON.stringify({
        compilerOptions: {
          paths: {
            "@base/*": ["base-src/*"],
          },
        },
      }),
      "tsconfig.json": JSON.stringify({
        extends: "./base.json",
        compilerOptions: {
          baseUrl: ".",
        },
      }),
      "base-src/legacy.ts": "export const legacy = 1;\n",
      "src/consumer.ts": "export const value = 1;\n",
    });

    const pathMap = new TsconfigPathMap(repoPath);
    const resolver = pathMap.loadPathMapForImporter("src/consumer.ts");

    expect(
      pathMap.resolveAliasSpecifier(
        resolver,
        "src/consumer.ts",
        "@base/legacy",
      ),
    ).toEqual(["base-src/legacy"]);
  });

  it("resolves jsconfig.json aliases", async () => {
    const repoPath = await createTempRepo({
      "jsconfig.json": JSON.stringify({
        compilerOptions: {
          paths: {
            "@app/*": ["src/*"],
          },
        },
      }),
      "src/consumer.ts": "export const value = 1;\n",
      "src/provider.ts": "export const value = 2;\n",
    });

    const pathMap = new TsconfigPathMap(repoPath);
    const resolver = pathMap.loadPathMapForImporter("src/consumer.ts");

    expect(
      pathMap.resolveAliasSpecifier(
        resolver,
        "src/consumer.ts",
        "@app/provider",
      ),
    ).toEqual(["src/provider"]);
  });

  it("rejects patterns with multiple wildcards", async () => {
    const repoPath = await createTempRepo({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          paths: {
            "@app/**/deep/*": ["src/*"],
          },
        },
      }),
      "src/consumer.ts": "export const value = 1;\n",
    });

    const pathMap = new TsconfigPathMap(repoPath);
    const resolver = pathMap.loadPathMapForImporter("src/consumer.ts");

    expect(
      pathMap.resolveAliasSpecifier(
        resolver,
        "src/consumer.ts",
        "@app/foo/deep/bar",
      ),
    ).toEqual([]);
  });

  it("matches exact path patterns without wildcards", async () => {
    const repoPath = await createTempRepo({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          paths: {
            "@exact": ["src/exact-target"],
          },
        },
      }),
      "src/consumer.ts": "export const value = 1;\n",
      "src/exact-target.ts": "export const exact = 1;\n",
    });

    const pathMap = new TsconfigPathMap(repoPath);
    const resolver = pathMap.loadPathMapForImporter("src/consumer.ts");

    expect(
      pathMap.resolveAliasSpecifier(resolver, "src/consumer.ts", "@exact"),
    ).toEqual(["src/exact-target"]);
    expect(
      pathMap.resolveAliasSpecifier(resolver, "src/consumer.ts", "@other"),
    ).toEqual([]);
  });

  it("rejects specifier when path pattern suffix does not match", async () => {
    const repoPath = await createTempRepo({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          paths: {
            "@app/*/util": ["src/*/util"],
          },
        },
      }),
      "src/consumer.ts": "export const value = 1;\n",
    });

    const pathMap = new TsconfigPathMap(repoPath);
    const resolver = pathMap.loadPathMapForImporter("src/consumer.ts");

    expect(
      pathMap.resolveAliasSpecifier(
        resolver,
        "src/consumer.ts",
        "@app/foo/other",
      ),
    ).toEqual([]);
  });

  it("rejects specifier when path pattern prefix does not match", async () => {
    const repoPath = await createTempRepo({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          paths: {
            "@app/*": ["src/*"],
          },
        },
      }),
      "src/consumer.ts": "export const value = 1;\n",
    });

    const pathMap = new TsconfigPathMap(repoPath);
    const resolver = pathMap.loadPathMapForImporter("src/consumer.ts");

    expect(
      pathMap.resolveAliasSpecifier(
        resolver,
        "src/consumer.ts",
        "@other/module",
      ),
    ).toEqual([]);
  });

  it("breaks cyclic extends without throwing", async () => {
    const repoPath = await createTempRepo({
      "a.json": JSON.stringify({ extends: "./b.json" }),
      "b.json": JSON.stringify({ extends: "./a.json" }),
      "tsconfig.json": JSON.stringify({ extends: "./a.json" }),
      "src/consumer.ts": "export const value = 1;\n",
    });

    const pathMap = new TsconfigPathMap(repoPath);
    const resolver = pathMap.loadPathMapForImporter("src/consumer.ts");

    expect(resolver).not.toBeNull();
    expect(
      pathMap.resolveAliasSpecifier(
        resolver,
        "src/consumer.ts",
        "@app/provider",
      ),
    ).toEqual([]);
  });

  it("resolves literal path targets without wildcards", async () => {
    const repoPath = await createTempRepo({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          paths: {
            "@lib": ["src/lib/index"],
          },
        },
      }),
      "src/consumer.ts": "export const value = 1;\n",
      "src/lib/index.ts": "export const lib = 1;\n",
    });

    const pathMap = new TsconfigPathMap(repoPath);
    const resolver = pathMap.loadPathMapForImporter("src/consumer.ts");

    expect(
      pathMap.resolveAliasSpecifier(resolver, "src/consumer.ts", "@lib"),
    ).toEqual(["src/lib/index"]);
  });

  it("returns null resolver for invalid config JSON", async () => {
    const repoPath = await createTempRepo({
      "tsconfig.json": "{ invalid json",
      "src/consumer.ts": "export const value = 1;\n",
    });

    const pathMap = new TsconfigPathMap(repoPath);

    expect(pathMap.loadPathMapForImporter("src/consumer.ts")).toBeNull();
  });
});

describe("module exports", () => {
  it("exposes loadPathMapForImporter helper", async () => {
    const repoPath = await createTempRepo({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          paths: {
            "@app/*": ["src/*"],
          },
        },
      }),
      "src/consumer.ts": "export const value = 1;\n",
      "src/provider.ts": "export const value = 2;\n",
    });

    const pathMap = new TsconfigPathMap(repoPath);
    const resolver = loadPathMapForImporter(pathMap, "src/consumer.ts");

    expect(
      resolveAliasSpecifier(resolver, "src/consumer.ts", "@app/provider"),
    ).toEqual(["src/provider"]);
  });
});
