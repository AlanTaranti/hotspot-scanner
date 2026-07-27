import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ScanResult } from "../types/index.js";
import { stripAnsi } from "./color.js";
import { createReporter } from "./index.js";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures/report/sample-result.json",
);

function loadFixture(): ScanResult {
  return JSON.parse(readFileSync(fixturePath, "utf8")) as ScanResult;
}

describe("createReporter", () => {
  it("renders CSV bundle with all hotspots when top is set", () => {
    const output = createReporter().render(loadFixture(), {
      format: "csv",
      top: 1,
    });

    expect(typeof output).toBe("object");
    expect(output).toHaveProperty("hotspots.csv");
    expect(output).toHaveProperty("meta.json");
    expect(output).not.toHaveProperty("functions.csv");
    const hotspotsCsv = (output as Record<string, string>)["hotspots.csv"]!;
    expect(hotspotsCsv).toContain("1,src/hot.ts,0.8500,42");
    expect(hotspotsCsv).toContain("2,src/medium.ts,0.3000,20");
    expect(hotspotsCsv).toContain("3,src/cold.ts,0.0200,3");
  });

  it("renders JSON output with full arrays when top is set", () => {
    const output = createReporter().render(loadFixture(), {
      format: "json",
      top: 2,
    });
    const parsed = JSON.parse(output as string) as ScanResult;

    expect(parsed.hotspots).toHaveLength(3);
    expect(parsed.hotspots[0]).toMatchObject({ ncloc: 42 });
    expect(parsed).not.toHaveProperty("functions");
  });

  it("renders JSON output with full arrays when top is omitted", () => {
    const output = createReporter().render(loadFixture(), {
      format: "json",
    });
    const parsed = JSON.parse(output as string) as ScanResult;

    expect(parsed.hotspots).toHaveLength(3);
  });

  it("renders table output", () => {
    const output = createReporter().render(loadFixture(), {
      format: "table",
      top: 2,
    });

    expect(output).toContain("Top Hotspots");
    expect(output).toContain("Scan window: 6 months ago");
    expect(output).toContain("NLOC");
  });

  it("renders markdown output", () => {
    const output = createReporter().render(loadFixture(), {
      format: "markdown",
      top: 2,
    });

    expect(output).toContain("# Hotspot Scanner Report");
    expect(output).toContain("## Top Hotspots");
    expect(output).toContain("Scan window: 6 months ago");
    expect(output).toContain("| NLOC |");
  });

  it("does not throw", () => {
    expect(() =>
      createReporter().render(
        {
          version: "3.0",
          hotspots: [],
          meta: {
            since: "12 months ago",
            scannedAt: "2026-07-22T12:00:00.000Z",
            warnings: [],
          },
        },
        { format: "table" },
      ),
    ).not.toThrow();
  });

  it("defaults to triage on and color off for scan table", () => {
    const fixture = loadFixture();
    const output = createReporter().render(fixture, { format: "table" });

    expect(output).toContain("Top Hotspots");
    expect(output).toContain("Triage hints");
    expect(output).toContain("Glossary");
    expect(stripAnsi(output as string)).toBe(output);
    expect(output).toContain("src/hot.ts");
    expect(output).toContain("0.8500");
  });

  it("defaults to triage on for scan markdown", () => {
    const output = createReporter().render(loadFixture(), {
      format: "markdown",
    });

    expect(output).toContain("## Triage hints");
    expect(output).toContain("## Top Hotspots");
  });

  it("preserves ranking rows and scores with default interpretation options", () => {
    const fixture = loadFixture();
    const output = createReporter().render(fixture, {
      format: "table",
      top: 2,
    });

    const hotspotsStart = (output as string).indexOf("Top Hotspots");
    const glossaryStart = (output as string).indexOf("Glossary");
    const rankingBlock = (output as string).slice(hotspotsStart, glossaryStart);

    expect(rankingBlock).toContain("src/hot.ts");
    expect(rankingBlock).toContain("src/medium.ts");
    expect(rankingBlock).not.toContain("src/cold.ts");
    expect(rankingBlock).toContain("0.8500");
    expect(rankingBlock).toContain("0.3000");
  });

  it("always includes hotspots in JSON output", () => {
    const fixture = loadFixture();
    const output = createReporter().render(fixture, {
      format: "json",
      only: ["hotspots"],
      top: 1,
    });
    const parsed = JSON.parse(output as string) as Record<string, unknown>;

    expect(parsed.hotspots).toHaveLength(3);
    expect(parsed).not.toHaveProperty("functions");
  });

  it("always includes hotspots.csv in CSV bundle", () => {
    const output = createReporter().render(loadFixture(), {
      format: "csv",
      only: ["hotspots"],
      top: 1,
    });

    expect(output).toHaveProperty("hotspots.csv");
    expect(output).toHaveProperty("meta.json");
    expect(output).not.toHaveProperty("functions.csv");
  });

  it("suppresses triage when triageHints is false", () => {
    const output = createReporter().render(loadFixture(), {
      format: "table",
      triageHints: false,
    });

    expect(output).not.toContain("Triage hints");
    expect(output).toContain("Glossary");
  });

  it("applies color only when explicitly enabled on scan table", () => {
    const fixture = loadFixture();
    const plain = createReporter().render(fixture, { format: "table" });
    const colored = createReporter().render(fixture, {
      format: "table",
      color: true,
    });

    expect(stripAnsi(colored as string)).toBe(plain);
    expect(colored).not.toBe(plain);
  });
});
