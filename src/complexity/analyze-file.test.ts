import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { analyzeSourceFile } from "./analyze-file.js";

function analyzeSource(source: string): ReturnType<typeof analyzeSourceFile> {
  const project = new Project({
    compilerOptions: { allowJs: true },
    skipAddingFilesFromTsConfig: true,
  });
  const sourceFile = project.createSourceFile("test.ts", source);
  return analyzeSourceFile(sourceFile, "test.ts");
}

describe("analyzeSourceFile", () => {
  it("sums per-function complexity and counts nested functions", () => {
    const result = analyzeSource(`
      export function outer(x: number): number {
        if (x > 0) {
          function inner(): number {
            return 1;
          }
          return inner();
        }
        return 0;
      }
    `);

    expect(result).toEqual({
      filePath: "test.ts",
      functionCount: 2,
      cyclomaticComplexity: 3,
    });
  });

  it("counts class methods and assigned arrow functions", () => {
    const result = analyzeSource(`
      const arrow = () => 1;

      class Example {
        method() {
          return 2;
        }
      }
    `);

    expect(result.functionCount).toBe(2);
    expect(result.cyclomaticComplexity).toBe(2);
  });

  it("counts constructors and function expressions", () => {
    const result = analyzeSource(`
      export class Example {
        constructor() {}
      }

      const fn = function named() {
        return 1;
      };
    `);

    expect(result.functionCount).toBe(2);
    expect(result.cyclomaticComplexity).toBe(2);
  });

  it("uses the source file path when filePath is omitted", () => {
    const project = new Project({
      compilerOptions: { allowJs: true },
      skipAddingFilesFromTsConfig: true,
    });
    const sourceFile = project.createSourceFile(
      "/tmp/custom-path/example.ts",
      "export function demo() {}",
    );

    expect(analyzeSourceFile(sourceFile).filePath).toContain("example.ts");
  });

  it("returns zero metrics for files without functions", () => {
    const result = analyzeSource(`
      export const VALUE = 42;
      export type Flag = boolean;
    `);

    expect(result).toEqual({
      filePath: "test.ts",
      cyclomaticComplexity: 0,
      functionCount: 0,
    });
  });
});
