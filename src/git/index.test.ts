import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createGitMiner } from "./index.js";

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

describe("createGitMiner", () => {
  it("mines basic fixture into fileStats and coChangeEvents", async () => {
    const lines = await fixtureLines("basic.txt");
    const miner = createGitMiner({
      streamGitLog: () => streamFromLines(lines)(),
    });

    const result = await miner.mine({ repoPath: "/fixture" });

    expect(result.warnings).toEqual([]);
    expect(result.coChangeEvents).toHaveLength(3);

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
  });

  it("includes deleted file in merge-delete co-change event", async () => {
    const lines = await fixtureLines("merge-delete.txt");
    const miner = createGitMiner({
      streamGitLog: () => streamFromLines(lines)(),
    });

    const result = await miner.mine({ repoPath: "/fixture" });

    const deleteEvent = result.coChangeEvents.find(
      (event) => event.commitHash === "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    );
    expect(deleteEvent?.filesChanged).toContain("src/remove.ts");
    expect(result.fileStats.get("src/remove.ts")?.commitCount).toBe(1);

    const mergeEvent = result.coChangeEvents.find(
      (event) => event.commitHash === "ffffffffffffffffffffffffffffffffffffffff",
    );
    expect(mergeEvent?.filesChanged).toEqual(["src/keep.ts", "src/other.ts"]);
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
    expect(result.coChangeEvents).toEqual([]);
    expect(result.warnings).toContain(
      "No commits found in the specified --since window.",
    );
  });

  it("processes large-synthetic fixture without buffering entire log", async () => {
    const lines = await fixtureLines("large-synthetic.txt");
    expect(lines.length).toBeGreaterThanOrEqual(10_000);

    const miner = createGitMiner({
      streamGitLog: () => streamFromLines(lines)(),
    });

    const result = await miner.mine({ repoPath: "/fixture" });
    expect(result.coChangeEvents.length).toBe(3500);
    expect(result.fileStats.size).toBe(50);
  });
});
