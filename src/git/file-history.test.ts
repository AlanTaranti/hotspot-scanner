import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildGitFileLogArgv,
  buildGitShowFileArgv,
  GitFileHistoryError,
  listFileRevisions,
  showFileAtRevision,
} from "./file-history.js";
import { buildGitLogArgv } from "./spawn.js";

const execFileAsync = promisify(execFile);

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

async function createTempRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "hotspot-file-history-"));
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

describe("buildGitFileLogArgv", () => {
  it("includes follow by default path and since", () => {
    const argv = buildGitFileLogArgv({
      repoPath: "/repo",
      filePath: "src/a.ts",
      since: "12 months ago",
      follow: true,
    });
    expect(argv).toContain("--follow");
    expect(argv).toContain("--since=12 months ago");
    expect(argv.at(-1)).toBe("src/a.ts");
  });

  it("omits follow when disabled", () => {
    const argv = buildGitFileLogArgv({
      repoPath: "/repo",
      filePath: "src/a.ts",
      follow: false,
    });
    expect(argv).not.toContain("--follow");
  });

  it("supports start..end range", () => {
    const argv = buildGitFileLogArgv({
      repoPath: "/repo",
      filePath: "src/a.ts",
      start: "abc",
      end: "def",
      follow: true,
    });
    expect(argv).toContain("abc..def");
  });
});

describe("buildGitShowFileArgv", () => {
  it("builds show rev:path", () => {
    expect(
      buildGitShowFileArgv({
        repoPath: "/repo",
        rev: "abc123",
        pathAtRev: "src/foo.ts",
      }),
    ).toEqual(["-C", "/repo", "show", "abc123:src/foo.ts"]);
  });
});

describe("scan miner argv", () => {
  it("does not add global --follow", () => {
    const argv = buildGitLogArgv({ repoPath: "/repo", since: "1 year ago" });
    expect(argv).not.toContain("--follow");
  });
});

describe.sequential("listFileRevisions integration", () => {
  it("lists revisions oldest-first with follow", async () => {
    const repoPath = await createTempRepo();
    await commitFile(repoPath, "src/a.ts", "v1\n", "first");
    await commitFile(repoPath, "src/a.ts", "v2\n", "second");
    await commitFile(repoPath, "src/a.ts", "v3\n", "third");

    const revisions = await listFileRevisions({
      repoPath,
      filePath: "src/a.ts",
      follow: true,
    });

    expect(revisions).toHaveLength(3);
    expect(revisions[0]?.pathAtRev).toBe("src/a.ts");
    expect(revisions.at(-1)?.pathAtRev).toBe("src/a.ts");
    expect(revisions[0]?.rev).not.toBe(revisions.at(-1)?.rev);
  });

  it("returns empty for unknown path", async () => {
    const repoPath = await createTempRepo();
    await commitFile(repoPath, "src/a.ts", "v1\n", "first");

    const revisions = await listFileRevisions({
      repoPath,
      filePath: "src/missing.ts",
      follow: true,
    });

    expect(revisions).toEqual([]);
  });

  it("aborts listFileRevisions when signal is already aborted", async () => {
    const repoPath = await createTempRepo();
    await commitFile(repoPath, "src/a.ts", "v1\n", "first");
    const controller = new AbortController();
    controller.abort();

    await expect(
      listFileRevisions({
        repoPath,
        filePath: "src/a.ts",
        follow: true,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("throws GitFileHistoryError for invalid repository", async () => {
    await expect(
      listFileRevisions({
        repoPath: "/tmp/not-a-real-hotspot-repo",
        filePath: "src/a.ts",
        follow: true,
      }),
    ).rejects.toBeInstanceOf(GitFileHistoryError);
  });
});

describe.sequential("showFileAtRevision integration", () => {
  it("returns blob text at revision", async () => {
    const repoPath = await createTempRepo();
    await commitFile(repoPath, "src/a.ts", "hello\n", "first");
    await commitFile(repoPath, "src/a.ts", "world\n", "second");

    const revisions = await listFileRevisions({
      repoPath,
      filePath: "src/a.ts",
      follow: true,
    });

    const first = revisions[0]!;
    const content = await showFileAtRevision({
      repoPath,
      rev: first.rev,
      pathAtRev: first.pathAtRev,
    });

    expect(content).toBe("hello\n");
  });

  it("throws GitFileHistoryError for missing object", async () => {
    const repoPath = await createTempRepo();
    await commitFile(repoPath, "src/a.ts", "hello\n", "first");

    await expect(
      showFileAtRevision({
        repoPath,
        rev: "deadbeef",
        pathAtRev: "src/a.ts",
      }),
    ).rejects.toBeInstanceOf(GitFileHistoryError);
  });
});
