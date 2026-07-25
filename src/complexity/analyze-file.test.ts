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
    expect(
      result.functions.map((fn) => fn.complexity).reduce((a, b) => a + b, 0),
    ).toBe(result.file.cyclomaticComplexity);
    const outer = result.functions.find((fn) => fn.functionName === "outer");
    const inner = result.functions.find((fn) => fn.functionName === "inner");
    expect(outer).toBeDefined();
    expect(inner).toBeDefined();
    expect(outer!.line).toBeLessThan(inner!.line);
    expect(outer!.endLine).toBeGreaterThanOrEqual(inner!.endLine);
    expect(inner!.line).toBeGreaterThanOrEqual(outer!.line);
    expect(inner!.endLine).toBeLessThanOrEqual(outer!.endLine);
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

    const byName = new Map(result.functions.map((fn) => [fn.functionName, fn]));

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

  it("collects class getters and setters with bare accessor names", () => {
    const result = analyzeSource(`
      class Example {
        get foo() {
          return 1;
        }
        set foo(value: number) {
          if (value > 0) {}
        }
      }
    `);

    const fooEntries = result.functions.filter(
      (fn) => fn.functionName === "foo",
    );
    expect(fooEntries).toHaveLength(2);
    expect(fooEntries[0]).toMatchObject({ functionName: "foo", complexity: 1 });
    expect(fooEntries[1]).toMatchObject({ functionName: "foo", complexity: 2 });
    expect(fooEntries[0]!.line).not.toBe(fooEntries[1]!.line);
  });

  it("collects abstract getters without body using empty-body policy", () => {
    const result = analyzeSource(`
      abstract class Example {
        abstract get foo(): number;
      }
    `);

    expect(result.functions).toHaveLength(1);
    expect(result.functions[0]).toMatchObject({
      functionName: "foo",
      complexity: 1,
    });
  });

  it("collects class field arrow and function initializers", () => {
    const result = analyzeSource(`
      class Example {
        arrowField = () => 1;
        fnField = function named() {
          return 2;
        };
        notAFunction = 42;
      }
    `);

    expect(result.functions).toHaveLength(2);
    expect(result.functions.map((fn) => fn.functionName).sort()).toEqual([
      "arrowField",
      "fnField",
    ]);
  });

  it("collects object-literal methods and function-valued properties", () => {
    const result = analyzeSource(`
      const handlers = {
        bar() {
          return 1;
        },
        baz: () => {
          if (true) return 2;
          return 3;
        },
      };
    `);

    expect(result.functions).toHaveLength(2);
    expect(
      result.functions.find((fn) => fn.functionName === "bar"),
    ).toMatchObject({
      functionName: "bar",
      complexity: 1,
    });
    expect(
      result.functions.find((fn) => fn.functionName === "baz"),
    ).toMatchObject({
      functionName: "baz",
      complexity: 2,
    });
  });

  it("collects nested object-literal methods recursively", () => {
    const result = analyzeSource(`
      const nested = {
        outer() {
          return {
            inner() {
              return 1;
            },
          };
        },
      };
    `);

    expect(result.functions).toHaveLength(2);
    expect(result.functions.map((fn) => fn.functionName).sort()).toEqual([
      "inner",
      "outer",
    ]);
  });

  it("collects object-literal properties with non-identifier keys", () => {
    const result = analyzeSource(`
      const handlers = {
        "string-key"() {
          return 1;
        },
        ["computed-key"]: () => 2,
      };
    `);

    expect(result.functions).toHaveLength(2);
    expect(result.functions.map((fn) => fn.functionName).sort()).toEqual([
      '"string-key"',
      '["computed-key"]',
    ]);
  });

  it("collects ClassExpression members with ClassDeclaration-equivalent kinds and names", () => {
    const result = analyzeSource(`
      const Example = class {
        constructor() {}
        method() {
          return 1;
        }
        get foo() {
          return 2;
        }
        set foo(value: number) {
          if (value > 0) {}
        }
        arrowField = () => 3;
      };
    `);

    expect(result.functions).toHaveLength(5);
    expect(result.functions.map((fn) => fn.functionName).sort()).toEqual([
      "arrowField",
      "constructor",
      "foo",
      "foo",
      "method",
    ]);
    const fooEntries = result.functions.filter((fn) => fn.functionName === "foo");
    expect(fooEntries).toHaveLength(2);
    expect(fooEntries[0]!.line).not.toBe(fooEntries[1]!.line);
  });

  it("collects object-literal get/set accessors with bare names", () => {
    const result = analyzeSource(`
      const handlers = {
        get foo() {
          return 1;
        },
        set foo(value: number) {
          if (value > 0) {}
        },
      };
    `);

    const fooEntries = result.functions.filter((fn) => fn.functionName === "foo");
    expect(fooEntries).toHaveLength(2);
    expect(fooEntries[0]).toMatchObject({ functionName: "foo", complexity: 1 });
    expect(fooEntries[1]).toMatchObject({ functionName: "foo", complexity: 2 });
    expect(fooEntries[0]!.line).not.toBe(fooEntries[1]!.line);
  });

  it("collects assignment RHS callables with naming per context.md", () => {
    const result = analyzeSource(`
      handler = function named() {
        return 1;
      };
      exports.foo = function() {
        return 2;
      };
      obj.fn = () => 3;
      obj[key] = () => 4;
    `);

    expect(result.functions).toHaveLength(4);
    expect(
      result.functions.find((fn) => fn.functionName === "handler"),
    ).toMatchObject({
      functionName: "handler",
      complexity: 1,
    });
    expect(
      result.functions.find((fn) => fn.functionName === "foo"),
    ).toMatchObject({
      functionName: "foo",
      complexity: 1,
    });
    expect(
      result.functions.find((fn) => fn.functionName === "fn"),
    ).toMatchObject({
      functionName: "fn",
      complexity: 1,
    });
    const anonymous = result.functions.find((fn) =>
      fn.functionName.startsWith("<anonymous>:L"),
    );
    expect(anonymous).toBeDefined();
    expect(anonymous?.complexity).toBe(1);
  });

  it("does not collect assignment RHS callables for compound assignment operators", () => {
    const result = analyzeSource(`
      let count = 0;
      count += () => 1;
      obj.fn ||= () => 2;
    `);

    expect(result.functions).toHaveLength(0);
  });

  it("collects call-argument callbacks and IIFEs with anonymous naming", () => {
    const result = analyzeSource(`
      export function host() {
        setTimeout(function named() {
          if (true) return;
        }, 0);
        doWork(() => {
          if (false) return 1;
          return 0;
        });
        const value = (function () {
          if (true) return 0;
          return 1;
        })();
        return value;
      }
    `);

    expect(result.functions).toHaveLength(4);
    expect(result.functions.find((fn) => fn.functionName === "host")).toMatchObject({
      functionName: "host",
      complexity: 4,
    });
    const anonymous = result.functions.filter((fn) =>
      fn.functionName.startsWith("<anonymous>:L"),
    );
    expect(anonymous).toHaveLength(3);
    expect(anonymous.map((fn) => fn.complexity).sort()).toEqual([2, 2, 2]);
    expect(result.file.cyclomaticComplexity).toBe(10);
  });

  it("does not double-collect callables already collected via initializer", () => {
    const result = analyzeSource(`
      const handlers = {
        cb: () => 1,
      };
      register(handlers.cb);
    `);

    expect(result.functions).toHaveLength(1);
    expect(result.functions[0]).toMatchObject({
      functionName: "cb",
      complexity: 1,
    });
  });

  it("skips body-less non-abstract overload stubs but keeps abstract empty-body accessors", () => {
    const result = analyzeSource(`
      function overloaded(x: string): string;
      function overloaded(x: number): number;
      function overloaded(x: string | number) {
        if (typeof x === "string") return x;
        return x;
      }

      class Example {
        method(x: string): string;
        method(x: number): number;
        method(x: string | number) {
          return String(x);
        }
      }

      abstract class AbstractExample {
        abstract get foo(): number;
      }
    `);

    expect(result.functions).toHaveLength(3);
    expect(
      result.functions.find((fn) => fn.functionName === "overloaded"),
    ).toMatchObject({
      functionName: "overloaded",
      complexity: 2,
    });
    expect(
      result.functions.find((fn) => fn.functionName === "method"),
    ).toMatchObject({
      functionName: "method",
      complexity: 1,
    });
    expect(
      result.functions.find((fn) => fn.functionName === "foo"),
    ).toMatchObject({
      functionName: "foo",
      complexity: 1,
    });
  });
});

