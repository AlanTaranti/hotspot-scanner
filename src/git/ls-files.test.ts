import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildGitLsFilesArgv,
  GitLsFilesError,
  listTrackedFiles,
} from "./ls-files.js";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

import { spawn } from "node:child_process";

const mockedSpawn = vi.mocked(spawn);

function createMockChild(
  stdoutData: Buffer | string,
  exitCode = 0,
  stderr = "",
) {
  const stdout = new PassThrough();
  const stderrStream = new PassThrough();
  const child = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
  };
  child.stdout = stdout;
  child.stderr = stderrStream;

  mockedSpawn.mockReturnValueOnce(child as never);

  queueMicrotask(() => {
    stdout.write(stdoutData);
    stdout.end();
    if (stderr) {
      stderrStream.write(stderr);
    }
    stderrStream.end();
    child.emit("close", exitCode);
  });

  return child;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("buildGitLsFilesArgv", () => {
  it("includes -C, ls-files, and -z", () => {
    expect(buildGitLsFilesArgv("/repo")).toEqual([
      "-C",
      "/repo",
      "ls-files",
      "-z",
    ]);
  });
});

describe("listTrackedFiles", () => {
  it("spawns git ls-files -z and parses null-delimited paths", async () => {
    const stdout = Buffer.from("src/a.ts\0src/b.js\0");
    createMockChild(stdout);

    const paths = await listTrackedFiles("/repo");

    expect(paths).toEqual(["src/a.ts", "src/b.js"]);
    expect(mockedSpawn).toHaveBeenCalledWith(
      "git",
      buildGitLsFilesArgv("/repo"),
      { stdio: ["ignore", "pipe", "pipe"] },
    );
  });

  it("normalizes backslashes to posix separators", async () => {
    createMockChild(Buffer.from("src\\nested\\file.ts\0"));

    const paths = await listTrackedFiles("/repo");

    expect(paths).toEqual(["src/nested/file.ts"]);
  });

  it("returns an empty array when git lists no tracked files", async () => {
    createMockChild(Buffer.alloc(0));

    await expect(listTrackedFiles("/repo")).resolves.toEqual([]);
  });

  it("throws GitLsFilesError with repoPath and stderr on non-zero exit", async () => {
    createMockChild(Buffer.alloc(0), 128, "fatal: not a git repository");

    await expect(listTrackedFiles("/bad/repo")).rejects.toMatchObject({
      name: "GitLsFilesError",
      repoPath: "/bad/repo",
      stderr: "fatal: not a git repository",
    } satisfies Partial<GitLsFilesError>);
  });

  it("throws GitLsFilesError with unknown error when stderr is empty", async () => {
    createMockChild(Buffer.alloc(0), 128, "");

    await expect(listTrackedFiles("/bad/repo")).rejects.toThrow(/unknown error/);
  });

  it("rejects with GitLsFilesError when spawn fails", async () => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: PassThrough;
      stderr: PassThrough;
    };
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    mockedSpawn.mockReturnValueOnce(child as never);

    queueMicrotask(() => {
      child.emit("error", new Error("ENOENT: git not found"));
    });

    await expect(listTrackedFiles("/repo")).rejects.toMatchObject({
      name: "GitLsFilesError",
      repoPath: "/repo",
      stderr: "ENOENT: git not found",
    } satisfies Partial<GitLsFilesError>);
  });
});
