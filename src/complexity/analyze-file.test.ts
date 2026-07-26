import { describe, expect, it } from "vitest";
import { analyzeSourceFile } from "./analyze-file.js";

describe("analyzeSourceFile", () => {
  it("returns file-level NCLOC for source text", () => {
    const result = analyzeSourceFile(
      [
        "export function outer(x: number): number {",
        "  if (x > 0) {",
        "    return 1;",
        "  }",
        "  return 0;",
        "}",
      ].join("\n"),
      "test.ts",
    );

    expect(result).toEqual({
      filePath: "test.ts",
      ncloc: 6,
    });
  });

  it("returns zero NCLOC for comment-only source", () => {
    expect(
      analyzeSourceFile("// only comments\n/* block */", "comments.ts"),
    ).toEqual({
      filePath: "comments.ts",
      ncloc: 0,
    });
  });

  it("counts string literals containing // as code lines", () => {
    expect(
      analyzeSourceFile('const url = "http://example.com";', "strings.ts"),
    ).toEqual({
      filePath: "strings.ts",
      ncloc: 1,
    });
  });

  it("counts code with trailing comments", () => {
    expect(
      analyzeSourceFile("const x = 1; // trailing", "trailing.ts"),
    ).toEqual({
      filePath: "trailing.ts",
      ncloc: 1,
    });
  });
});
