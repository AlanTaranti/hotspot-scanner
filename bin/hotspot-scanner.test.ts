import { describe, expect, it } from "vitest";
import {
  CliUsageError,
  parseFormat,
  parsePositiveInteger,
} from "./hotspot-scanner.js";

describe("hotspot-scanner CLI parsing", () => {
  it("parseFormat accepts table and json", () => {
    expect(parseFormat("table")).toBe("table");
    expect(parseFormat("json")).toBe("json");
  });

  it("parseFormat rejects invalid values", () => {
    expect(() => parseFormat("xml")).toThrow(CliUsageError);
    expect(() => parseFormat("xml")).toThrow(/Invalid --format/);
  });

  it("parsePositiveInteger accepts positive integers", () => {
    expect(parsePositiveInteger("20", "--top")).toBe(20);
    expect(parsePositiveInteger("3", "--min-cochange")).toBe(3);
  });

  it("parsePositiveInteger rejects non-positive values", () => {
    expect(() => parsePositiveInteger("0", "--top")).toThrow(CliUsageError);
    expect(() => parsePositiveInteger("abc", "--top")).toThrow(
      /--top must be a positive integer/,
    );
  });
});
