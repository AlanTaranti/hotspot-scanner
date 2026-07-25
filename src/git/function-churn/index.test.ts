import { describe, expect, it, vi } from "vitest";
import { GitLogError } from "../spawn.js";
import {
  createEmptySinceWindowWarning,
  createRenameHistoryIncompleteWarning,
  formatAmbiguousRenameWarnings,
  formatFunctionPostRenameOverlapWarning,
} from "../rename-warnings.js";
import {
  createFunctionChurnMiner,
  PATHSPEC_ARG_MAX_FALLBACK_CODE,
} from "./index.js";
import { partitionPathspecs, PATCH_PATHSPEC_FALLBACK_THRESHOLD } from "./spawn.js";

const sampleFunction = {
  filePath: "src/a.ts",
  functionName: "fn",
  line: 1,
  endLine: 5,
  complexity: 1,
};

async function* emptyStream(): AsyncGenerator<string> {
  // no commits
}

describe("createFunctionChurnMiner", () => {
  it("returns empty stats when no functions are provided", async () => {
    const streamGitPatchLog = vi.fn(() => emptyStream());
    const miner = createFunctionChurnMiner({ streamGitPatchLog });

    const result = await miner.mine({
      repoPath: "/repo",
      functions: [],
    });

    expect(result.functionStats.size).toBe(0);
    expect(result.warnings).toEqual([]);
    expect(streamGitPatchLog).not.toHaveBeenCalled();
  });

  it("does not spawn patch stream when paths is empty", async () => {
    const streamGitPatchLog = vi.fn(() => emptyStream());
    const miner = createFunctionChurnMiner({ streamGitPatchLog });

    const result = await miner.mine({
      repoPath: "/repo",
      paths: [],
      functions: [sampleFunction],
    });

    expect(result.functionStats.size).toBe(0);
    expect(result.warnings).toEqual([]);
    expect(streamGitPatchLog).not.toHaveBeenCalled();
  });

  it("passes pathspecs to spawn when paths are under threshold", async () => {
    const streamGitPatchLog = vi.fn(() => emptyStream());
    const miner = createFunctionChurnMiner({ streamGitPatchLog });

    await miner.mine({
      repoPath: "/repo",
      paths: ["src/a.ts", "lib/b.js"],
      functions: [sampleFunction],
    });

    expect(streamGitPatchLog).toHaveBeenCalledWith({
      repoPath: "/repo",
      since: undefined,
      paths: ["src/a.ts", "lib/b.js"],
      signal: undefined,
      onSpawnArgv: undefined,
    });
  });

  it("forwards signal and onSpawnArgv to spawn", async () => {
    const streamGitPatchLog = vi.fn(() => emptyStream());
    const miner = createFunctionChurnMiner({ streamGitPatchLog });
    const controller = new AbortController();
    const onSpawnArgv = vi.fn();

    await miner.mine({
      repoPath: "/repo",
      functions: [sampleFunction],
      signal: controller.signal,
      onSpawnArgv,
    });

    expect(streamGitPatchLog).toHaveBeenCalledWith({
      repoPath: "/repo",
      since: undefined,
      paths: undefined,
      signal: controller.signal,
      onSpawnArgv,
    });
  });

  it("spawns pathspec-restricted batches sequentially when paths exceed threshold", async () => {
    const paths = Array.from(
      { length: PATCH_PATHSPEC_FALLBACK_THRESHOLD + 1 },
      (_, i) => `src/file-${i}.ts`,
    );
    const chunks = partitionPathspecs(paths);
    const callOrder: string[] = [];
    const streamGitPatchLog = vi.fn((options: { paths?: string[] }) => {
      callOrder.push(`chunk:${options.paths?.length ?? 0}`);
      return emptyStream();
    });
    const miner = createFunctionChurnMiner({ streamGitPatchLog });

    await miner.mine({
      repoPath: "/repo",
      paths,
      functions: [sampleFunction],
    });

    expect(chunks).toHaveLength(2);
    expect(streamGitPatchLog).toHaveBeenCalledTimes(2);
    expect(streamGitPatchLog).toHaveBeenNthCalledWith(1, {
      repoPath: "/repo",
      since: undefined,
      paths: chunks[0],
      signal: undefined,
      onSpawnArgv: undefined,
    });
    expect(streamGitPatchLog).toHaveBeenNthCalledWith(2, {
      repoPath: "/repo",
      since: undefined,
      paths: chunks[1],
      signal: undefined,
      onSpawnArgv: undefined,
    });
    expect(callOrder).toEqual([
      `chunk:${PATCH_PATHSPEC_FALLBACK_THRESHOLD}`,
      "chunk:1",
    ]);
    for (const call of streamGitPatchLog.mock.calls) {
      expect(call[0]?.paths?.length).toBeGreaterThan(0);
    }
  });

  it("merges batch results without double-counting the same function", async () => {
    const fnA = {
      filePath: "src/a.ts",
      functionName: "fnA",
      line: 1,
      endLine: 5,
      complexity: 1,
    };
    const fnB = {
      filePath: "src/b.ts",
      functionName: "fnB",
      line: 1,
      endLine: 5,
      complexity: 1,
    };

    async function* batchA(): AsyncGenerator<string> {
      yield "COMMIT|aaa|2024-01-01|Alice";
      yield "diff --git a/src/a.ts b/src/a.ts";
      yield "@@ -1 +1 @@";
      yield "-x";
      yield "+y";
    }

    async function* batchB(): AsyncGenerator<string> {
      yield "COMMIT|bbb|2024-01-02|Bob";
      yield "diff --git a/src/b.ts b/src/b.ts";
      yield "@@ -1 +1 @@";
      yield "-a";
      yield "+b";
    }

    const paths = [
      ...Array.from(
        { length: PATCH_PATHSPEC_FALLBACK_THRESHOLD - 1 },
        (_, i) => `src/${String(i).padStart(4, "0")}.ts`,
      ),
      "src/a.ts",
      "src/b.ts",
    ];
    expect(paths).toHaveLength(PATCH_PATHSPEC_FALLBACK_THRESHOLD + 1);
    const streamGitPatchLog = vi.fn((options: { paths?: string[] }) => {
      if (
        options.paths?.includes("src/a.ts") &&
        !options.paths.includes("src/b.ts")
      ) {
        return batchA();
      }
      if (options.paths?.length === 1 && options.paths[0] === "src/b.ts") {
        return batchB();
      }
      return emptyStream();
    });
    const miner = createFunctionChurnMiner({ streamGitPatchLog });

    const result = await miner.mine({
      repoPath: "/repo",
      paths,
      functions: [fnA, fnB],
    });

    const statsA = [...result.functionStats.values()].find(
      (entry) => entry.functionName === "fnA",
    );
    const statsB = [...result.functionStats.values()].find(
      (entry) => entry.functionName === "fnB",
    );
    expect(statsA?.commitCount).toBe(1);
    expect(statsA?.linesChanged).toBe(2);
    expect(statsB?.commitCount).toBe(1);
    expect(statsB?.linesChanged).toBe(2);
    expect(streamGitPatchLog).toHaveBeenCalledTimes(2);
  });

  it("streams without pathspec restriction when paths option is omitted", async () => {
    const streamGitPatchLog = vi.fn(() => emptyStream());
    const miner = createFunctionChurnMiner({ streamGitPatchLog });

    await miner.mine({
      repoPath: "/repo",
      functions: [sampleFunction],
    });

    expect(streamGitPatchLog).toHaveBeenCalledWith({
      repoPath: "/repo",
      since: undefined,
      paths: undefined,
      signal: undefined,
      onSpawnArgv: undefined,
    });
  });

  it("falls back to unrestricted stream when a single-path chunk hits ARG_MAX", async () => {
    const argMaxError = new GitLogError(
      "/repo",
      "git log",
      "fatal: argument list too long",
    );
    const streamGitPatchLog = vi.fn((options: { paths?: string[] }) => {
      if (options.paths !== undefined) {
        throw argMaxError;
      }
      return emptyStream();
    });
    const miner = createFunctionChurnMiner({ streamGitPatchLog });

    const result = await miner.mine({
      repoPath: "/repo",
      paths: ["src/a.ts"],
      functions: [sampleFunction],
    });

    expect(
      streamGitPatchLog.mock.calls.some((call) => call[0]?.paths === undefined),
    ).toBe(true);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: PATHSPEC_ARG_MAX_FALLBACK_CODE,
      }),
    );
  });

  it("rethrows non-ARG_MAX errors during half-size retry", async () => {
    const paths = ["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts"];
    const argMaxError = Object.assign(new Error("spawn E2BIG"), {
      code: "E2BIG",
    });
    const otherError = new Error("git log failed");
    const streamGitPatchLog = vi.fn((options: { paths?: string[] }) => {
      if (options.paths?.length === paths.length) {
        throw argMaxError;
      }
      if (options.paths?.length === 2) {
        throw otherError;
      }
      return emptyStream();
    });
    const miner = createFunctionChurnMiner({ streamGitPatchLog });

    await expect(
      miner.mine({
        repoPath: "/repo",
        paths,
        functions: [sampleFunction],
      }),
    ).rejects.toBe(otherError);
  });

  it("falls back to unrestricted stream after ARG_MAX half-size retry fails", async () => {
    const paths = ["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts"];
    const argMaxError = Object.assign(new Error("spawn E2BIG"), {
      code: "E2BIG",
    });
    const streamGitPatchLog = vi.fn((options: { paths?: string[] }) => {
      if (options.paths !== undefined && options.paths.length > 0) {
        throw argMaxError;
      }
      return emptyStream();
    });
    const miner = createFunctionChurnMiner({ streamGitPatchLog });

    const result = await miner.mine({
      repoPath: "/repo",
      paths,
      functions: [sampleFunction],
    });

    expect(streamGitPatchLog).toHaveBeenCalled();
    expect(
      streamGitPatchLog.mock.calls.some((call) => call[0]?.paths === undefined),
    ).toBe(true);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: PATHSPEC_ARG_MAX_FALLBACK_CODE,
        severity: "warning",
      }),
    );
  });

  it("retries with half-size pathspec chunks after ARG_MAX on initial chunk", async () => {
    const paths = ["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts"];
    const halfChunks = partitionPathspecs(paths, 2);
    const argMaxError = new GitLogError(
      "/repo",
      "git log",
      "fatal: argument list too long",
    );
    const streamGitPatchLog = vi.fn((options: { paths?: string[] }) => {
      if (options.paths?.length === paths.length) {
        throw argMaxError;
      }
      return emptyStream();
    });
    const miner = createFunctionChurnMiner({ streamGitPatchLog });

    await miner.mine({
      repoPath: "/repo",
      paths,
      functions: [sampleFunction],
    });

    expect(streamGitPatchLog).toHaveBeenCalledTimes(3);
    expect(streamGitPatchLog).toHaveBeenNthCalledWith(1, {
      repoPath: "/repo",
      since: undefined,
      paths,
      signal: undefined,
      onSpawnArgv: undefined,
    });
    expect(streamGitPatchLog).toHaveBeenNthCalledWith(2, {
      repoPath: "/repo",
      since: undefined,
      paths: halfChunks[0],
      signal: undefined,
      onSpawnArgv: undefined,
    });
    expect(streamGitPatchLog).toHaveBeenNthCalledWith(3, {
      repoPath: "/repo",
      since: undefined,
      paths: halfChunks[1],
      signal: undefined,
      onSpawnArgv: undefined,
    });
    expect(
      streamGitPatchLog.mock.calls.every((call) => call[0]?.paths !== undefined),
    ).toBe(true);
  });

  it("warns when since window has no commits", async () => {
    const miner = createFunctionChurnMiner({
      streamGitPatchLog: vi.fn(() => emptyStream()),
    });

    const result = await miner.mine({
      repoPath: "/repo",
      since: "1 day ago",
      functions: [
        {
          filePath: "src/a.ts",
          functionName: "fn",
          line: 1,
          endLine: 5,
          complexity: 1,
        },
      ],
    });

    expect(result.warnings).toContainEqual(createEmptySinceWindowWarning());
  });

  it("reports progress when commits are processed", async () => {
    async function* oneCommit(): AsyncGenerator<string> {
      yield "COMMIT|abc|2024-01-01|Alice";
      yield "diff --git a/src/a.ts b/src/a.ts";
      yield "@@ -1 +1 @@";
      yield "-x";
      yield "+y";
    }

    const onProgress = vi.fn();
    const miner = createFunctionChurnMiner({
      streamGitPatchLog: vi.fn(() => oneCommit()),
    });

    await miner.mine({
      repoPath: "/repo",
      functions: [
        {
          filePath: "src/a.ts",
          functionName: "fn",
          line: 1,
          endLine: 5,
          complexity: 1,
        },
      ],
      onProgress,
    });

    expect(onProgress).toHaveBeenCalledWith({
      phase: "function-churn",
      commitsProcessed: 1,
    });
  });

  it("does not emit pós-rename overlap warning without rename or ambiguous signals", async () => {
    async function* oneCommit(): AsyncGenerator<string> {
      yield "COMMIT|abc|2024-01-01|Alice";
      yield "diff --git a/src/a.ts b/src/a.ts";
      yield "@@ -1 +1 @@";
      yield "-x";
      yield "+y";
    }

    const miner = createFunctionChurnMiner({
      streamGitPatchLog: vi.fn(() => oneCommit()),
    });

    const result = await miner.mine({
      repoPath: "/repo",
      functions: [sampleFunction],
    });

    expect(result.warnings).not.toContainEqual(
      createRenameHistoryIncompleteWarning(
        formatFunctionPostRenameOverlapWarning(),
      ),
    );
  });

  it("emits pós-rename overlap warning when a rename link is observed", async () => {
    async function* renameCommit(): AsyncGenerator<string> {
      yield "COMMIT|ddd|2024-01-01|Dev";
      yield "src/old.ts => src/a.ts";
      yield "";
      yield "COMMIT|eee|2024-01-02|Dev";
      yield "diff --git a/src/a.ts b/src/a.ts";
      yield "@@ -1 +1 @@";
      yield "-x";
      yield "+y";
    }

    const miner = createFunctionChurnMiner({
      streamGitPatchLog: vi.fn(() => renameCommit()),
    });

    const result = await miner.mine({
      repoPath: "/repo",
      functions: [sampleFunction],
    });

    expect(result.warnings).toContainEqual(
      createRenameHistoryIncompleteWarning(
        formatFunctionPostRenameOverlapWarning(),
      ),
    );
  });

  it("emits pós-rename overlap warning when ambiguous rename paths are detected", async () => {
    async function* conflictingRenames(): AsyncGenerator<string> {
      yield "COMMIT|aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa|2024-01-01|Alice";
      yield "a.ts => b.ts";
      yield "";
      yield "COMMIT|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|2024-01-02|Bob";
      yield "b.ts => a.ts";
      yield "";
    }

    const miner = createFunctionChurnMiner({
      streamGitPatchLog: vi.fn(() => conflictingRenames()),
    });

    const result = await miner.mine({
      repoPath: "/repo",
      functions: [sampleFunction],
    });

    expect(result.warnings).toEqual(
      expect.arrayContaining([
        createRenameHistoryIncompleteWarning(
          formatAmbiguousRenameWarnings(["a.ts"])[0]!,
        ),
        createRenameHistoryIncompleteWarning(
          formatAmbiguousRenameWarnings(["b.ts"])[0]!,
        ),
        createRenameHistoryIncompleteWarning(
          formatFunctionPostRenameOverlapWarning(),
        ),
      ]),
    );
  });
});
