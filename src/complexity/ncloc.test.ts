import { describe, expect, it } from "vitest";
import { countNcloc } from "./ncloc.js";

describe("countNcloc", () => {
  it("returns 0 for blank source", () => {
    expect(countNcloc("")).toBe(0);
    expect(countNcloc("\n\n")).toBe(0);
    expect(countNcloc("   \n\t\r\n  ")).toBe(0);
  });

  it("excludes line comments", () => {
    expect(countNcloc("// only a comment")).toBe(0);
    expect(countNcloc("// first\n// second")).toBe(0);
  });

  it("excludes block and JSDoc comments", () => {
    expect(countNcloc("/* block only */")).toBe(0);
    expect(countNcloc("/** JSDoc\n * line\n */")).toBe(0);
    expect(countNcloc("/* a */\n/* b */")).toBe(0);
  });

  it("counts lines with // inside strings as code", () => {
    expect(countNcloc('const url = "http://example.com";')).toBe(1);
    expect(countNcloc("const msg = 'say // hello';")).toBe(1);
    expect(countNcloc("const tpl = `path // segment`;")).toBe(1);
  });

  it("counts code with trailing line comments", () => {
    expect(countNcloc("const x = 1; // trailing")).toBe(1);
    expect(countNcloc("doWork(); // note\nconst y = 2;")).toBe(2);
  });

  it("counts code before block comments on the same line", () => {
    expect(countNcloc("const x = 1; /* tail */")).toBe(1);
  });

  it("excludes comment-only lines mixed with code", () => {
    const source = ["const x = 1;", "// comment", "const y = 2;"].join("\n");
    expect(countNcloc(source)).toBe(2);
  });

  it("counts template literal expressions", () => {
    expect(countNcloc("const x = `value ${1 + 2}`;")).toBe(1);
    expect(countNcloc(["const x = `line1", "line2 ${name}`;"].join("\n"))).toBe(
      2,
    );
  });
});
