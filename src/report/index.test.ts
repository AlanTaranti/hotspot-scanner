import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ScanResult } from "../types/index.js";
import { createReporter } from "./index.js";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures/report/sample-result.json",
);

function loadFixture(): ScanResult {
  return JSON.parse(readFileSync(fixturePath, "utf8")) as ScanResult;
}

describe("createReporter", () => {
  it("renders JSON output", () => {
    const output = createReporter().render(loadFixture(), {
      format: "json",
      top: 2,
    });
    const parsed = JSON.parse(output) as ScanResult;

    expect(parsed.hotspots).toHaveLength(2);
    expect(parsed.coupling).toHaveLength(2);
  });

  it("renders table output", () => {
    const output = createReporter().render(loadFixture(), {
      format: "table",
      top: 2,
    });

    expect(output).toContain("Top Hotspots");
    expect(output).toContain("Top Coupling Pairs");
    expect(output).toContain("Scan window: 6 months ago");
  });

  it("renders markdown output", () => {
    const output = createReporter().render(loadFixture(), {
      format: "markdown",
      top: 2,
    });

    expect(output).toContain("# Hotspot Scanner Report");
    expect(output).toContain("## Top Hotspots");
    expect(output).toContain("## Top Coupling Pairs");
    expect(output).toContain("**Scan window:** 6 months ago");
  });

  it("does not throw", () => {
    expect(() =>
      createReporter().render(
        {
          version: "1.0",
          hotspots: [],
          coupling: [],
          meta: {
            since: "12 months ago",
            scannedAt: "2026-07-22T12:00:00.000Z",
          },
        },
        { format: "table" },
      ),
    ).not.toThrow();
  });
});
