import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GitLogError } from "../spawn.js";
import { buildGitPatchLogArgv, streamGitPatchLog } from "./spawn.js";

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

describe("buildGitPatchLogArgv", () => {
  it("includes patch log flags with unified=0", () => {
    expect(buildGitPatchLogArgv({ repoPath: "/repo" })).toEqual([
      "-C",
      "/repo",
      "log",
      "-p",
      "--unified=0",
      "--pretty=format:COMMIT|%H|%ad|%an",
    ]);
  });

  it("adds --since when provided", () => {
    expect(
      buildGitPatchLogArgv({ repoPath: "/repo", since: "12 months ago" }),
    ).toContain("--since=12 months ago");
  });

  it("omits --since when not provided", () => {
    const argv = buildGitPatchLogArgv({ repoPath: "/repo" });
    expect(argv.some((arg) => arg.startsWith("--since="))).toBe(false);
  });
});

describe("streamGitPatchLog", () => {
  it("yields stdout lines without buffering the full log", async () => {
    createMockChild([
      "COMMIT|abc|2024-01-01|Alice",
      "diff --git a/file.ts b/file.ts",
      "@@ -1 +1 @@",
      "-old",
      "+new",
    ]);

    const lines: string[] = [];
    for await (const line of streamGitPatchLog({ repoPath: "/repo" })) {
      lines.push(line);
    }

    expect(lines).toEqual([
      "COMMIT|abc|2024-01-01|Alice",
      "diff --git a/file.ts b/file.ts",
      "@@ -1 +1 @@",
      "-old",
      "+new",
    ]);
    expect(mockedSpawn).toHaveBeenCalledWith(
      "git",
      buildGitPatchLogArgv({ repoPath: "/repo" }),
      { stdio: ["ignore", "pipe", "pipe"] },
    );
  });

  it("throws GitLogError with repoPath and stderr on non-zero exit", async () => {
    createMockChild([], 128, "fatal: not a git repository");

    await expect(
      (async () => {
        for await (const _line of streamGitPatchLog({
          repoPath: "/bad/repo",
        })) {
          // consume
        }
      })(),
    ).rejects.toMatchObject({
      name: "GitLogError",
      repoPath: "/bad/repo",
      stderr: "fatal: not a git repository",
    } satisfies Partial<GitLogError>);
  });
});
