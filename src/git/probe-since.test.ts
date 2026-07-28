import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildGitProbeSinceArgv, probeSinceWindow } from "./probe-since.js";

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

describe("buildGitProbeSinceArgv", () => {
  it("builds git log -1 with since and subject format", () => {
    expect(buildGitProbeSinceArgv("/repo", "12 months ago")).toEqual([
      "-C",
      "/repo",
      "log",
      "-1",
      "--since=12 months ago",
      "--format=%s",
    ]);
  });
});

describe("probeSinceWindow", () => {
  it("returns ok with tip subject when git finds a commit", async () => {
    createMockChild("fix: probe since window\n");

    const result = await probeSinceWindow({
      repoPath: "/repo",
      since: "12 months ago",
    });

    expect(result).toEqual({
      status: "ok",
      tipSubject: "fix: probe since window",
    });
    expect(mockedSpawn).toHaveBeenCalledWith(
      "git",
      buildGitProbeSinceArgv("/repo", "12 months ago"),
      { stdio: ["ignore", "pipe", "pipe"] },
    );
  });

  it("returns empty when git accepts since but finds no commits", async () => {
    createMockChild("");

    const result = await probeSinceWindow({
      repoPath: "/repo",
      since: "99 years ago",
    });

    expect(result).toEqual({ status: "empty" });
  });

  it("returns invalid when git rejects the since string", async () => {
    createMockChild("", 128, "fatal: invalid --since format: not-a-date");

    const result = await probeSinceWindow({
      repoPath: "/repo",
      since: "not-a-date",
    });

    expect(result).toEqual({
      status: "invalid",
      message: "fatal: invalid --since format: not-a-date",
    });
  });

  it("returns invalid with fallback message when stderr is empty", async () => {
    createMockChild("", 1, "");

    const result = await probeSinceWindow({
      repoPath: "/repo",
      since: "???",
    });

    expect(result).toEqual({
      status: "invalid",
      message: "unknown error",
    });
  });

  it("returns invalid when spawn fails", async () => {
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

    const result = await probeSinceWindow({
      repoPath: "/repo",
      since: "12 months ago",
    });

    expect(result).toEqual({
      status: "invalid",
      message: "ENOENT: git not found",
    });
  });
});
