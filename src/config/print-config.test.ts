import { describe, expect, it } from "vitest";
import { DEFAULT_WORKER_CONCURRENCY } from "../complexity/pool.js";
import { DEFAULT_SINCE, DEFAULT_TOP } from "../scan.js";
import { mergeScanOptionsWithSources } from "./merge-options.js";
import {
  formatConfigPrintJson,
  formatConfigPrintText,
  toConfigPrintJson,
} from "./print-config.js";

describe("formatConfigPrintText", () => {
  it("prints effective values with source tags and config path", () => {
    const result = mergeScanOptionsWithSources(
      {
        config: {
          since: "6 months ago",
          include: ["src/**"],
          exclude: ["**/*.test.ts"],
          top: 10,
        },
        cli: { top: 25 },
      },
      "/repo/.hotspot-scanner.json",
    );

    expect(formatConfigPrintText(result)).toBe(
      [
        "config file: /repo/.hotspot-scanner.json",
        "since: 6 months ago (source: config)",
        'include: ["src/**"] (source: config)',
        'exclude: ["**/*.test.ts"] (source: config)',
        "top: 25 (source: cli)",
        `concurrency: ${DEFAULT_WORKER_CONCURRENCY} (source: default)`,
      ].join("\n") + "\n",
    );
  });

  it("shows none when no config file was loaded", () => {
    const result = mergeScanOptionsWithSources({}, null);

    expect(formatConfigPrintText(result)).toContain("config file: none");
    expect(formatConfigPrintText(result)).toContain(
      `since: ${DEFAULT_SINCE} (source: default)`,
    );
  });
});

describe("formatConfigPrintJson", () => {
  it("emits values, sources, and configPath with empty arrays for unset patterns", () => {
    const result = mergeScanOptionsWithSources(
      {
        config: { since: "1 year ago" },
        cli: { include: ["lib/**"] },
      },
      null,
    );

    expect(toConfigPrintJson(result)).toEqual({
      configPath: null,
      values: {
        since: "1 year ago",
        include: ["lib/**"],
        exclude: [],
        top: DEFAULT_TOP,
        concurrency: DEFAULT_WORKER_CONCURRENCY,
      },
      sources: {
        since: "config",
        include: "cli",
        exclude: "default",
        top: "default",
        concurrency: "default",
      },
    });

    const parsed = JSON.parse(formatConfigPrintJson(result));
    expect(parsed).toEqual(toConfigPrintJson(result));
  });
});
