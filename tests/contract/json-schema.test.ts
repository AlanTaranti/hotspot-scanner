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

describe("JSON schema contract", () => {
  const { validateScan, validateCompare } = createValidators();

  it("runScan output validates against scan-result.json", async () => {
    const result = await runScan({ repoPath: smallTsFixture });
    const json = JSON.parse(renderJson(result)) as ScanResult;

    expect(validateScan(json)).toBe(true);
  });

  it("compareScanResults output validates against compare-result.json", () => {
    const baseline = loadScanFixture("compare-baseline-file.json");
    const current = loadScanFixture("compare-current-file.json");
    const result = compareScanResults(baseline, current);

    expect(validateCompare(result)).toBe(true);
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
});
