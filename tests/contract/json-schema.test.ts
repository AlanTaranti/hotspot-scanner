import Ajv2020 from "ajv/dist/2020.js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { CompareResult, ScanResult } from "../../src/types/index.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const schemasDir = join(repoRoot, "schemas");
const fixturesDir = join(repoRoot, "tests/fixtures/report");

const SCAN_SCHEMA_ID =
  "https://vitals.dev/hotspot-scanner/schemas/scan-result.json";
const COMPARE_SCHEMA_ID =
  "https://vitals.dev/hotspot-scanner/schemas/compare-result.json";

function createValidators() {
  const ajv = new Ajv2020({ allErrors: true });
  ajv.addSchema(
    JSON.parse(readFileSync(join(schemasDir, "scan-result.json"), "utf8")),
  );
  ajv.addSchema(
    JSON.parse(readFileSync(join(schemasDir, "compare-result.json"), "utf8")),
  );

  const validateScan = ajv.getSchema(SCAN_SCHEMA_ID);
  const validateCompare = ajv.getSchema(COMPARE_SCHEMA_ID);

  if (!validateScan || !validateCompare) {
    throw new Error("Failed to compile JSON schemas");
  }

  return { validateScan, validateCompare, ajv };
}

function loadScanFixture(name: string): ScanResult {
  const raw = JSON.parse(
    readFileSync(join(fixturesDir, name), "utf8"),
  ) as ScanResult & { _comment?: string };
  const { _comment: _ignored, ...fixture } = raw;
  void _ignored;
  return fixture;
}

function loadCompareFixture(name: string): CompareResult {
  const raw = JSON.parse(
    readFileSync(join(fixturesDir, name), "utf8"),
  ) as CompareResult & { _comment?: string };
  const { _comment: _ignored, ...fixture } = raw;
  void _ignored;
  return fixture;
}

function expectScanWarningShape(
  warning: unknown,
): asserts warning is { severity: string; message: string; code?: string } {
  expect(warning).toEqual(
    expect.objectContaining({
      severity: expect.stringMatching(/^(info|warning|error)$/),
      message: expect.any(String),
    }),
  );
}

