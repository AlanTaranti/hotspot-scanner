import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GitLogError } from "../spawn.js";
import {
  buildGitPatchLogArgv,
  partitionPathspecs,
  PATCH_PATHSPEC_FALLBACK_THRESHOLD,
  streamGitPatchLog,
} from "./spawn.js";

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
    kill: ReturnType<typeof vi.fn>;
  };
  child.stdout = stdout;
  child.stderr = stderrStream;
  child.kill = vi.fn(() => {
    stdout.destroy();
    stderrStream.destroy();
    child.emit("close", exitCode);
  });

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

function createSlowMockChild(firstLine: string, remainingLines: string[]) {
  const stdout = new PassThrough();
  const stderrStream = new PassThrough();
  const child = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
    kill: ReturnType<typeof vi.fn>;
  };
  child.stdout = stdout;
  child.stderr = stderrStream;
  child.kill = vi.fn(() => {
    stdout.destroy();
    stderrStream.destroy();
    child.emit("close", 0);
  });

  mockedSpawn.mockReturnValueOnce(child as never);

  queueMicrotask(() => {
    stdout.write(`${firstLine}\n`);
    for (const line of remainingLines) {
      stdout.write(`${line}\n`);
    }
    stdout.end();
    stderrStream.end();
    child.emit("close", 0);
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
      "-M",
      "-p",
      "--unified=0",
      "--pretty=format:COMMIT|%H|%ad|%an",
    ]);
  });

  it("includes find-renames (-M) and omits --follow", () => {
    const argv = buildGitPatchLogArgv({ repoPath: "/repo" });
    expect(argv).toContain("-M");
    expect(argv).not.toContain("--follow");
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

  it("appends -- and pathspecs when paths are non-empty and under threshold", () => {
    expect(
      buildGitPatchLogArgv({
        repoPath: "/repo",
        paths: ["src/a.ts", "lib/b.js"],
      }),
    ).toEqual([
      "-C",
      "/repo",
      "log",
      "-M",
      "-p",
      "--unified=0",
      "--pretty=format:COMMIT|%H|%ad|%an",
      "--",
      "src/a.ts",
      "lib/b.js",
    ]);
  });

  it("preserves -M, -p, --unified=0, and --since when pathspecs are set", () => {
    const argv = buildGitPatchLogArgv({
      repoPath: "/repo",
      since: "6 months ago",
      paths: ["src/a.ts"],
    });
    expect(argv).toContain("-M");
    expect(argv).toContain("-p");
    expect(argv).toContain("--unified=0");
    expect(argv).toContain("--since=6 months ago");
    expect(argv).toContain("--");
    expect(argv).toContain("src/a.ts");
  });

  it("appends -- and pathspecs when paths exceed the fallback threshold", () => {
    const paths = Array.from(
      { length: PATCH_PATHSPEC_FALLBACK_THRESHOLD + 1 },
      (_, i) => `src/file-${i}.ts`,
    );
    const argv = buildGitPatchLogArgv({ repoPath: "/repo", paths });
    expect(argv[argv.length - paths.length - 1]).toBe("--");
    expect(argv.slice(-paths.length)).toEqual(paths);
  });

  it("omits pathspecs when paths is empty", () => {
    const argv = buildGitPatchLogArgv({ repoPath: "/repo", paths: [] });
    expect(argv).not.toContain("--");
  });

  it("includes pathspecs at exactly the fallback threshold", () => {
    const paths = Array.from(
      { length: PATCH_PATHSPEC_FALLBACK_THRESHOLD },
      (_, i) => `src/file-${i}.ts`,
    );
    const argv = buildGitPatchLogArgv({ repoPath: "/repo", paths });
    expect(argv[argv.length - PATCH_PATHSPEC_FALLBACK_THRESHOLD - 1]).toBe(
      "--",
    );
    expect(argv.slice(-PATCH_PATHSPEC_FALLBACK_THRESHOLD)).toEqual(paths);
  });
});

describe("partitionPathspecs", () => {
  it("sorts paths lexicographically before chunking", () => {
    expect(partitionPathspecs(["z.ts", "a.ts", "m.ts"])).toEqual([
      ["a.ts", "m.ts", "z.ts"],
    ]);
  });

  it("returns a single chunk at exactly the threshold", () => {
    const paths = Array.from(
      { length: PATCH_PATHSPEC_FALLBACK_THRESHOLD },
      (_, i) => `src/file-${i}.ts`,
    );
    const chunks = partitionPathspecs(paths);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(PATCH_PATHSPEC_FALLBACK_THRESHOLD);
    expect(chunks[0]).toEqual([...paths].sort());
  });

  it("splits into threshold + remainder at threshold + 1", () => {
    const paths = Array.from(
      { length: PATCH_PATHSPEC_FALLBACK_THRESHOLD + 1 },
      (_, i) => `src/file-${i}.ts`,
    );
    const chunks = partitionPathspecs(paths);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(PATCH_PATHSPEC_FALLBACK_THRESHOLD);
    expect(chunks[1]).toHaveLength(1);
    expect(chunks.flat()).toEqual([...paths].sort());
  });

  it("builds argv with pathspecs for each partition chunk", () => {
    const paths = Array.from(
      { length: PATCH_PATHSPEC_FALLBACK_THRESHOLD + 1 },
      (_, i) => `src/file-${i}.ts`,
    );
    const chunks = partitionPathspecs(paths);
    expect(chunks).toHaveLength(2);
    for (const chunk of chunks) {
      const argv = buildGitPatchLogArgv({ repoPath: "/repo", paths: chunk });
      expect(argv[argv.length - chunk.length - 1]).toBe("--");
      expect(argv.slice(-chunk.length)).toEqual(chunk);
    }
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

  it("throws AbortError when signal is already aborted", async () => {
    createMockChild(["line1"], 0);
    const controller = new AbortController();
    controller.abort();

    await expect(
      (async () => {
        for await (const _line of streamGitPatchLog({
          repoPath: "/repo",
          signal: controller.signal,
        })) {
          // consume
        }
      })(),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("aborts mid-stream, kills child, and does not hang", async () => {
    const child = createSlowMockChild("line1", ["line2", "line3"]);
    const controller = new AbortController();

    const consumePromise = (async () => {
      const collected: string[] = [];
      for await (const line of streamGitPatchLog({
        repoPath: "/repo",
        signal: controller.signal,
      })) {
        collected.push(line);
        if (collected.length === 1) {
          controller.abort();
        }
      }
      return collected;
    })();

    await expect(consumePromise).rejects.toMatchObject({ name: "AbortError" });
    expect(child.kill).toHaveBeenCalled();
  });

  it("invokes onSpawnArgv with argv before spawn", async () => {
    createMockChild(["line1"], 0);
    const onSpawnArgv = vi.fn();
    const expectedArgv = buildGitPatchLogArgv({
      repoPath: "/repo",
      paths: ["src/a.ts"],
    });

    for await (const _line of streamGitPatchLog({
      repoPath: "/repo",
      paths: ["src/a.ts"],
      onSpawnArgv,
    })) {
      // consume
    }

    expect(onSpawnArgv).toHaveBeenCalledOnce();
    expect(onSpawnArgv).toHaveBeenCalledWith(expectedArgv);
    expect(onSpawnArgv.mock.invocationCallOrder[0]).toBeLessThan(
      mockedSpawn.mock.invocationCallOrder[0]!,
    );
  });
});
