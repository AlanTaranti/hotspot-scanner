import { describe, expect, it, vi } from "vitest";
import { createFunctionChurnMiner } from "./index.js";

async function* emptyStream(): AsyncGenerator<string> {
  // no commits
}

describe("createFunctionChurnMiner", () => {
  it("returns empty stats when no functions are provided", async () => {
    const miner = createFunctionChurnMiner({
      streamGitPatchLog: vi.fn(() => emptyStream()),
    });

    const result = await miner.mine({
      repoPath: "/repo",
      functions: [],
    });

    expect(result.functionStats.size).toBe(0);
    expect(result.warnings).toEqual([]);
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

    expect(result.warnings).toContain(
      "No commits found in the specified --since window.",
    );
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

    expect(onProgress).toHaveBeenCalledWith({ commitsProcessed: 1 });
  });
});
