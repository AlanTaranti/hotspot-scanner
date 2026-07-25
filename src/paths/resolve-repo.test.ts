import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import {
  buildAutoIncludePattern,
  resolveMonorepoScanPath,
} from "./resolve-repo.js";

const execFileAsync = promisify(execFile);

describe("buildAutoIncludePattern", () => {
  it("yields posix prefix with /** suffix", () => {
    expect(buildAutoIncludePattern("packages/api")).toBe("packages/api/**");
  });

  it("strips leading ./ from prefix", () => {
    expect(buildAutoIncludePattern("./packages/api")).toBe("packages/api/**");
  });
});

describe("resolveMonorepoScanPath", () => {
  it("returns remounted false when request path is git root", async () => {
    const root = "/workspace/monorepo";
    const result = await resolveMonorepoScanPath(root, {
      detectGitToplevel: async () => root,
    });

    expect(result).toEqual({
      repoPath: root,
      requestPath: root,
      remounted: false,
    });
    expect(result.packagePrefix).toBeUndefined();
  });

  it("returns remounted true with packagePrefix and git-root repoPath for nested paths", async () => {
    const root = "/workspace/monorepo";
    const nested = join(root, "packages", "api");
    const result = await resolveMonorepoScanPath(nested, {
      detectGitToplevel: async () => root,
    });

    expect(result).toEqual({
      repoPath: root,
      requestPath: nested,
      packagePrefix: "packages/api",
      remounted: true,
    });
  });

  it("rejects escaping .. relative prefix", async () => {
    const root = "/workspace/monorepo";
    const outside = "/workspace/other";
    await expect(
      resolveMonorepoScanPath(outside, {
        detectGitToplevel: async () => root,
      }),
    ).rejects.toThrow(/outside the git repository root/i);
  });

  it("maps failed detection to not a git repository error", async () => {
    const path = "/tmp/not-a-repo";
    await expect(
      resolveMonorepoScanPath(path, {
        detectGitToplevel: async () => {
          throw new Error("fatal: not a git repository");
        },
      }),
    ).rejects.toThrow(/not a git repository/i);
    await expect(
      resolveMonorepoScanPath(path, {
        detectGitToplevel: async () => {
          throw new Error("fatal: not a git repository");
        },
      }),
    ).rejects.toThrow(/Hint:.*\.git/);
  });

  it("maps detector rejection to not a git repository error", async () => {
    const path = "/tmp/not-a-repo";
    await expect(
      resolveMonorepoScanPath(path, {
        detectGitToplevel: async () => {
          throw new Error(
            "repoPath is not a git repository: /tmp/not-a-repo\nHint: pass a repository root that contains a .git directory, or cd into the Git repo first.",
          );
        },
      }),
    ).rejects.toThrow(/not a git repository: \/tmp\/not-a-repo/);
  });

  it("resolves nested package path against a real temp git repo", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "resolve-repo-"));
    const packageDir = join(tempDir, "packages", "api");
    try {
      await mkdir(packageDir, { recursive: true });
      await execFileAsync("git", ["init"], { cwd: tempDir });

      const result = await resolveMonorepoScanPath(packageDir);

      expect(result.remounted).toBe(true);
      expect(result.repoPath).toBe(tempDir);
      expect(result.requestPath).toBe(packageDir);
      expect(result.packagePrefix).toBe("packages/api");
      expect(buildAutoIncludePattern(result.packagePrefix!)).toBe(
        "packages/api/**",
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("returns remounted false for git root in a real temp git repo", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "resolve-repo-root-"));
    try {
      await execFileAsync("git", ["init"], { cwd: tempDir });

      const result = await resolveMonorepoScanPath(tempDir);

      expect(result).toEqual({
        repoPath: tempDir,
        requestPath: tempDir,
        remounted: false,
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("fails for a non-git directory using the default detector", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "resolve-repo-nogit-"));
    try {
      await expect(resolveMonorepoScanPath(tempDir)).rejects.toThrow(
        /not a git repository/i,
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