describe("complexity fixtures (M22 constructs)", () => {
  it("locks McCabe values for getters and setters", () => {
    const result = analyzeFixture("getters-setters.ts");

    expect(result.file).toEqual({
      filePath: "getters-setters.ts",
      functionCount: 3,
      cyclomaticComplexity: 6,
    });

    const countEntries = result.functions.filter(
      (fn) => fn.functionName === "count",
    );
    expect(countEntries).toHaveLength(2);
    expect(countEntries[0]).toMatchObject({
      functionName: "count",
      line: 9,
      complexity: 1,
    });
    expect(countEntries[1]).toMatchObject({
      functionName: "count",
      line: 13,
      complexity: 2,
    });
    expect(
      result.functions.find((fn) => fn.functionName === "label"),
    ).toMatchObject({
      functionName: "label",
      line: 19,
      complexity: 3,
    });
  });

  it("locks McCabe values for class field arrows", () => {
    const result = analyzeFixture("class-field-arrows.ts");

    expect(result.file).toEqual({
      filePath: "class-field-arrows.ts",
      functionCount: 3,
      cyclomaticComplexity: 5,
    });

    expect(
      result.functions.find((fn) => fn.functionName === "simple"),
    ).toMatchObject({
      functionName: "simple",
      line: 9,
      complexity: 1,
    });
    expect(
      result.functions.find((fn) => fn.functionName === "branch"),
    ).toMatchObject({
      functionName: "branch",
      line: 10,
      complexity: 2,
    });
    expect(
      result.functions.find((fn) => fn.functionName === "fnField"),
    ).toMatchObject({
      functionName: "fnField",
      line: 14,
      complexity: 2,
    });
  });

  it("locks McCabe values for object-literal methods", () => {
    const result = analyzeFixture("object-literal-methods.ts");

    expect(result.file).toEqual({
      filePath: "object-literal-methods.ts",
      functionCount: 3,
      cyclomaticComplexity: 4,
    });

    expect(
      result.functions.find((fn) => fn.functionName === "bar"),
    ).toMatchObject({
      functionName: "bar",
      line: 9,
      complexity: 1,
    });
    expect(
      result.functions.find((fn) => fn.functionName === "baz"),
    ).toMatchObject({
      functionName: "baz",
      line: 12,
      complexity: 2,
    });
    expect(
      result.functions.find((fn) => fn.functionName === "inner"),
    ).toMatchObject({
      functionName: "inner",
      line: 17,
      complexity: 1,
    });
  });
});

