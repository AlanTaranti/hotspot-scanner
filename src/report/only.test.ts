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
  it("accepts hotspots", () => {
    expect(parseOnlySection("hotspots")).toBe("hotspots");
  });

  it("rejects invalid values with a clear error", () => {
    expect(() => parseOnlySection("bogus")).toThrow(
      /Invalid --only: bogus\. Expected hotspots\./,
    );
    expect(() => parseOnlySection("functions")).toThrow(
      /Invalid --only: functions\. Expected hotspots\./,
    );
    expect(() => parseOnlySection("coupling")).toThrow(
      /Invalid --only: coupling\. Expected hotspots\./,
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
    expect(collectOnly("hotspots", ["hotspots"])).toEqual([
      "hotspots",
      "hotspots",
    ]);
  });

  it("rejects invalid values", () => {
    expect(() => collectOnly("foo", [])).toThrow(/Invalid --only/);
    expect(() => collectOnly("functions", [])).toThrow(/Invalid --only/);
  });
});

describe("normalizeOnly", () => {
  it("returns all sections when only is undefined", () => {
    const set = normalizeOnly(undefined);
    expect([...set]).toEqual([...ALL_REPORT_SECTIONS]);
  });

  it("returns all sections when only is empty", () => {
    const set = normalizeOnly([]);
    expect([...set]).toEqual([...ALL_REPORT_SECTIONS]);
  });

  it("returns the union of requested sections", () => {
    const set = normalizeOnly(["hotspots"]);
    expect([...set]).toEqual(["hotspots"]);
    expect(includesSection(set, "hotspots")).toBe(true);
  });

  it("dedupes repeated sections", () => {
    const collected: ReportSection[] = collectOnly(
      "hotspots",
      collectOnly("hotspots", []),
    );
    const set = normalizeOnly(collected);
    expect([...set]).toEqual(["hotspots"]);
    expect(set.size).toBe(1);
  });
});

describe("includesSection", () => {
  it("reflects membership in the normalized set", () => {
    const onlySet = normalizeOnly(["hotspots"]);
    expect(includesSection(onlySet, "hotspots")).toBe(true);
  });
});
