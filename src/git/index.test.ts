import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createScanWarning } from "../diagnostics/logger.js";
import {
  createEmptySinceWindowWarning,
  createRenameHistoryIncompleteWarning,
  formatAmbiguousRenameWarnings,
  formatSinceTruncationWarning,
  formatUnlinkedRenameWarnings,
} from "./rename-warnings.js";
import { createGitMiner } from "./index.js";
import { MEGA_COMMIT_SKIPPED_CODE } from "./mega-commit-warnings.js";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures/git-log",
);

async function fixtureLines(name: string): Promise<string[]> {
  const lines: string[] = [];
  const rl = createInterface({
    input: createReadStream(join(fixturesDir, name)),
  });
  for await (const line of rl) {
    if (line.startsWith("#")) {
      continue;
    }
    lines.push(line);
  }
  return lines;
}

function streamFromLines(lines: string[]) {
  return async function* () {
    for (const line of lines) {
      yield line;
    }
  };
}

function makeMegaCommitLines(
  hash: string,
  fileCount: number,
  prefix = "src/file",
): string[] {
  const lines = [
    `COMMIT|${hash}|Mon Jan 1 00:00:00 2024 +0000|Alice`,
  ];
  for (let index = 0; index < fileCount; index += 1) {
    lines.push(`1\t1\t${prefix}${index}.ts`);
  }
  return lines;
}

