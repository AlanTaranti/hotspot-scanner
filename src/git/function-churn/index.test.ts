import { describe, expect, it, vi } from "vitest";
import {
  createEmptySinceWindowWarning,
  createRenameHistoryIncompleteWarning,
  formatAmbiguousRenameWarnings,
  formatFunctionPostRenameOverlapWarning,
} from "../rename-warnings.js";
import { createFunctionChurnMiner } from "./index.js";
import { PATCH_PATHSPEC_FALLBACK_THRESHOLD } from "./spawn.js";

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
    });
  });

  it("falls back to unrestricted spawn argv when paths exceed threshold", async () => {
    const paths = Array.from(
      { length: PATCH_PATHSPEC_FALLBACK_THRESHOLD + 1 },
      (_, i) => `src/file-${i}.ts`,
    );
    const streamGitPatchLog = vi.fn(() => emptyStream());
    const miner = createFunctionChurnMiner({ streamGitPatchLog });

    await miner.mine({
      repoPath: "/repo",
      paths,
      functions: [sampleFunction],
    });

    expect(streamGitPatchLog).toHaveBeenCalledWith({
      repoPath: "/repo",
      since: undefined,
      paths,
    });
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
