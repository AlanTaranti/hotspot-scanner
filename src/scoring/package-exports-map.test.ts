import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  PackageExportsMap,
  expandExportTargetValue,
  resolveExportSubpath,
  resolveMainEntry,
  type PackageScope,
} from "./package-exports-map.js";

const tempDirs: string[] = [];

async function createTempRepo(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "package-exports-map-"));
  tempDirs.push(dir);

  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = join(dir, relativePath);
    await mkdir(join(absolutePath, ".."), { recursive: true });
    await writeFile(absolutePath, content, "utf8");
  }

  return dir;
}

function scope(
  overrides: Partial<PackageScope> & Pick<PackageScope, "packageDirRepoRelative">,
): PackageScope {
  return {
    name: null,
    exports: undefined,
    imports: undefined,
    main: null,
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("PackageExportsMap", () => {
  describe("loadScopeForImporter", () => {
    it("loads nearest package.json walking up from importer", async () => {
      const repoPath = await createTempRepo({
        "package.json": JSON.stringify({ name: "root" }),
        "packages/a/package.json": JSON.stringify({
          name: "@repo/a",
          exports: { ".": "./src/index.ts" },
        }),
        "packages/a/src/consumer.ts": "export {};\n",
      });

      const map = new PackageExportsMap(repoPath);
      const loaded = map.loadScopeForImporter("packages/a/src/consumer.ts");

      expect(loaded).toEqual({
        packageDirRepoRelative: "packages/a",
        name: "@repo/a",
        exports: { ".": "./src/index.ts" },
        imports: undefined,
        main: null,
      });
    });

    it("caches package.json reads by path", async () => {
      const repoPath = await createTempRepo({
        "package.json": JSON.stringify({ name: "root" }),
        "src/consumer.ts": "export {};\n",
      });

      const map = new PackageExportsMap(repoPath);
      const first = map.loadScopeForImporter("src/consumer.ts");
      const second = map.loadScopeForImporter("src/other.ts");

      expect(first).toBe(second);
    });

    it("returns null for malformed package.json", async () => {
      const repoPath = await createTempRepo({
        "package.json": "{ not valid json",
        "src/consumer.ts": "export {};\n",
      });

      const map = new PackageExportsMap(repoPath);
      expect(map.loadScopeForImporter("src/consumer.ts")).toBeNull();
    });

    it("returns null when no package.json exists", async () => {
      const repoPath = await createTempRepo({
        "src/consumer.ts": "export {};\n",
      });

      const map = new PackageExportsMap(repoPath);
      expect(map.loadScopeForImporter("src/consumer.ts")).toBeNull();
    });
  });

  describe("resolveImportSpecifier", () => {
    it("resolves exact # imports mapping", async () => {
      const repoPath = await createTempRepo({
        "package.json": JSON.stringify({
          imports: {
            "#util": "./src/util.ts",
          },
        }),
        "src/consumer.ts": "export {};\n",
        "src/util.ts": "export const x = 1;\n",
      });

      const map = new PackageExportsMap(repoPath);
      expect(map.resolveImportSpecifier("src/consumer.ts", "#util")).toEqual([
        "src/util.ts",
      ]);
    });

    it("resolves single-* # imports pattern", async () => {
      const repoPath = await createTempRepo({
        "package.json": JSON.stringify({
          imports: {
            "#lib/*": "./src/lib/*.ts",
          },
        }),
        "src/consumer.ts": "export {};\n",
        "src/lib/foo.ts": "export const foo = 1;\n",
      });

      const map = new PackageExportsMap(repoPath);
      expect(map.resolveImportSpecifier("src/consumer.ts", "#lib/foo")).toEqual([
        "src/lib/foo.ts",
      ]);
    });

    it("returns empty for non-# specifiers", async () => {
      const repoPath = await createTempRepo({
        "package.json": JSON.stringify({
          imports: { "#util": "./src/util.ts" },
        }),
        "src/consumer.ts": "export {};\n",
      });

      const map = new PackageExportsMap(repoPath);
      expect(map.resolveImportSpecifier("src/consumer.ts", "./util")).toEqual(
        [],
      );
    });

    it("returns empty on imports miss", async () => {
      const repoPath = await createTempRepo({
        "package.json": JSON.stringify({
          imports: { "#util": "./src/util.ts" },
        }),
        "src/consumer.ts": "export {};\n",
      });

      const map = new PackageExportsMap(repoPath);
      expect(map.resolveImportSpecifier("src/consumer.ts", "#missing")).toEqual(
        [],
      );
    });

    it("returns empty when importer package.json is malformed", async () => {
      const repoPath = await createTempRepo({
        "package.json": "{ broken",
        "src/consumer.ts": "export {};\n",
      });

      const map = new PackageExportsMap(repoPath);
      expect(map.resolveImportSpecifier("src/consumer.ts", "#util")).toEqual([]);
    });

    it("resolves wildcard # imports with conditional target", async () => {
      const repoPath = await createTempRepo({
        "package.json": JSON.stringify({
          imports: {
            "#features/*": {
              import: "./src/features/*.mjs",
              types: "./src/features/*.d.ts",
            },
          },
        }),
        "src/consumer.ts": "export {};\n",
      });

      const map = new PackageExportsMap(repoPath);
      expect(
        map.resolveImportSpecifier("src/consumer.ts", "#features/foo"),
      ).toEqual(["src/features/foo.mjs", "src/features/foo.d.ts"]);
    });

    it("resolves exact # imports with conditional target", async () => {
      const repoPath = await createTempRepo({
        "package.json": JSON.stringify({
          imports: {
            "#entry": {
              import: "./src/index.mjs",
              require: "./src/index.cjs",
            },
          },
        }),
        "src/consumer.ts": "export {};\n",
      });

      const map = new PackageExportsMap(repoPath);
      expect(map.resolveImportSpecifier("src/consumer.ts", "#entry")).toEqual([
        "src/index.mjs",
        "src/index.cjs",
      ]);
    });

    it("returns empty when imports field is absent", async () => {
      const repoPath = await createTempRepo({
        "package.json": JSON.stringify({ name: "pkg" }),
        "src/consumer.ts": "export {};\n",
      });

      const map = new PackageExportsMap(repoPath);
      expect(map.resolveImportSpecifier("src/consumer.ts", "#util")).toEqual(
        [],
      );
    });
  });

  describe("indexPeers", () => {
    it("indexes packages by name from peer paths", async () => {
      const repoPath = await createTempRepo({
        "packages/a/package.json": JSON.stringify({
          name: "@repo/a",
          exports: { ".": "./src/index.ts" },
        }),
        "packages/b/package.json": JSON.stringify({
          name: "@repo/b",
          exports: { ".": "./src/index.ts" },
        }),
        "packages/a/src/index.ts": "export const a = 1;\n",
        "packages/b/src/index.ts": "export const b = 1;\n",
      });

      const map = new PackageExportsMap(repoPath);
      map.indexPeers(
        new Set(["packages/a/src/index.ts", "packages/b/src/index.ts"]),
      );

      expect(
        map.resolvePackageSpecifier("packages/a/src/consumer.ts", "@repo/a"),
      ).toEqual(["packages/a/src/index.ts"]);
      expect(
        map.resolvePackageSpecifier("packages/b/src/consumer.ts", "@repo/b"),
      ).toEqual(["packages/b/src/index.ts"]);
    });

    it("skips peers without a package.json scope", async () => {
      const repoPath = await createTempRepo({
        "src/peer.ts": "export {};\n",
      });

      const map = new PackageExportsMap(repoPath);
      map.indexPeers(new Set(["src/peer.ts"]));

      expect(
        map.resolvePackageSpecifier("src/consumer.ts", "missing-pkg"),
      ).toEqual([]);
    });
  });

  describe("resolvePackageSpecifier", () => {
    it("resolves scoped package entry via exports", async () => {
      const repoPath = await createTempRepo({
        "packages/b/package.json": JSON.stringify({
          name: "@repo/b",
          exports: { ".": "./src/index.ts" },
        }),
        "packages/b/src/index.ts": "export const b = 1;\n",
        "packages/a/src/consumer.ts": "export {};\n",
      });

      const map = new PackageExportsMap(repoPath);
      map.indexPeers(new Set(["packages/b/src/index.ts"]));

      expect(
        map.resolvePackageSpecifier("packages/a/src/consumer.ts", "@repo/b"),
      ).toEqual(["packages/b/src/index.ts"]);
    });

    it("resolves package name subpath via exports", async () => {
      const repoPath = await createTempRepo({
        "packages/b/package.json": JSON.stringify({
          name: "@repo/b",
          exports: {
            ".": "./src/index.ts",
            "./utils": "./src/utils.ts",
          },
        }),
        "packages/b/src/index.ts": "export const b = 1;\n",
        "packages/b/src/utils.ts": "export const util = 1;\n",
        "packages/a/src/consumer.ts": "export {};\n",
      });

      const map = new PackageExportsMap(repoPath);
      map.indexPeers(new Set(["packages/b/src/index.ts"]));

      expect(
        map.resolvePackageSpecifier(
          "packages/a/src/consumer.ts",
          "@repo/b/utils",
        ),
      ).toEqual(["packages/b/src/utils.ts"]);
    });

    it("resolves unscoped package subpath", async () => {
      const repoPath = await createTempRepo({
        "packages/lib/package.json": JSON.stringify({
          name: "my-lib",
          exports: {
            ".": "./src/index.ts",
            "./feature": "./src/feature.ts",
          },
        }),
        "packages/lib/src/index.ts": "export {};\n",
        "packages/lib/src/feature.ts": "export const f = 1;\n",
        "src/consumer.ts": "export {};\n",
      });

      const map = new PackageExportsMap(repoPath);
      map.indexPeers(new Set(["packages/lib/src/index.ts"]));

      expect(
        map.resolvePackageSpecifier("src/consumer.ts", "my-lib/feature"),
      ).toEqual(["packages/lib/src/feature.ts"]);
    });

    it("returns empty for names not in the peer index", async () => {
      const repoPath = await createTempRepo({
        "packages/a/package.json": JSON.stringify({
          name: "@repo/a",
          exports: { ".": "./src/index.ts" },
        }),
        "packages/a/src/consumer.ts": "export {};\n",
      });

      const map = new PackageExportsMap(repoPath);
      map.indexPeers(new Set(["packages/a/src/consumer.ts"]));

      expect(
        map.resolvePackageSpecifier(
          "packages/a/src/consumer.ts",
          "external-package",
        ),
      ).toEqual([]);
    });

    it("returns empty without node_modules fallback", async () => {
      const repoPath = await createTempRepo({
        "package.json": JSON.stringify({ name: "root" }),
        "src/consumer.ts": "export {};\n",
      });

      const map = new PackageExportsMap(repoPath);
      map.indexPeers(new Set(["src/consumer.ts"]));

      expect(
        map.resolvePackageSpecifier("src/consumer.ts", "lodash"),
      ).toEqual([]);
    });

    it("resolves self-package name when indexed via peer in same package", async () => {
      const repoPath = await createTempRepo({
        "packages/a/package.json": JSON.stringify({
          name: "@repo/a",
          exports: { ".": "./src/index.ts" },
        }),
        "packages/a/src/consumer.ts": "export {};\n",
        "packages/a/src/index.ts": "export const x = 1;\n",
      });

      const map = new PackageExportsMap(repoPath);
      map.indexPeers(new Set(["packages/a/src/index.ts"]));

      expect(
        map.resolvePackageSpecifier(
          "packages/a/src/consumer.ts",
          "@repo/a",
        ),
      ).toEqual(["packages/a/src/index.ts"]);
    });

    it("falls back to main when exports is absent for package entry", async () => {
      const repoPath = await createTempRepo({
        "packages/b/package.json": JSON.stringify({
          name: "@repo/b",
          main: "./lib/index.js",
        }),
        "packages/b/lib/index.js": "module.exports = {};\n",
        "packages/a/src/consumer.ts": "export {};\n",
      });

      const map = new PackageExportsMap(repoPath);
      map.indexPeers(new Set(["packages/b/lib/index.js"]));

      expect(
        map.resolvePackageSpecifier("packages/a/src/consumer.ts", "@repo/b"),
      ).toEqual(["packages/b/lib/index.js"]);
    });

    it("returns empty for relative and # specifiers", async () => {
      const repoPath = await createTempRepo({
        "package.json": JSON.stringify({
          name: "@repo/pkg",
          exports: { ".": "./src/index.ts" },
        }),
        "src/consumer.ts": "export {};\n",
      });

      const map = new PackageExportsMap(repoPath);
      map.indexPeers(new Set(["src/consumer.ts"]));

      expect(
        map.resolvePackageSpecifier("src/consumer.ts", "./util"),
      ).toEqual([]);
      expect(
        map.resolvePackageSpecifier("src/consumer.ts", "#util"),
      ).toEqual([]);
    });

    it("returns empty on export subpath miss", async () => {
      const repoPath = await createTempRepo({
        "packages/b/package.json": JSON.stringify({
          name: "@repo/b",
          exports: { ".": "./src/index.ts" },
        }),
        "packages/b/src/index.ts": "export {};\n",
        "src/consumer.ts": "export {};\n",
      });

      const map = new PackageExportsMap(repoPath);
      map.indexPeers(new Set(["packages/b/src/index.ts"]));

      expect(
        map.resolvePackageSpecifier("src/consumer.ts", "@repo/b/missing"),
      ).toEqual([]);
    });
  });
});

describe("expandExportTargetValue", () => {
  it("expands string targets", () => {
    expect(expandExportTargetValue("./index.js")).toEqual(["./index.js"]);
  });

  it("flattens array targets in order", () => {
    expect(
      expandExportTargetValue(["./first.js", "./second.js"]),
    ).toEqual(["./first.js", "./second.js"]);
  });

  it("unions conditional export branches", () => {
    expect(
      expandExportTargetValue({
        import: "./index.mjs",
        require: "./index.cjs",
        default: "./index.js",
      }),
    ).toEqual(["./index.mjs", "./index.cjs", "./index.js"]);
  });

  it("includes nested node condition targets", () => {
    expect(
      expandExportTargetValue({
        node: {
          import: "./node-import.mjs",
          default: "./node-default.js",
        },
      }),
    ).toEqual(["./node-import.mjs", "./node-default.js"]);
  });

  it("ignores browser-only condition keys", () => {
    expect(
      expandExportTargetValue({
        browser: "./browser.js",
        import: "./import.js",
      }),
    ).toEqual(["./import.js"]);
  });

  it("returns empty for subpath export maps passed as target values", () => {
    expect(
      expandExportTargetValue({
        ".": "./index.js",
        "./foo": "./foo.js",
      }),
    ).toEqual([]);
  });

  it("returns empty for unrecognized object shapes", () => {
    expect(expandExportTargetValue({ custom: "./value.js" })).toEqual([]);
  });

  it("includes types condition targets", () => {
    expect(
      expandExportTargetValue({
        types: "./index.d.ts",
      }),
    ).toEqual(["./index.d.ts"]);
  });
});

describe("resolveExportSubpath", () => {
  it("resolves string exports as entry subpath", async () => {
    const repoPath = await createTempRepo({});
    const pkg = scope({
      packageDirRepoRelative: "packages/b",
      exports: "./dist/index.js",
    });

    expect(resolveExportSubpath(pkg, ".", repoPath)).toEqual([
      "packages/b/dist/index.js",
    ]);
    expect(resolveExportSubpath(pkg, "./other", repoPath)).toEqual([]);
  });

  it("resolves object exports subpaths and wildcards", async () => {
    const repoPath = await createTempRepo({});
    const pkg = scope({
      packageDirRepoRelative: "packages/b",
      exports: {
        ".": "./src/index.ts",
        "./features/*": "./src/features/*.ts",
      },
    });

    expect(resolveExportSubpath(pkg, ".", repoPath)).toEqual([
      "packages/b/src/index.ts",
    ]);
    expect(resolveExportSubpath(pkg, "./features/foo", repoPath)).toEqual([
      "packages/b/src/features/foo.ts",
    ]);
  });

  it("unions conditional targets for a subpath", async () => {
    const repoPath = await createTempRepo({});
    const pkg = scope({
      packageDirRepoRelative: "packages/b",
      exports: {
        ".": {
          import: "./src/index.mjs",
          require: "./src/index.cjs",
          types: "./src/index.d.ts",
        },
      },
    });

    expect(resolveExportSubpath(pkg, ".", repoPath)).toEqual([
      "packages/b/src/index.mjs",
      "packages/b/src/index.cjs",
      "packages/b/src/index.d.ts",
    ]);
  });

  it("returns empty on export subpath miss", async () => {
    const repoPath = await createTempRepo({});
    const pkg = scope({
      packageDirRepoRelative: "packages/b",
      exports: { ".": "./src/index.ts" },
    });

    expect(resolveExportSubpath(pkg, "./missing", repoPath)).toEqual([]);
  });

  it("returns empty for non-object exports shapes", async () => {
    const repoPath = await createTempRepo({});
    const pkg = scope({
      packageDirRepoRelative: "packages/b",
      exports: ["./index.js"],
    });

    expect(resolveExportSubpath(pkg, ".", repoPath)).toEqual([]);
  });

  it("deduplicates identical conditional targets", async () => {
    const repoPath = await createTempRepo({});
    const pkg = scope({
      packageDirRepoRelative: "packages/b",
      exports: {
        ".": {
          import: "./src/index.js",
          default: "./src/index.js",
        },
      },
    });

    expect(resolveExportSubpath(pkg, ".", repoPath)).toEqual([
      "packages/b/src/index.js",
    ]);
  });
});

describe("resolveMainEntry", () => {
  it("returns main path when exports is absent", async () => {
    const repoPath = await createTempRepo({});
    const pkg = scope({
      packageDirRepoRelative: "packages/b",
      main: "./lib/index.js",
    });

    expect(resolveMainEntry(pkg, repoPath)).toEqual([
      "packages/b/lib/index.js",
    ]);
  });

  it("returns package directory when exports and main are absent", async () => {
    const repoPath = await createTempRepo({});
    const pkg = scope({
      packageDirRepoRelative: "packages/b",
    });

    expect(resolveMainEntry(pkg, repoPath)).toEqual(["packages/b"]);
  });

  it("does not fall back to main when exports is present", async () => {
    const repoPath = await createTempRepo({});
    const pkg = scope({
      packageDirRepoRelative: "packages/b",
      main: "./lib/index.js",
      exports: { ".": "./src/index.ts" },
    });

    expect(resolveMainEntry(pkg, repoPath)).toEqual([]);
  });
});
