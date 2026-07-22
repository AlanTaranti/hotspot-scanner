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

  it("ignores self-links", () => {
    const map = new PathAliasMap();
    map.link("same.ts", "same.ts");
    expect(map.canonical("same.ts")).toBe("same.ts");
    expect(map.getAmbiguousPaths()).toEqual([]);
  });

  it("marks paths ambiguous when reverse rename collides on canonical path", () => {
    const map = new PathAliasMap();
    map.link("a.ts", "b.ts");
    map.link("b.ts", "a.ts");
    expect(map.getAmbiguousPaths().sort()).toEqual(["a.ts", "b.ts"]);
  });

  it("wouldCreateCycle detects a loop in the parent graph", () => {
    const map = new PathAliasMap();
    map.link("b.ts", "c.ts");

    const wouldCreateCycle = (
      map as unknown as { wouldCreateCycle: (from: string, to: string) => boolean }
    ).wouldCreateCycle;

    expect(wouldCreateCycle.call(map, "c.ts", "b.ts")).toBe(true);
  });

  it("wouldCreateCycle detects revisiting a node while walking parents", () => {
    const map = new PathAliasMap();
    const parent = (map as unknown as { parent: Map<string, string> }).parent;
    parent.set("b.ts", "c.ts");
    parent.set("c.ts", "b.ts");

    const wouldCreateCycle = (
      map as unknown as { wouldCreateCycle: (from: string, to: string) => boolean }
    ).wouldCreateCycle;

    expect(wouldCreateCycle.call(map, "d.ts", "c.ts")).toBe(true);
  });

  it("canonical marks ambiguous paths when alias graph cycles", () => {
    const map = new PathAliasMap();
    const parent = (map as unknown as { parent: Map<string, string> }).parent;
    parent.set("c.ts", "d.ts");
    parent.set("d.ts", "c.ts");

    expect(map.canonical("d.ts")).toBe("d.ts");
    expect(map.getAmbiguousPaths()).toContain("d.ts");
  });

  it("marks ambiguous when link would create a cycle", () => {
    const map = new PathAliasMap();
    map.link("b.ts", "c.ts");
    map.link("c.ts", "d.ts");
    map.link("d.ts", "b.ts");

    expect(map.getAmbiguousPaths()).toEqual(
      expect.arrayContaining(["b.ts", "d.ts"]),
    );
  });

  it("detects rename cycles and marks ambiguous paths", () => {
    const map = new PathAliasMap();
    map.link("a.ts", "b.ts");
    map.link("b.ts", "c.ts");
    map.link("c.ts", "d.ts");
    map.link("d.ts", "c.ts");

    expect(map.canonical("b.ts")).toBe("d.ts");
    expect(map.canonical("d.ts")).toBe("d.ts");
    expect(map.getAmbiguousPaths()).toEqual(
      expect.arrayContaining(["c.ts", "d.ts"]),
    );
  });
});