describe("createGitMiner", () => {
  it("mines basic fixture into fileStats and pairCounts", async () => {
    const lines = await fixtureLines("basic.txt");
    const miner = createGitMiner({
      streamGitLog: () => streamFromLines(lines)(),
    });

    const result = await miner.mine({ repoPath: "/fixture" });

    expect(result.warnings).toEqual([]);
    expect(result.pairCounts.size).toBe(1);
    expect(result.pairCounts.get("src/a.ts|src/b.ts")).toEqual({
      fileA: "src/a.ts",
      fileB: "src/b.ts",
      coChangeCount: 1,
    });

    const aStats = result.fileStats.get("src/a.ts");
    expect(aStats?.commitCount).toBe(2);
    expect(aStats?.linesChanged).toBe(6);
    expect(aStats?.authors).toEqual(new Set(["Alice", "Bob"]));

    const bStats = result.fileStats.get("src/b.ts");
    expect(bStats?.commitCount).toBe(1);
    expect(bStats?.linesChanged).toBe(5);
  });

  it("unifies churn under final path for rename-multi fixture", async () => {
    const lines = await fixtureLines("rename-multi.txt");
    const miner = createGitMiner({
      streamGitLog: () => streamFromLines(lines)(),
    });

    const result = await miner.mine({ repoPath: "/fixture" });

    expect(result.fileStats.get("src/c.ts")?.commitCount).toBe(3);
    expect(result.fileStats.has("src/a.ts")).toBe(false);
    expect(result.fileStats.has("src/b.ts")).toBe(false);
    expect(result.warnings).not.toContainEqual(
      createRenameHistoryIncompleteWarning(
        formatUnlinkedRenameWarnings([
          { from: "src/old/foo.ts", to: "lib/foo.ts" },
        ])[0]!,
      ),
    );
  });

  it("warns on unlinked copy-paste rename and unifies churn under new path", async () => {
    const lines = await fixtureLines("rename-unlinked.txt");
    const miner = createGitMiner({
      streamGitLog: () => streamFromLines(lines)(),
    });

    const result = await miner.mine({ repoPath: "/fixture" });

    expect(result.warnings).toContainEqual(
      createRenameHistoryIncompleteWarning(
        formatUnlinkedRenameWarnings([
          { from: "src/old/foo.ts", to: "lib/foo.ts" },
        ])[0]!,
      ),
    );
    expect(result.fileStats.has("src/old/foo.ts")).toBe(false);
    expect(result.fileStats.get("lib/foo.ts")?.commitCount).toBe(1);
    expect(result.fileStats.get("lib/foo.ts")?.linesChanged).toBe(20);
  });

  it("links stem/extension unlinked renames from fixture", async () => {
    const lines = await fixtureLines("rename-unlinked-stem.txt");
    const miner = createGitMiner({
      streamGitLog: () => streamFromLines(lines)(),
    });

    const result = await miner.mine({ repoPath: "/fixture" });

    expect(result.warnings).toContainEqual(
      createRenameHistoryIncompleteWarning(
        formatUnlinkedRenameWarnings([
          { from: "src/widget.ts", to: "src/widget.tsx" },
        ])[0]!,
      ),
    );
    expect(result.fileStats.has("src/widget.ts")).toBe(false);
    expect(result.fileStats.get("src/widget.tsx")?.commitCount).toBe(1);
    expect(result.fileStats.get("src/widget.tsx")?.linesChanged).toBe(16);
  });

  it("does not link unrelated delete+add paths in same commit", async () => {
    const lines = [
      "COMMIT|aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa|Mon Jan 1 00:00:00 2024 +0000|Alice",
      "0\t5\tsrc/foo.ts",
      "5\t0\tsrc/bar.ts",
    ];
    const miner = createGitMiner({
      streamGitLog: () => streamFromLines(lines)(),
    });

    const result = await miner.mine({ repoPath: "/fixture" });

    expect(
      result.warnings.filter(
        (warning) => warning.code === "RENAME_HISTORY_INCOMPLETE",
      ),
    ).toEqual([]);
    expect(result.fileStats.get("src/foo.ts")?.commitCount).toBe(1);
    expect(result.fileStats.get("src/bar.ts")?.commitCount).toBe(1);
  });

  it("warns on since truncation from rename-since-truncation fixture", async () => {
    const lines = await fixtureLines("rename-since-truncation.txt");
    const miner = createGitMiner({
      streamGitLog: () => streamFromLines(lines)(),
    });

    const result = await miner.mine({
      repoPath: "/fixture",
      since: "12 months ago",
    });

    expect(result.warnings).toContainEqual(
      createRenameHistoryIncompleteWarning(
        formatSinceTruncationWarning("12 months ago"),
      ),
    );
    expect(result.fileStats.get("src/b.ts")?.commitCount).toBe(1);
    expect(result.fileStats.get("src/b.ts")?.linesChanged).toBe(1);
    expect(result.fileStats.has("src/a.ts")).toBe(false);
  });

  it("includes deleted file in fileStats and merge pair counts", async () => {
    const lines = await fixtureLines("merge-delete.txt");
    const miner = createGitMiner({
      streamGitLog: () => streamFromLines(lines)(),
    });

    const result = await miner.mine({ repoPath: "/fixture" });

    expect(result.pairCounts.size).toBe(1);
    expect(result.pairCounts.get("src/keep.ts|src/other.ts")).toEqual({
      fileA: "src/keep.ts",
      fileB: "src/other.ts",
      coChangeCount: 1,
    });
    expect(result.fileStats.get("src/remove.ts")?.commitCount).toBe(1);
    expect(result.fileStats.get("src/keep.ts")?.commitCount).toBe(2);
  });

  it("counts binary files without increasing linesChanged", async () => {
    const lines = await fixtureLines("binary.txt");
    const miner = createGitMiner({
      streamGitLog: () => streamFromLines(lines)(),
    });

    const result = await miner.mine({ repoPath: "/fixture" });

    expect(result.fileStats.get("assets/logo.png")?.commitCount).toBe(1);
    expect(result.fileStats.get("assets/logo.png")?.linesChanged).toBe(0);
  });

  it("returns empty results and warning for insufficient history", async () => {
    const miner = createGitMiner({
      streamGitLog: async function* () {
        // empty git log output
      },
    });

    const result = await miner.mine({
      repoPath: "/fixture",
      since: "99 years ago",
    });

    expect(result.fileStats.size).toBe(0);
    expect(result.pairCounts.size).toBe(0);
    expect(result.warnings).toContainEqual(createEmptySinceWindowWarning());
  });

  it("invokes onProgress once per parsed commit", async () => {
    const lines = await fixtureLines("basic.txt");
    const progressCalls: Array<{ phase: string; commitsProcessed: number }> =
      [];
    const miner = createGitMiner({
      streamGitLog: () => streamFromLines(lines)(),
    });

    await miner.mine({
      repoPath: "/fixture",
      onProgress: (progress) => {
        progressCalls.push(progress);
      },
    });

    expect(progressCalls).toEqual([
      { phase: "git", commitsProcessed: 1 },
      { phase: "git", commitsProcessed: 2 },
      { phase: "git", commitsProcessed: 3 },
    ]);
  });

  it("processes large-synthetic fixture without buffering entire log", async () => {
    const lines = await fixtureLines("large-synthetic.txt");
    expect(lines.length).toBeGreaterThanOrEqual(10_000);

    const miner = createGitMiner({
      streamGitLog: () => streamFromLines(lines)(),
    });

    const result = await miner.mine({ repoPath: "/fixture" });
    expect(result.pairCounts.size).toBe(0);
    expect(result.fileStats.size).toBe(50);
  });

  it("emits ambiguous-path warnings for conflicting rename chains", async () => {
    const lines = [
      "COMMIT|aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa|Mon Jan 1 00:00:00 2024 +0000|Alice",
      "a.ts => b.ts",
      "0\t0\tb.ts",
      "COMMIT|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|Tue Jan 2 00:00:00 2024 +0000|Bob",
      "b.ts => a.ts",
      "0\t0\ta.ts",
    ];
    const miner = createGitMiner({
      streamGitLog: () => streamFromLines(lines)(),
    });

    const result = await miner.mine({ repoPath: "/fixture" });

    expect(result.warnings).toEqual(
      expect.arrayContaining([
        createRenameHistoryIncompleteWarning(
          formatAmbiguousRenameWarnings(["a.ts"])[0]!,
        ),
        createRenameHistoryIncompleteWarning(
          formatAmbiguousRenameWarnings(["b.ts"])[0]!,
        ),
      ]),
    );
  });

  it("emits MEGA_COMMIT_SKIPPED warnings for mega commits", async () => {
    const lines = makeMegaCommitLines(
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      101,
    );
    const miner = createGitMiner({
      streamGitLog: () => streamFromLines(lines)(),
    });

    const result = await miner.mine({ repoPath: "/fixture" });

    expect(result.pairCounts.size).toBe(0);
    expect(result.fileStats.size).toBe(101);
    expect(result.warnings).toContainEqual(
      createScanWarning(
        MEGA_COMMIT_SKIPPED_CODE,
        "Mega-commit skipped for coupling (101 unique in-scope files > 100): bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      ),
    );
  });

  it("emits no MEGA_COMMIT_SKIPPED warnings when no commit exceeds threshold", async () => {
    const lines = makeMegaCommitLines(
      "cccccccccccccccccccccccccccccccccccccccc",
      100,
    );
    const miner = createGitMiner({
      streamGitLog: () => streamFromLines(lines)(),
    });

    const result = await miner.mine({ repoPath: "/fixture" });

    expect(result.pairCounts.size).toBe((100 * 99) / 2);
    expect(
      result.warnings.some(
        (warning) => warning.code === MEGA_COMMIT_SKIPPED_CODE,
      ),
    ).toBe(false);
  });

  it("forwards signal to streamGitLog", async () => {
    const controller = new AbortController();
    let receivedSignal: AbortSignal | undefined;

    const miner = createGitMiner({
      streamGitLog: async function* (options) {
        receivedSignal = options.signal;
        yield "COMMIT|abc|Mon Jan 1 00:00:00 2024 +0000|Alice";
      },
    });

    await miner.mine({ repoPath: "/fixture", signal: controller.signal });

    expect(receivedSignal).toBe(controller.signal);
  });

  it("uses custom megaCommitThreshold for skip boundary and warning text", async () => {
    const customThreshold = 50;
    const lines = makeMegaCommitLines(
      "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      51,
    );
    const miner = createGitMiner({
      streamGitLog: () => streamFromLines(lines)(),
    });

    const result = await miner.mine({
      repoPath: "/fixture",
      megaCommitThreshold: customThreshold,
    });

    expect(result.pairCounts.size).toBe(0);
    expect(result.fileStats.size).toBe(51);
    expect(result.warnings).toContainEqual(
      createScanWarning(
        MEGA_COMMIT_SKIPPED_CODE,
        `Mega-commit skipped for coupling (51 unique in-scope files > ${customThreshold}): eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee`,
      ),
    );
  });

  it("raises mega-commit skip boundary when threshold is increased", async () => {
    const customThreshold = 150;
    const lines = makeMegaCommitLines(
      "ffffffffffffffffffffffffffffffffffffffff",
      101,
    );
    const miner = createGitMiner({
      streamGitLog: () => streamFromLines(lines)(),
    });

    const result = await miner.mine({
      repoPath: "/fixture",
      megaCommitThreshold: customThreshold,
    });

    expect(result.pairCounts.size).toBe((101 * 100) / 2);
    expect(
      result.warnings.some(
        (warning) => warning.code === MEGA_COMMIT_SKIPPED_CODE,
      ),
    ).toBe(false);
  });

  it("applies isPathInScope before mega-guard and pair aggregation", async () => {
    const inScopeFiles = Array.from({ length: 3 }, (_, index) => `in/file${index}.ts`);
    const outOfScopeFiles = Array.from(
      { length: 150 },
      (_, index) => `out/file${index}.ts`,
    );
    const lines = [
      "COMMIT|dddddddddddddddddddddddddddddddddddddddd|Mon Jan 1 00:00:00 2024 +0000|Alice",
      ...[...outOfScopeFiles, ...inScopeFiles].map(
        (path) => `1\t1\t${path}`,
      ),
    ];
    const miner = createGitMiner({
      streamGitLog: () => streamFromLines(lines)(),
    });

    const result = await miner.mine({
      repoPath: "/fixture",
      isPathInScope: (path) => path.startsWith("in/"),
    });

    expect(result.pairCounts.size).toBe(3);
    expect(result.fileStats.size).toBe(3);
    expect(
      result.warnings.some(
        (warning) => warning.code === MEGA_COMMIT_SKIPPED_CODE,
      ),
    ).toBe(false);
  });
});