describe("JSON schema contract", () => {
  const { validateScan, validateCompare } = createValidators();

  it("3.0 scan fixture validates against scan-result.json", () => {
    const json = loadScanFixture("sample-result.json");

    expect(json.version).toBe("3.0");
    expect(validateScan(json)).toBe(true);
    expect(Array.isArray(json.meta.warnings)).toBe(true);
    for (const warning of json.meta.warnings) {
      expectScanWarningShape(warning);
    }
  });

  it("3.0 compare fixture validates against compare-result.json", () => {
    const result = loadCompareFixture("compare-result-file.json");

    expect(result.version).toBe("3.0");
    expect(validateCompare(result)).toBe(true);
    expect(Array.isArray(result.meta.warnings)).toBe(true);
    for (const warning of result.meta.warnings) {
      expectScanWarningShape(warning);
    }
  });

  it("compare fixture with since-mismatch warning matches ScanWarning shape", () => {
    const result = loadCompareFixture("compare-result-file.json");
    const withWarning: CompareResult = {
      ...result,
      meta: {
        ...result.meta,
        warnings: [
          {
            severity: "warning",
            code: "COMPARE_SINCE_MISMATCH",
            message: "Baseline and current scans used different --since windows",
          },
        ],
      },
    };

    expect(validateCompare(withWarning)).toBe(true);
    expect(withWarning.meta.warnings).toHaveLength(1);
    expect(withWarning.meta.warnings[0]).toEqual({
      severity: "warning",
      code: "COMPARE_SINCE_MISMATCH",
      message: expect.stringMatching(/different --since windows/),
    });
  });

  it("rejects scan JSON missing meta.warnings", () => {
    const json = loadScanFixture("sample-result.json");
    const invalid = structuredClone(json);
    delete (invalid.meta as { warnings?: unknown }).warnings;

    expect(validateScan(invalid)).toBe(false);
    expect(validateScan.errors?.length).toBeGreaterThan(0);
  });

  it("rejects scan JSON with string meta.warnings entries", () => {
    const json = loadScanFixture("sample-result.json");
    const invalid = structuredClone(json);
    (invalid.meta as { warnings: unknown }).warnings = ["legacy string warning"];

    expect(validateScan(invalid)).toBe(false);
    expect(validateScan.errors?.length).toBeGreaterThan(0);
  });

  it("rejects scan JSON with invalid ScanWarning severity", () => {
    const json = loadScanFixture("sample-result.json");
    const invalid = structuredClone(json);
    invalid.meta.warnings = [
      { severity: "critical" as "warning", message: "bad severity" },
    ];

    expect(validateScan(invalid)).toBe(false);
    expect(validateScan.errors?.length).toBeGreaterThan(0);
  });

  it("rejects compare JSON with string meta.warnings entries", () => {
    const result = loadCompareFixture("compare-result-file.json");
    const invalid = structuredClone(result);
    (invalid.meta as { warnings: unknown }).warnings = ["since mismatch"];

    expect(validateCompare(invalid)).toBe(false);
    expect(validateCompare.errors?.length).toBeGreaterThan(0);
  });

  it("rejects scan JSON missing ncloc on hotspots", () => {
    const json = loadScanFixture("sample-result.json");
    const invalid = structuredClone(json);

    expect(json.hotspots.length).toBeGreaterThan(0);
    delete (invalid.hotspots[0] as { ncloc?: number }).ncloc;

    expect(validateScan(invalid)).toBe(false);
    expect(validateScan.errors?.length).toBeGreaterThan(0);
  });

  it("accepts scan JSON at version 3.0 without coupling or functions", () => {
    const json = loadScanFixture("sample-result.json");

    expect(json.version).toBe("3.0");
    expect(json).not.toHaveProperty("coupling");
    expect(json).not.toHaveProperty("functions");
    expect(validateScan(json)).toBe(true);
  });

  it("rejects scan JSON with version 2.0", () => {
    const json = loadScanFixture("sample-result.json");
    const invalid = structuredClone(json);
    (invalid as { version: string }).version = "2.0";

    expect(validateScan(invalid)).toBe(false);
    expect(validateScan.errors?.length).toBeGreaterThan(0);
  });

  it("rejects scan JSON with version 1.0", () => {
    const json = loadScanFixture("sample-result.json");
    const invalid = structuredClone(json);
    (invalid as { version: string }).version = "1.0";

    expect(validateScan(invalid)).toBe(false);
    expect(validateScan.errors?.length).toBeGreaterThan(0);
  });

  it("allows additional properties on scan JSON (coupling rejected at baseline load only)", () => {
    const json = loadScanFixture("sample-result.json");
    const withExtra = { ...json, coupling: [] };

    expect(validateScan(withExtra)).toBe(true);
  });

  it("accepts scan JSON with valid meta.timings", () => {
    const json = loadScanFixture("sample-result.json");
    const withTimings = structuredClone(json);
    withTimings.meta.timings = {
      gitMs: 120,
      complexityMs: 340,
      totalMs: 450,
    };

    expect(validateScan(withTimings)).toBe(true);
  });

  it("accepts baseline-era scan JSON without meta.timings", () => {
    const baseline = loadScanFixture("compare-baseline-file.json");

    expect(baseline.meta.timings).toBeUndefined();
    expect(validateScan(baseline)).toBe(true);
  });

  it("rejects scan JSON with invalid meta.timings", () => {
    const json = loadScanFixture("sample-result.json");

    const missingTotal = structuredClone(json);
    missingTotal.meta.timings = {
      gitMs: 10,
      complexityMs: 20,
    } as ScanResult["meta"]["timings"];
    expect(validateScan(missingTotal)).toBe(false);

    const negativeGit = structuredClone(json);
    negativeGit.meta.timings = {
      gitMs: -1,
      complexityMs: 20,
      totalMs: 30,
    };
    expect(validateScan(negativeGit)).toBe(false);

    const floatTotal = structuredClone(json);
    floatTotal.meta.timings = {
      gitMs: 10,
      complexityMs: 20,
      totalMs: 30.5,
    };
    expect(validateScan(floatTotal)).toBe(false);
  });

  it("rejects compare JSON with version 2.0", () => {
    const result = loadCompareFixture("compare-result-file.json");
    const invalid = structuredClone(result);
    (invalid as { version: string }).version = "2.0";

    expect(validateCompare(invalid)).toBe(false);
    expect(validateCompare.errors?.length).toBeGreaterThan(0);
  });

  it("allows additional properties on compare JSON (functions rejected at baseline load only)", () => {
    const result = loadCompareFixture("compare-result-file.json");
    const withFunctions = {
      ...structuredClone(result),
      functions: { new: [], removed: [], rankChanged: [] },
    };

    expect(validateCompare(withFunctions)).toBe(true);
    expect(withFunctions).toHaveProperty("functions");
  });

  it("allows additional properties on compare JSON (granularity not in 3.0 contract)", () => {
    const result = loadCompareFixture("compare-result-file.json");
    const withGranularity = {
      ...structuredClone(result),
      granularity: "file",
    };

    expect(validateCompare(withGranularity)).toBe(true);
    expect(withGranularity).toHaveProperty("granularity");
  });
});
