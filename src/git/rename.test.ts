import { describe, expect, it } from "vitest";
import { PathAliasMap } from "./rename.js";

describe("PathAliasMap", () => {
  it("returns the same path when no rename was recorded", () => {
    const map = new PathAliasMap();
    expect(map.canonical("src/a.ts")).toBe("src/a.ts");
  });

  it("resolves a single rename", () => {
    const map = new PathAliasMap();
    map.link("src/a.ts", "src/b.ts");
    expect(map.canonical("src/a.ts")).toBe("src/b.ts");
    expect(map.canonical("src/b.ts")).toBe("src/b.ts");
  });

  it("resolves multi-rename chains", () => {
    const map = new PathAliasMap();
    map.link("a.ts", "b.ts");
    map.link("b.ts", "c.ts");
    expect(map.canonical("a.ts")).toBe("c.ts");
    expect(map.canonical("b.ts")).toBe("c.ts");
    expect(map.canonical("c.ts")).toBe("c.ts");
  });

  it("reports ambiguous paths when cycles are introduced", () => {
    const map = new PathAliasMap();
    map.link("a.ts", "b.ts");
    map.link("b.ts", "a.ts");
    expect(map.getAmbiguousPaths().length).toBeGreaterThan(0);
  });
});
