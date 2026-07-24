import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildGitLogArgv, GitLogError, streamGitLog } from "./spawn.js";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

import { spawn } from "node:child_process";

const mockedSpawn = vi.mocked(spawn);

function createMockChild(stdoutLines: string[], exitCode = 0, stderr = "") {
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
    for (const line of stdoutLines) {
      stdout.write(`${line}\n`);
    }
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

describe("buildGitLogArgv", () => {
  it("includes required git log flags", () => {
    expect(buildGitLogArgv({ repoPath: "/repo" })).toEqual([
      "-C",
      "/repo",
      "log",
      "-M",
      "--numstat",
      "--pretty=format:COMMIT|%H|%ad|%an",
    ]);
  });

  it("includes find-renames (-M) and omits --follow", () => {
    const argv = buildGitLogArgv({ repoPath: "/repo" });
    expect(argv).toContain("-M");
    expect(argv).not.toContain("--follow");
  });

  it("adds --since when provided", () => {
    expect(
      buildGitLogArgv({ repoPath: "/repo", since: "12 months ago" }),
    ).toContain("--since=12 months ago");
  });

  it("omits --since when not provided", () => {
    const argv = buildGitLogArgv({ repoPath: "/repo" });
    expect(argv.some((arg) => arg.startsWith("--since="))).toBe(false);
  });
});

describe("streamGitLog", () => {
  it("yields stdout lines without buffering the full log", async () => {
    createMockChild(["COMMIT|abc|2024-01-01|Alice", "1\t2\tfile.ts"]);

    const lines: string[] = [];
    for await (const line of streamGitLog({ repoPath: "/repo" })) {
      lines.push(line);
    }

    expect(lines).toEqual(["COMMIT|abc|2024-01-01|Alice", "1\t2\tfile.ts"]);
    expect(mockedSpawn).toHaveBeenCalledWith(
      "git",
      buildGitLogArgv({ repoPath: "/repo" }),
      { stdio: ["ignore", "pipe", "pipe"] },
    );
  });

  it("throws GitLogError with repoPath and stderr on non-zero exit", async () => {
    createMockChild([], 128, "fatal: not a git repository");

    await expect(
      (async () => {
        for await (const _line of streamGitLog({ repoPath: "/bad/repo" })) {
          // consume
        }
      })(),
    ).rejects.toMatchObject({
      name: "GitLogError",
      repoPath: "/bad/repo",
      stderr: "fatal: not a git repository",
    } satisfies Partial<GitLogError>);
  });

  it("throws GitLogError with unknown error when stderr is empty", async () => {
    createMockChild([], 128, "");

    await expect(
      (async () => {
        for await (const _line of streamGitLog({ repoPath: "/bad/repo" })) {
          // consume
        }
      })(),
    ).rejects.toThrow(/unknown error/);
  });
});
