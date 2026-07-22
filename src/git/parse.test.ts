import { describe, expect, it } from "vitest";
import { parseGitLogStream, type ParsedCommit } from "./parse.js";

async function parseLines(lines: string[]): Promise<ParsedCommit[]> {
  async function* source() {
    for (const line of lines) {
      yield line;
    }
  }
  const commits: ParsedCommit[] = [];
  for await (const commit of parseGitLogStream(source())) {
    commits.push(commit);
  }
  return commits;
}

describe("parseGitLogStream", () => {
  it("parses commit header into hash, date, and author", async () => {
    const commits = await parseLines([
      "COMMIT|abc123def456|Mon Jan 1 00:00:00 2024 +0000|Alice",
      "3\t1\tsrc/a.ts",
      "",
    ]);

    expect(commits).toHaveLength(1);
    expect(commits[0]!.hash).toBe("abc123def456");
    expect(commits[0]!.author).toBe("Alice");
    expect(commits[0]!.date).toEqual(new Date("Mon Jan 1 00:00:00 2024 +0000"));
  });

  it("parses numstat with tab separation", async () => {
    const commits = await parseLines([
      "COMMIT|abc|Mon Jan 1 00:00:00 2024 +0000|Alice",
      "10\t5\tsrc/file.ts",
      "",
    ]);

    expect(commits[0]!.files[0]).toEqual({
      path: "src/file.ts",
      additions: 10,
      deletions: 5,
    });
  });

  it("treats binary numstat as null additions and deletions", async () => {
    const commits = await parseLines([
      "COMMIT|abc|Mon Jan 1 00:00:00 2024 +0000|Alice",
      "-\t-\tassets/logo.png",
      "",
    ]);

    expect(commits[0]!.files[0]).toEqual({
      path: "assets/logo.png",
      additions: null,
      deletions: null,
    });
  });

  it("associates rename metadata with subsequent numstat", async () => {
    const commits = await parseLines([
      "COMMIT|abc|Mon Jan 1 00:00:00 2024 +0000|Alice",
      "src/old.ts => src/new.ts",
      "2\t1\tsrc/new.ts",
      "",
    ]);

    expect(commits[0]!.files[0]).toEqual({
      path: "src/new.ts",
      additions: 2,
      deletions: 1,
      renameFrom: "src/old.ts",
    });
  });

  it("parses rename-only commits without numstat", async () => {
    const commits = await parseLines([
      "COMMIT|abc|Mon Jan 1 00:00:00 2024 +0000|Alice",
      "src/old.ts => src/new.ts",
      "",
    ]);

    expect(commits[0]!.files[0]).toEqual({
      path: "src/new.ts",
      additions: null,
      deletions: null,
      renameFrom: "src/old.ts",
    });
  });

  it("yields multiple commits from one stream", async () => {
    const commits = await parseLines([
      "COMMIT|aaa|Mon Jan 1 00:00:00 2024 +0000|Alice",
      "1\t0\ta.ts",
      "",
      "COMMIT|bbb|Tue Jan 2 00:00:00 2024 +0000|Bob",
      "0\t1\tb.ts",
      "",
    ]);

    expect(commits).toHaveLength(2);
    expect(commits.map((c) => c.hash)).toEqual(["aaa", "bbb"]);
  });

  it("handles paths with spaces via tab-separated numstat", async () => {
    const commits = await parseLines([
      "COMMIT|abc|Mon Jan 1 00:00:00 2024 +0000|Alice",
      "1\t1\tpath with spaces/file.ts",
      "",
    ]);

    expect(commits[0]!.files[0]!.path).toBe("path with spaces/file.ts");
  });
});