describe("complexity fixtures (M29 constructs)", () => {
  it("locks McCabe values for ClassExpression members", () => {
    const result = analyzeFixture("class-expressions.ts");

    expect(result.file).toEqual({
      filePath: "class-expressions.ts",
      functionCount: 5,
      cyclomaticComplexity: 7,
    });

    expect(
      result.functions.find((fn) => fn.functionName === "constructor"),
    ).toMatchObject({
      functionName: "constructor",
      line: 11,
      complexity: 1,
    });
    expect(
      result.functions.find((fn) => fn.functionName === "method"),
    ).toMatchObject({
      functionName: "method",
      line: 12,
      complexity: 2,
    });
    const countEntries = result.functions.filter(
      (fn) => fn.functionName === "count",
    );
    expect(countEntries).toHaveLength(2);
    expect(countEntries[0]).toMatchObject({
      functionName: "count",
      line: 16,
      complexity: 1,
    });
    expect(countEntries[1]).toMatchObject({
      functionName: "count",
      line: 19,
      complexity: 2,
    });
    expect(
      result.functions.find((fn) => fn.functionName === "arrowField"),
    ).toMatchObject({
      functionName: "arrowField",
      line: 24,
      complexity: 1,
    });
  });

  it("locks McCabe values for object-literal accessors", () => {
    const result = analyzeFixture("object-literal-accessors.ts");

    expect(result.file).toEqual({
      filePath: "object-literal-accessors.ts",
      functionCount: 3,
      cyclomaticComplexity: 6,
    });

    const fooEntries = result.functions.filter(
      (fn) => fn.functionName === "foo",
    );
    expect(fooEntries).toHaveLength(2);
    expect(fooEntries[0]).toMatchObject({
      functionName: "foo",
      line: 9,
      complexity: 1,
    });
    expect(fooEntries[1]).toMatchObject({
      functionName: "foo",
      line: 12,
      complexity: 2,
    });
    expect(
      result.functions.find((fn) => fn.functionName === "label"),
    ).toMatchObject({
      functionName: "label",
      line: 17,
      complexity: 3,
    });
  });

  it("locks McCabe values for assignment RHS callables", () => {
    const result = analyzeFixture("assignment-callables.ts");

    expect(result.file).toEqual({
      filePath: "assignment-callables.ts",
      functionCount: 4,
      cyclomaticComplexity: 6,
    });

    expect(
      result.functions.find((fn) => fn.functionName === "handler"),
    ).toMatchObject({
      functionName: "handler",
      line: 9,
      complexity: 2,
    });
    expect(
      result.functions.find((fn) => fn.functionName === "foo"),
    ).toMatchObject({
      functionName: "foo",
      line: 14,
      complexity: 1,
    });
    expect(
      result.functions.find((fn) => fn.functionName === "fn"),
    ).toMatchObject({
      functionName: "fn",
      line: 18,
      complexity: 2,
    });
    expect(
      result.functions.find((fn) => fn.functionName === "<anonymous>:L20"),
    ).toMatchObject({
      functionName: "<anonymous>:L20",
      line: 20,
      complexity: 1,
    });
  });

  it("locks implementation-only McCabe for overloads (stubs excluded)", () => {
    const result = analyzeFixture("overloads.ts");

    expect(result.file).toEqual({
      filePath: "overloads.ts",
      functionCount: 3,
      cyclomaticComplexity: 4,
    });

    expect(result.functions).toHaveLength(3);
    expect(
      result.functions.find((fn) => fn.functionName === "overloaded"),
    ).toMatchObject({
      functionName: "overloaded",
      line: 11,
      complexity: 2,
    });
    expect(
      result.functions.find((fn) => fn.functionName === "method"),
    ).toMatchObject({
      functionName: "method",
      line: 19,
      complexity: 1,
    });
    expect(
      result.functions.find((fn) => fn.functionName === "foo"),
    ).toMatchObject({
      functionName: "foo",
      line: 25,
      complexity: 1,
    });
  });

  it("locks namespace and module function collection (HOTSPOT-290)", () => {
    const result = analyzeFixture("namespace-module.ts");

    expect(result.file).toEqual({
      filePath: "namespace-module.ts",
      functionCount: 3,
      cyclomaticComplexity: 5,
    });

    expect(
      result.functions.find((fn) => fn.functionName === "f"),
    ).toMatchObject({
      functionName: "f",
      line: 10,
      complexity: 2,
    });
    expect(
      result.functions.find((fn) => fn.functionName === "g"),
    ).toMatchObject({
      functionName: "g",
      line: 15,
      complexity: 1,
    });
    expect(
      result.functions.find((fn) => fn.functionName === "h"),
    ).toMatchObject({
      functionName: "h",
      line: 19,
      complexity: 2,
    });
  });
});

