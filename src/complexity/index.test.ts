import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createComplexityAnalyzer } from "./index.js";

const fixtureDir = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../tests/fixtures/complexity",
);

function findResult(
  results: Array<{ filePath: string }>,
  fileName: string,
) {
  return results.find((result) => result.filePath.endsWith(fileName));
}

describe("createComplexityAnalyzer", () => {
  it("analyzes fixture files and returns results with warnings for invalid syntax", async () => {
    const analyzer = createComplexityAnalyzer();
    const { results, warnings } = await analyzer.analyze({ repoPath: fixtureDir });

    expect(findResult(results, "if-else.ts")).toEqual({
      filePath: "if-else.ts",
      functionCount: 1,
      cyclomaticComplexity: 3,
    });
    expect(findResult(results, "switch.ts")).toEqual({
      filePath: "switch.ts",
      functionCount: 1,
      cyclomaticComplexity: 5,
    });
    expect(findResult(results, "loops.ts")).toEqual({
      filePath: "loops.ts",
      functionCount: 1,
      cyclomaticComplexity: 4,
    });
    expect(findResult(results, "try-catch.ts")).toEqual({
      filePath: "try-catch.ts",
      functionCount: 1,
      cyclomaticComplexity: 2,
    });
    expect(findResult(results, "logical-ops.ts")).toEqual({
      filePath: "logical-ops.ts",
      functionCount: 1,
      cyclomaticComplexity: 4,
    });
    expect(findResult(results, "ternary.ts")).toEqual({
      filePath: "ternary.ts",
      functionCount: 1,
      cyclomaticComplexity: 2,
    });
    expect(findResult(results, "nested.ts")).toEqual({
      filePath: "nested.ts",
      functionCount: 2,
      cyclomaticComplexity: 3,
    });
    expect(findResult(results, "empty.ts")).toEqual({
      filePath: "empty.ts",
      functionCount: 0,
      cyclomaticComplexity: 0,
    });

    expect(findResult(results, "invalid-syntax.ts")).toBeUndefined();
    expect(warnings.some((warning) => warning.includes("invalid-syntax.ts"))).toBe(
      true,
    );
  });

  it("throws when repoPath is invalid", async () => {
    const analyzer = createComplexityAnalyzer();

    await expect(
      analyzer.analyze({ repoPath: "/path/that/does/not/exist" }),
    ).rejects.toThrow(/repoPath/);
  });
});
