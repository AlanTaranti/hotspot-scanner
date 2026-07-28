import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ASSESS_RESULT_KIND,
  ASSESS_RESULT_VERSION,
  type AssessResult,
} from "../assess/types.js";
import { HOTSPOT_ASSESS_SCHEMA_URL } from "./schema-urls.js";
import { renderAssessJson } from "./assess-json.js";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures/report/sample-assess-result.json",
);

function loadFixture(): AssessResult {
  return JSON.parse(readFileSync(fixturePath, "utf8")) as AssessResult;
}

describe("renderAssessJson", () => {
  const fixture = loadFixture();

  it("emits pretty JSON with locked kind and version", () => {
    const output = renderAssessJson(fixture);
    const parsed = JSON.parse(output) as Record<string, unknown>;

    expect(output.endsWith("\n")).toBe(true);
    expect(output).toContain("\n  ");
    expect(parsed.$schema).toBe(HOTSPOT_ASSESS_SCHEMA_URL);
    expect(parsed.kind).toBe(ASSESS_RESULT_KIND);
    expect(parsed.version).toBe(ASSESS_RESULT_VERSION);
  });

  it("serializes the full candidate list without points", () => {
    const output = renderAssessJson(fixture);
    const parsed = JSON.parse(output) as AssessResult;

    expect(parsed.candidates).toHaveLength(fixture.candidates.length);
    expect(parsed.candidates.map((candidate) => candidate.filePath)).toEqual(
      fixture.candidates.map((candidate) => candidate.filePath),
    );

    for (const candidate of parsed.candidates) {
      expect(candidate).not.toHaveProperty("points");
    }
    expect(output).not.toContain('"points"');
  });

  it("preserves meta tallies from input", () => {
    const output = renderAssessJson(fixture);
    const parsed = JSON.parse(output) as AssessResult;

    expect(parsed.meta.candidateCount).toBe(fixture.meta.candidateCount);
    expect(parsed.meta.patternCounts).toEqual(fixture.meta.patternCounts);
    expect(parsed.meta.skippedCount).toBe(fixture.meta.skippedCount);
  });
});
