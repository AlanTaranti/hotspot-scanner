import { describe, expect, it } from "vitest";
import { DEFAULT_SINCE, DEFAULT_TOP } from "../scan.js";
import { DEFAULT_MIN_COCHANGE } from "../scoring/index.js";
import { mergeScanOptions } from "./merge-options.js";

describe("mergeScanOptions", () => {
  const config = {
    since: "6 months ago",
    include: ["src/**"],
    exclude: ["**/*.test.ts"],
    granularity: "function" as const,
    minCochange: 5,
    top: 10,
  };

  it("uses built-in defaults when config and cli are absent", () => {
    expect(mergeScanOptions({})).toEqual({
      since: DEFAULT_SINCE,
      include: undefined,
      exclude: undefined,
      granularity: "file",
      minCochange: DEFAULT_MIN_COCHANGE,
      top: DEFAULT_TOP,
    });
  });

  it("uses config values over defaults", () => {
    expect(mergeScanOptions({ config })).toEqual({
      since: "6 months ago",
      include: ["src/**"],
      exclude: ["**/*.test.ts"],
      granularity: "function",
      minCochange: 5,
      top: 10,
    });
  });

  it("uses cli values over config and defaults", () => {
    expect(
      mergeScanOptions({
        config,
        cli: {
          since: "1 week ago",
          include: ["lib/**"],
          exclude: ["generated/**"],
          granularity: "file",
          minCochange: 2,
          top: 50,
        },
      }),
    ).toEqual({
      since: "1 week ago",
      include: ["lib/**"],
      exclude: ["generated/**"],
      granularity: "file",
      minCochange: 2,
      top: 50,
    });
  });

  it("applies per-field precedence CLI > config > defaults", () => {
    expect(
      mergeScanOptions({
        config: { since: "config-since", top: 15 },
        cli: { top: 25 },
      }),
    ).toEqual({
      since: "config-since",
      include: undefined,
      exclude: undefined,
      granularity: "file",
      minCochange: DEFAULT_MIN_COCHANGE,
      top: 25,
    });
  });

  it("treats null config as absent", () => {
    expect(
      mergeScanOptions({
        config: null,
        cli: { since: "cli-since" },
      }),
    ).toEqual({
      since: "cli-since",
      include: undefined,
      exclude: undefined,
      granularity: "file",
      minCochange: DEFAULT_MIN_COCHANGE,
      top: DEFAULT_TOP,
    });
  });

  it("allows cli empty include array to override config include", () => {
    expect(
      mergeScanOptions({
        config: { include: ["src/**"] },
        cli: { include: [] },
      }),
    ).toEqual({
      since: DEFAULT_SINCE,
      include: [],
      exclude: undefined,
      granularity: "file",
      minCochange: DEFAULT_MIN_COCHANGE,
      top: DEFAULT_TOP,
    });
  });
});
