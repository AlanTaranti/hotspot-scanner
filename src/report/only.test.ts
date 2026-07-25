import { describe, expect, it } from "vitest";
import {
  ALL_REPORT_SECTIONS,
  collectOnly,
  includesSection,
  normalizeOnly,
  parseOnlySection,
  type ReportSection,
} from "./only.js";

describe("parseOnlySection", () => {
  it.each(["hotspots", "coupling", "functions"] as const)(
    "accepts %s",
    (value) => {
      expect(parseOnlySection(value)).toBe(value);
    },
  );

  it("rejects invalid values with a clear error", () => {
    expect(() => parseOnlySection("bogus")).toThrow(
      /Invalid --only: bogus\. Expected hotspots, coupling, or functions\./,
    );
  });

  it("rejects empty values", () => {
    expect(() => parseOnlySection("")).toThrow(
      /--only section must not be empty/,
    );
  });
});

describe("collectOnly", () => {
  it("accumulates valid sections", () => {
    expect(collectOnly("hotspots", [])).toEqual(["hotspots"]);
    expect(collectOnly("coupling", ["hotspots"])).toEqual([
      "hotspots",
      "coupling",
    ]);
  });

  it("rejects invalid values", () => {
    expect(() => collectOnly("foo", [])).toThrow(/Invalid --only/);
  });
});

describe("normalizeOnly", () => {
  it("returns all sections when only is undefined", () => {
    const set = normalizeOnly(undefined);
    expect([...set].sort()).toEqual([...ALL_REPORT_SECTIONS].sort());
  });

  it("returns all sections when only is empty", () => {
    const set = normalizeOnly([]);
    expect([...set].sort()).toEqual([...ALL_REPORT_SECTIONS].sort());
  });

  it("returns the union of requested sections", () => {
    const set = normalizeOnly(["hotspots", "coupling"]);
    expect([...set].sort()).toEqual(["coupling", "hotspots"]);
    expect(includesSection(set, "hotspots")).toBe(true);
    expect(includesSection(set, "coupling")).toBe(true);
    expect(includesSection(set, "functions")).toBe(false);
  });

  it("dedupes repeated sections", () => {
    const collected: ReportSection[] = collectOnly(
      "hotspots",
      collectOnly("hotspots", collectOnly("coupling", [])),
    );
    const set = normalizeOnly(collected);
    expect([...set].sort()).toEqual(["coupling", "hotspots"]);
    expect(set.size).toBe(2);
  });
});

describe("includesSection", () => {
  it("reflects membership in the normalized set", () => {
    const onlySet = normalizeOnly(["functions"]);
    expect(includesSection(onlySet, "functions")).toBe(true);
    expect(includesSection(onlySet, "hotspots")).toBe(false);
  });
});