describe("complexity fixtures (M50 callbacks / IIFEs)", () => {
  it("locks McCabe values for call-argument callbacks and IIFEs", () => {
    const result = analyzeFixture("callbacks-iife.ts");

    expect(result.file).toEqual({
      filePath: "callbacks-iife.ts",
      functionCount: 6,
      cyclomaticComplexity: 12,
    });

    expect(
      result.functions.find((fn) => fn.functionName === "usesCallbacks"),
    ).toMatchObject({
      functionName: "usesCallbacks",
      line: 11,
      complexity: 3,
    });
    expect(
      result.functions.find((fn) => fn.functionName === "<anonymous>:L12"),
    ).toMatchObject({
      functionName: "<anonymous>:L12",
      line: 12,
      complexity: 2,
    });
    expect(
      result.functions.find((fn) => fn.functionName === "<anonymous>:L16"),
    ).toMatchObject({
      functionName: "<anonymous>:L16",
      line: 16,
      complexity: 2,
    });
    expect(
      result.functions.find((fn) => fn.functionName === "usesIife"),
    ).toMatchObject({
      functionName: "usesIife",
      line: 22,
      complexity: 2,
    });
    expect(
      result.functions.find((fn) => fn.functionName === "<anonymous>:L23"),
    ).toMatchObject({
      functionName: "<anonymous>:L23",
      line: 23,
      complexity: 2,
    });
    expect(
      result.functions.find((fn) => fn.functionName === "<anonymous>:L28"),
    ).toMatchObject({
      functionName: "<anonymous>:L28",
      line: 28,
      complexity: 1,
    });
  });
});
