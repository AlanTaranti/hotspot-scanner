import Ajv2020 from "ajv/dist/2020.js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compareScanResults } from "../../src/compare/compare.js";
import { renderJson } from "../../src/report/json.js";
import type { ScanResult } from "../../src/types/index.js";
import { runScan } from "#scan";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const schemasDir = join(repoRoot, "schemas");
const fixturesDir = join(repoRoot, "tests/fixtures/report");
const smallTsFixture = join(repoRoot, "tests/fixtures/repos/small-ts");

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

  it("runScan output validates against scan-result.json", async () => {
    const result = await runScan({ repoPath: smallTsFixture });
    const json = JSON.parse(renderJson(result)) as ScanResult;

    expect(validateScan(json)).toBe(true);
    expect(Array.isArray(json.meta.warnings)).toBe(true);
    for (const warning of json.meta.warnings) {
      expectScanWarningShape(warning);
    }
  });

  it("compareScanResults output validates against compare-result.json", () => {
    const baseline = loadScanFixture("compare-baseline-file.json");
    const current = loadScanFixture("compare-current-file.json");
    const result = compareScanResults(baseline, current);

    expect(validateCompare(result)).toBe(true);
    expect(Array.isArray(result.meta.warnings)).toBe(true);
    for (const warning of result.meta.warnings) {
      expectScanWarningShape(warning);
    }
  });

  it("compare since-mismatch warning matches ScanWarning shape", () => {
    const baseline = loadScanFixture("compare-baseline-file.json");
    const current = loadScanFixture("compare-current-file.json");
    const currentDifferentSince: ScanResult = {
      ...current,
      meta: { ...current.meta, since: "12 months ago" },
    };

    const result = compareScanResults(baseline, currentDifferentSince);

    expect(validateCompare(result)).toBe(true);
    expect(result.meta.warnings).toHaveLength(1);
    expect(result.meta.warnings[0]).toEqual({
      severity: "warning",
      code: "COMPARE_SINCE_MISMATCH",
      message: expect.stringMatching(/different --since windows/),
    });
  });

  it("rejects scan JSON missing meta.warnings", async () => {
    const result = await runScan({ repoPath: smallTsFixture });
    const json = JSON.parse(renderJson(result)) as ScanResult;
    const invalid = structuredClone(json);
    delete (invalid.meta as { warnings?: unknown }).warnings;

    expect(validateScan(invalid)).toBe(false);
    expect(validateScan.errors?.length).toBeGreaterThan(0);
  });

  it("rejects scan JSON with string meta.warnings entries", async () => {
    const result = await runScan({ repoPath: smallTsFixture });
    const json = JSON.parse(renderJson(result)) as ScanResult;
    const invalid = structuredClone(json);
    (invalid.meta as { warnings: unknown }).warnings = ["legacy string warning"];

    expect(validateScan(invalid)).toBe(false);
    expect(validateScan.errors?.length).toBeGreaterThan(0);
  });

  it("rejects scan JSON with invalid ScanWarning severity", async () => {
    const result = await runScan({ repoPath: smallTsFixture });
    const json = JSON.parse(renderJson(result)) as ScanResult;
    const invalid = structuredClone(json);
    invalid.meta.warnings = [
      { severity: "critical" as "warning", message: "bad severity" },
    ];

    expect(validateScan(invalid)).toBe(false);
    expect(validateScan.errors?.length).toBeGreaterThan(0);
  });

  it("rejects compare JSON with string meta.warnings entries", () => {
    const baseline = loadScanFixture("compare-baseline-file.json");
    const current = loadScanFixture("compare-current-file.json");
    const result = compareScanResults(baseline, current);
    const invalid = structuredClone(result);
    (invalid.meta as { warnings: unknown }).warnings = ["since mismatch"];

    expect(validateCompare(invalid)).toBe(false);
    expect(validateCompare.errors?.length).toBeGreaterThan(0);
  });

  it("rejects scan JSON missing parseFailed on hotspots", async () => {
    const result = await runScan({ repoPath: smallTsFixture });
    const json = JSON.parse(renderJson(result)) as ScanResult;
    const invalid = structuredClone(json);

    expect(json.hotspots.length).toBeGreaterThan(0);
    delete (invalid.hotspots[0] as { parseFailed?: boolean }).parseFailed;

    expect(validateScan(invalid)).toBe(false);
    expect(validateScan.errors?.length).toBeGreaterThan(0);
  });

  it("rejects scan JSON missing a required coupling field", async () => {
    const result = await runScan({ repoPath: smallTsFixture });
    const json = JSON.parse(renderJson(result)) as ScanResult;

    expect(json.coupling.length).toBeGreaterThan(0);
    const invalid = structuredClone(json);
    const firstPair = invalid.coupling[0]!;
    delete (firstPair as { hasStaticDependency?: boolean }).hasStaticDependency;

    expect(validateScan(invalid)).toBe(false);
    expect(validateScan.errors?.length).toBeGreaterThan(0);
  });

  it("rejects scan JSON missing coupling enrichment fields", async () => {
    const result = await runScan({ repoPath: smallTsFixture });
    const json = JSON.parse(renderJson(result)) as ScanResult;

    expect(json.coupling.length).toBeGreaterThan(0);
    const invalid = structuredClone(json);
    const firstPair = invalid.coupling[0]!;
    delete (firstPair as { staticDependencyDirection?: string })
      .staticDependencyDirection;

    expect(validateScan(invalid)).toBe(false);
    expect(validateScan.errors?.length).toBeGreaterThan(0);
  });

  it("rejects scan JSON with invalid staticDependencyDirection", async () => {
    const result = await runScan({ repoPath: smallTsFixture });
    const json = JSON.parse(renderJson(result)) as ScanResult;

    expect(json.coupling.length).toBeGreaterThan(0);
    const invalid = structuredClone(json);
    invalid.coupling[0]!.staticDependencyDirection =
      "mutual" as ScanResult["coupling"][number]["staticDependencyDirection"];

    expect(validateScan(invalid)).toBe(false);
    expect(validateScan.errors?.length).toBeGreaterThan(0);
  });

  it("accepts scan JSON with valid meta.timings", async () => {
    const result = await runScan({ repoPath: smallTsFixture });
    const json = JSON.parse(renderJson(result)) as ScanResult;
    const withTimings = structuredClone(json);
    withTimings.meta.timings = {
      gitMs: 120,
      complexityMs: 340,
      totalMs: 450,
    };

    expect(validateScan(withTimings)).toBe(true);
  });

  it("accepts scan JSON with function-mode meta.timings", async () => {
    const result = await runScan({ repoPath: smallTsFixture });
    const json = JSON.parse(renderJson(result)) as ScanResult;
    const withTimings = structuredClone(json);
    withTimings.meta.timings = {
      gitMs: 120,
      complexityMs: 340,
      functionChurnMs: 80,
      totalMs: 450,
    };

    expect(validateScan(withTimings)).toBe(true);
  });

  it("accepts baseline-era scan JSON without meta.timings", () => {
    const baseline = loadScanFixture("compare-baseline-file.json");

    expect(baseline.meta.timings).toBeUndefined();
    expect(validateScan(baseline)).toBe(true);
  });

  it("rejects scan JSON with invalid meta.timings", async () => {
    const result = await runScan({ repoPath: smallTsFixture });
    const json = JSON.parse(renderJson(result)) as ScanResult;

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
});
