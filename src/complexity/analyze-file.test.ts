import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { analyzeSourceFile } from "./analyze-file.js";

const fixtureDir = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../tests/fixtures/complexity",
);

function analyzeSource(source: string, filePath = "test.ts") {
  const project = new Project({
    compilerOptions: { allowJs: true },
    skipAddingFilesFromTsConfig: true,
  });
  const sourceFile = project.createSourceFile(filePath, source);
  return analyzeSourceFile(sourceFile, filePath);
}

function analyzeFixture(fileName: string) {
  const project = new Project({
    compilerOptions: { allowJs: true },
    skipAddingFilesFromTsConfig: true,
  });
  const sourceFile = project.addSourceFileAtPath(join(fixtureDir, fileName));
  return analyzeSourceFile(sourceFile, fileName);
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

    expect(result.file).toEqual({
      filePath: "test.ts",
      functionCount: 2,
      cyclomaticComplexity: 3,
    });
    expect(result.functions).toHaveLength(2);
    expect(result.functions.map((fn) => fn.complexity).reduce((a, b) => a + b, 0)).toBe(
      result.file.cyclomaticComplexity,
    );
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

    expect(result.file.functionCount).toBe(2);
    expect(result.file.cyclomaticComplexity).toBe(2);
    expect(result.functions).toHaveLength(2);
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

    expect(result.file.functionCount).toBe(2);
    expect(result.file.cyclomaticComplexity).toBe(2);
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

    expect(analyzeSourceFile(sourceFile).file.filePath).toContain("example.ts");
  });

  it("returns zero metrics for files without functions", () => {
    const result = analyzeSource(`
      export const VALUE = 42;
      export type Flag = boolean;
    `);

    expect(result.file).toEqual({
      filePath: "test.ts",
      cyclomaticComplexity: 0,
      functionCount: 0,
    });
    expect(result.functions).toEqual([]);
  });

  it("resolves function names per naming conventions", () => {
    const result = analyzeFixture("function-naming.ts");

    const byName = new Map(
      result.functions.map((fn) => [fn.functionName, fn]),
    );

    expect(byName.get("namedFunction")).toMatchObject({
      functionName: "namedFunction",
      line: 8,
      complexity: 1,
    });
    expect(byName.get("bar")).toMatchObject({
      functionName: "bar",
      line: 12,
      complexity: 1,
    });
    expect(byName.get("constructor")).toMatchObject({
      functionName: "constructor",
      line: 11,
      complexity: 1,
    });
    expect(byName.get("constArrow")).toMatchObject({
      functionName: "constArrow",
      line: 15,
      complexity: 1,
    });

    const anonymous = result.functions.find((fn) =>
      fn.functionName.startsWith("<anonymous>:L"),
    );
    expect(anonymous).toBeDefined();
    expect(anonymous?.line).toBe(17);
  });

  it("emits separate entries for each nested function", () => {
    const result = analyzeSource(`
      function outer() {
        function inner() {
          return 1;
        }
        return inner();
      }
    `);

    expect(result.functions).toHaveLength(2);
    expect(result.functions.map((fn) => fn.functionName)).toEqual([
      "outer",
      "inner",
    ]);
  });

  it("uses complexityForFunction for each entry", () => {
    const result = analyzeSource(`
      function branch(x: number) {
        if (x > 0) return 1;
        if (x < 0) return -1;
        return 0;
      }
    `);

    expect(result.functions[0]).toMatchObject({
      functionName: "branch",
      complexity: 3,
    });
  });
});
