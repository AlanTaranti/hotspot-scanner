import { describe, expect, it } from "vitest";
import { DEFAULT_WORKER_CONCURRENCY } from "../complexity/pool.js";
import { DEFAULT_SINCE, DEFAULT_TOP } from "../scan.js";
import { mergeScanOptions } from "./merge-options.js";

describe("mergeScanOptions", () => {
  const config = {
    since: "6 months ago",
    include: ["src/**"],
    exclude: ["**/*.test.ts"],
    granularity: "function" as const,
    top: 10,
    concurrency: 3,
  };

  it("uses built-in defaults when config and cli are absent", () => {
    expect(mergeScanOptions({})).toEqual({
      since: DEFAULT_SINCE,
      include: undefined,
      exclude: undefined,
      granularity: "file",
      top: DEFAULT_TOP,
      concurrency: DEFAULT_WORKER_CONCURRENCY,
    });
  });

  it("uses config values over defaults", () => {
    expect(mergeScanOptions({ config })).toEqual({
      since: "6 months ago",
      include: ["src/**"],
      exclude: ["**/*.test.ts"],
      granularity: "function",
      top: 10,
      concurrency: 3,
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
          top: 50,
          concurrency: 1,
        },
      }),
    ).toEqual({
      since: "1 week ago",
      include: ["lib/**"],
      exclude: ["generated/**"],
      granularity: "file",
      top: 50,
      concurrency: 1,
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
      top: 25,
      concurrency: DEFAULT_WORKER_CONCURRENCY,
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
      top: DEFAULT_TOP,
      concurrency: DEFAULT_WORKER_CONCURRENCY,
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
      top: DEFAULT_TOP,
      concurrency: DEFAULT_WORKER_CONCURRENCY,
    });
  });

  it("uses DEFAULT_WORKER_CONCURRENCY when concurrency is unset", () => {
    expect(mergeScanOptions({})).toMatchObject({
      concurrency: DEFAULT_WORKER_CONCURRENCY,
    });
  });

  it("uses config concurrency over default", () => {
    expect(mergeScanOptions({ config: { concurrency: 2 } })).toMatchObject({
      concurrency: 2,
    });
  });

  it("uses cli concurrency over config and default", () => {
    expect(
      mergeScanOptions({
        config: { concurrency: 2 },
        cli: { concurrency: 8 },
      }),
    ).toMatchObject({
      concurrency: 8,
    });
  });
});
