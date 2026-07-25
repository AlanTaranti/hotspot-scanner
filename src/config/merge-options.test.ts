import { describe, expect, it } from "vitest";
import { DEFAULT_WORKER_CONCURRENCY } from "../complexity/pool.js";
import { MEGA_COMMIT_UNIQUE_FILE_THRESHOLD } from "../git/aggregate.js";
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
    megaCommitThreshold: 150,
    top: 10,
    concurrency: 3,
  };

  it("uses built-in defaults when config and cli are absent", () => {
    expect(mergeScanOptions({})).toEqual({
      since: DEFAULT_SINCE,
      include: undefined,
      exclude: undefined,
      granularity: "file",
      minCochange: DEFAULT_MIN_COCHANGE,
      megaCommitThreshold: MEGA_COMMIT_UNIQUE_FILE_THRESHOLD,
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
      minCochange: 5,
      megaCommitThreshold: 150,
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
          minCochange: 2,
          megaCommitThreshold: 50,
          top: 50,
          concurrency: 1,
        },
      }),
    ).toEqual({
      since: "1 week ago",
      include: ["lib/**"],
      exclude: ["generated/**"],
      granularity: "file",
      minCochange: 2,
      megaCommitThreshold: 50,
      top: 50,
      concurrency: 1,
    });
  });

  it("applies per-field precedence CLI > config > defaults", () => {
    expect(
      mergeScanOptions({
        config: { since: "config-since", top: 15, megaCommitThreshold: 80 },
        cli: { top: 25, megaCommitThreshold: 120 },
      }),
    ).toEqual({
      since: "config-since",
      include: undefined,
      exclude: undefined,
      granularity: "file",
      minCochange: DEFAULT_MIN_COCHANGE,
      megaCommitThreshold: 120,
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
      minCochange: DEFAULT_MIN_COCHANGE,
      megaCommitThreshold: MEGA_COMMIT_UNIQUE_FILE_THRESHOLD,
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
      minCochange: DEFAULT_MIN_COCHANGE,
      megaCommitThreshold: MEGA_COMMIT_UNIQUE_FILE_THRESHOLD,
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

  it("uses MEGA_COMMIT_UNIQUE_FILE_THRESHOLD when megaCommitThreshold is unset", () => {
    expect(mergeScanOptions({})).toMatchObject({
      megaCommitThreshold: MEGA_COMMIT_UNIQUE_FILE_THRESHOLD,
    });
  });

  it("uses config megaCommitThreshold over default", () => {
    expect(mergeScanOptions({ config: { megaCommitThreshold: 75 } })).toMatchObject(
      {
        megaCommitThreshold: 75,
      },
    );
  });

  it("uses cli megaCommitThreshold over config and default", () => {
    expect(
      mergeScanOptions({
        config: { megaCommitThreshold: 75 },
        cli: { megaCommitThreshold: 25 },
      }),
    ).toMatchObject({
      megaCommitThreshold: 25,
    });
  });
});
