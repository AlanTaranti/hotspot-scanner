import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { complexityForFunction, countDecisionNodes } from "./mccabe.js";

function analyzeFunction(source: string): number {
  const project = new Project({
    compilerOptions: { allowJs: true },
    skipAddingFilesFromTsConfig: true,
  });
  const sourceFile = project.createSourceFile("test.ts", source);
  const fn = sourceFile.getFunctions()[0];
  if (!fn) {
    throw new Error("Expected a function in test source");
  }
  return complexityForFunction(fn);
}

describe("countDecisionNodes", () => {
  it("counts if and else if branches", () => {
    const complexity = analyzeFunction(`
      function check(x: number) {
        if (x < 0) {
          return -1;
        } else if (x === 0) {
          return 0;
        }
        return 1;
      }
    `);

    expect(complexity).toBe(3);
  });

  it("counts loops", () => {
    const complexity = analyzeFunction(`
      function run() {
        for (let i = 0; i < 1; i++) {}
        while (false) {}
        do {} while (false);
      }
    `);

    expect(complexity).toBe(4);
  });

  it("counts switch cases per clause", () => {
    const complexity = analyzeFunction(`
      function label(n: number) {
        switch (n) {
          case 1:
            return "one";
          case 2:
            return "two";
          default:
            return "other";
        }
      }
    `);

    expect(complexity).toBe(4);
  });

  it("counts catch clauses", () => {
    const complexity = analyzeFunction(`
      function safe() {
        try {
          return 1;
        } catch {
          return 0;
        }
      }
    `);

    expect(complexity).toBe(2);
  });

  it("counts logical operators in conditions", () => {
    const complexity = analyzeFunction(`
      function check(a: boolean, b: boolean, c: unknown) {
        return (a && b) || (c ?? false);
      }
    `);

    expect(complexity).toBe(4);
  });

  it("counts ternary expressions", () => {
    const complexity = analyzeFunction(`
      function pick(x: boolean) {
        return x ? 1 : 0;
      }
    `);

    expect(complexity).toBe(2);
  });

  it("returns base complexity for branchless functions", () => {
    const complexity = analyzeFunction(`
      function noop() {
        return 1;
      }
    `);

    expect(complexity).toBe(1);
  });
});

describe("complexityForFunction", () => {
  it("adds one to decision node count", () => {
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
    });
    const sourceFile = project.createSourceFile(
      "test.ts",
      "function f() { if (true) return 1; }",
    );
    const fn = sourceFile.getFunctions()[0]!;

    expect(countDecisionNodes(fn.getBody()!)).toBe(1);
    expect(complexityForFunction(fn)).toBe(2);
  });
});
