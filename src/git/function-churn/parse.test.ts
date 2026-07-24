import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  aggregatePatchCommit,
  createFunctionChurnAccumulators,
  finalizeFunctionStats,
  indexFunctionsByFile,
} from "./aggregate.js";
import { functionStatsKey } from "./keys.js";
import { hunkIntersectsFunction, parsePatchLogStream } from "./parse.js";

const fixtureDir = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../tests/fixtures/git-patch",
);

async function linesFromFixture(name: string): Promise<string[]> {
  const text = await readFile(join(fixtureDir, name), "utf8");
  return text.split("\n").filter((line, index, all) => {
    if (index === all.length - 1 && line === "") {
      return false;
    }
    return true;
  });
}

async function* asyncLines(lines: string[]): AsyncGenerator<string> {
  for (const line of lines) {
    yield line;
  }
}

describe("parsePatchLogStream", () => {
  it("parses commits with hunks from fixture", async () => {
    const lines = await linesFromFixture("overlap-sample.txt");
    const commits = [];
    for await (const commit of parsePatchLogStream(asyncLines(lines))) {
      commits.push(commit);
    }

    expect(commits).toHaveLength(2);
    expect(commits[0]!.hash).toBe("aaa111");
    expect(commits[0]!.author).toBe("Alice");
    expect(commits[0]!.files[0]!.path).toBe("src/example.ts");
    expect(commits[0]!.files[0]!.hunks).toHaveLength(1);
    expect(commits[0]!.files[0]!.hunks[0]!.linesChanged).toBe(2);
  });

  it("parses standalone rename lines and empty commit separators", async () => {
    const lines = [
      "COMMIT|ddd|2024-01-01|Dev",
      "src/old.ts => src/new.ts",
      "",
      "COMMIT|eee|2024-01-02|Dev",
      "diff --git a/src/other.ts b/src/other.ts",
      "@@ -1 +1 @@",
      "-a",
      "+b",
    ];

    const commits = [];
    for await (const commit of parsePatchLogStream(asyncLines(lines))) {
      commits.push(commit);
    }

    expect(commits).toHaveLength(2);
    expect(commits[0]!.files[0]).toMatchObject({
      path: "src/new.ts",
      renameFrom: "src/old.ts",
    });
    expect(commits[1]!.files[0]!.hunks).toHaveLength(1);
  });

  it("ignores lines before the first commit header", async () => {
    const commits = [];
    for await (const commit of parsePatchLogStream(
      asyncLines(["noise", "COMMIT|fff|2024-01-01|Dev", ""]),
    )) {
      commits.push(commit);
    }
    expect(commits).toHaveLength(0);
  });
});

describe("hunkIntersectsFunction", () => {
  it("detects overlap on touched new lines", () => {
    const hunk = {
      newLinesTouched: new Set([5]),
      linesChanged: 2,
    };
    expect(hunkIntersectsFunction(hunk, 1, 10)).toBe(true);
    expect(hunkIntersectsFunction(hunk, 6, 10)).toBe(false);
  });
});

describe("aggregatePatchCommit", () => {
  it("attributes commits to overlapping functions only", async () => {
    const lines = await linesFromFixture("overlap-sample.txt");
    const commits = [];
    for await (const commit of parsePatchLogStream(asyncLines(lines))) {
      commits.push(commit);
    }

    const functions = [
      {
        filePath: "src/example.ts",
        functionName: "outer",
        line: 1,
        endLine: 10,
        complexity: 2,
      },
      {
        filePath: "src/example.ts",
        functionName: "inner",
        line: 11,
        endLine: 20,
        complexity: 1,
      },
    ];

    const functionsByFile = indexFunctionsByFile(functions);
    const accumulators = createFunctionChurnAccumulators();
    const aliasMap = new (await import("../rename.js")).PathAliasMap();

    for (const commit of commits) {
      aggregatePatchCommit(commit, functionsByFile, aliasMap, accumulators);
    }

    const stats = finalizeFunctionStats(accumulators);
    const outerKey = functionStatsKey("src/example.ts", "outer", 1);
    const innerKey = functionStatsKey("src/example.ts", "inner", 11);

    expect(stats.get(outerKey)?.commitCount).toBe(1);
    expect(stats.get(outerKey)?.authors).toEqual(new Set(["Alice"]));
    expect(stats.get(innerKey)?.commitCount).toBe(1);
    expect(stats.get(innerKey)?.authors).toEqual(new Set(["Bob"]));
  });

  it("credits nested functions when a hunk intersects both ranges", async () => {
    const lines = [
      "COMMIT|ccc333|2024-01-03T00:00:00Z|Carol",
      "diff --git a/src/nested.ts b/src/nested.ts",
      "@@ -3 +3 @@",
      "-x",
      "+y",
    ];

    const commits = [];
    for await (const commit of parsePatchLogStream(asyncLines(lines))) {
      commits.push(commit);
    }

    const functions = [
      {
        filePath: "src/nested.ts",
        functionName: "outer",
        line: 1,
        endLine: 10,
        complexity: 2,
      },
      {
        filePath: "src/nested.ts",
        functionName: "inner",
        line: 2,
        endLine: 5,
        complexity: 1,
      },
    ];

    const functionsByFile = indexFunctionsByFile(functions);
    const accumulators = createFunctionChurnAccumulators();
    const aliasMap = new (await import("../rename.js")).PathAliasMap();

    aggregatePatchCommit(commits[0]!, functionsByFile, aliasMap, accumulators);
    const stats = finalizeFunctionStats(accumulators);

    expect(
      stats.get(functionStatsKey("src/nested.ts", "outer", 1))?.commitCount,
    ).toBe(1);
    expect(
      stats.get(functionStatsKey("src/nested.ts", "inner", 2))?.commitCount,
    ).toBe(1);
  });
});
