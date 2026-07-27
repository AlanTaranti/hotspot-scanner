import Ajv2020 from "ajv/dist/2020.js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ScanResult } from "../../src/types/index.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const schemasDir = join(repoRoot, "schemas");
const fixturesDir = join(repoRoot, "tests/fixtures/report");

const SCAN_SCHEMA_ID =
  "https://vitals.dev/hotspot-scanner/schemas/scan-result.json";
const CONFIG_SCHEMA_ID =
  "https://vitals.dev/hotspot-scanner/schemas/hotspot-scanner-config.json";
const TREND_SCHEMA_ID =
  "https://vitals.dev/hotspot-scanner/schemas/complexity-trend.json";

const LOCKED_CONFIG_EXEMPLAR = {
  $schema: CONFIG_SCHEMA_ID,
  $comments: [
    "include/exclude are additive to built-in PathScope defaults.",
    "Omit concurrency to use the host default worker pool size.",
    "CLI flags override config; config overrides built-in defaults.",
  ],
  since: "12 months ago",
  include: ["src/**"],
  exclude: ["**/*.generated.ts"],
  top: 20,
} as const;

function createValidators() {
  const ajv = new Ajv2020({ allErrors: true });
  ajv.addSchema(
    JSON.parse(readFileSync(join(schemasDir, "scan-result.json"), "utf8")),
  );
  ajv.addSchema(
    JSON.parse(
      readFileSync(join(schemasDir, "hotspot-scanner-config.json"), "utf8"),
    ),
  );
  ajv.addSchema(
    JSON.parse(readFileSync(join(schemasDir, "complexity-trend.json"), "utf8")),
  );

  const validateScan = ajv.getSchema(SCAN_SCHEMA_ID);
  const validateConfig = ajv.getSchema(CONFIG_SCHEMA_ID);
  const validateTrend = ajv.getSchema(TREND_SCHEMA_ID);

  if (!validateScan || !validateConfig || !validateTrend) {
    throw new Error("Failed to compile JSON schemas");
  }

  return { validateScan, validateConfig, validateTrend, ajv };
}

function loadScanFixture(name: string): ScanResult {
  const raw = JSON.parse(
    readFileSync(join(fixturesDir, name), "utf8"),
  ) as ScanResult & { _comment?: string };
  const { _comment: _ignored, ...fixture } = raw;
  void _ignored;
  return fixture;
}

function loadSchemaFile(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(schemasDir, name), "utf8")) as Record<
    string,
    unknown
  >;
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
  const { validateScan } = createValidators();

  it("scan-result.json declares optional root $schema and meta.scannerVersion", () => {
    const schema = loadSchemaFile("scan-result.json");
    const properties = schema.properties as Record<string, unknown>;
    const scanMeta = (schema.$defs as Record<string, unknown>)
      .ScanMeta as Record<string, unknown>;
    const scanMetaProperties = scanMeta.properties as Record<string, unknown>;

    expect(properties).toHaveProperty("$schema");
    expect(scanMetaProperties).toHaveProperty("scannerVersion");
    expect(scanMeta.required).toEqual(
      expect.arrayContaining(["since", "scannedAt", "warnings"]),
    );
    expect(scanMeta.required).not.toContain("scannerVersion");
  });

  it("3.0 scan fixture validates against scan-result.json", () => {
    const json = loadScanFixture("sample-result.json");

    expect(json.version).toBe("3.0");
    expect(validateScan(json)).toBe(true);
    expect(Array.isArray(json.meta.warnings)).toBe(true);
    for (const warning of json.meta.warnings) {
      expectScanWarningShape(warning);
    }
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

  it("allows additional properties on scan JSON (schema does not forbid extras)", () => {
    const json = loadScanFixture("sample-result.json");
    const withExtra = { ...json, coupling: [] };

    expect(validateScan(withExtra)).toBe(true);
  });

  it("accepts scan JSON with meta.scannerVersion and top-level $schema", () => {
    const json = loadScanFixture("sample-result.json");
    const enriched = {
      $schema: SCAN_SCHEMA_ID,
      ...structuredClone(json),
      meta: {
        ...json.meta,
        scannerVersion: "1.0.0",
      },
    };

    expect(validateScan(enriched)).toBe(true);
  });

  it("accepts legacy scan JSON without meta.scannerVersion", () => {
    const legacy = loadScanFixture("sample-result.json");

    expect(legacy.meta.scannerVersion).toBeUndefined();
    expect(validateScan(legacy)).toBe(true);
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

  it("accepts legacy scan JSON without meta.timings", () => {
    const legacy = loadScanFixture("sample-result.json");

    expect(legacy.meta.timings).toBeUndefined();
    expect(validateScan(legacy)).toBe(true);
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
});

describe("complexity-trend.json schema", () => {
  const { validateTrend } = createValidators();

  it("validates sample trend fixture", () => {
    const json = JSON.parse(
      readFileSync(join(fixturesDir, "sample-trend-result.json"), "utf8"),
    );
    expect(validateTrend(json)).toBe(true);
  });

  it("rejects wrong kind", () => {
    const json = JSON.parse(
      readFileSync(join(fixturesDir, "sample-trend-result.json"), "utf8"),
    );
    json.kind = "scan";
    expect(validateTrend(json)).toBe(false);
  });

  it("rejects missing sparklines", () => {
    const json = JSON.parse(
      readFileSync(join(fixturesDir, "sample-trend-result.json"), "utf8"),
    );
    delete json.meta.sparklines;
    expect(validateTrend(json)).toBe(false);
  });
});

describe("hotspot-scanner-config.json schema", () => {
  const { validateConfig } = createValidators();

  it("compiles with locked $id", () => {
    const raw = JSON.parse(
      readFileSync(join(schemasDir, "hotspot-scanner-config.json"), "utf8"),
    ) as { $id?: string };

    expect(raw.$id).toBe(CONFIG_SCHEMA_ID);
    expect(validateConfig).toBeTypeOf("function");
  });

  it("accepts locked init exemplar fixture", () => {
    expect(validateConfig(LOCKED_CONFIG_EXEMPLAR)).toBe(true);
  });

  it("accepts reserved meta keys and forward-compat unknown keys", () => {
    const withMeta = {
      ...LOCKED_CONFIG_EXEMPLAR,
      $comment: "single-line hint",
      futureKey: "allowed by additionalProperties",
    };

    expect(validateConfig(withMeta)).toBe(true);
  });

  it("rejects invalid known-key types", () => {
    const invalidSince = { ...LOCKED_CONFIG_EXEMPLAR, since: 12 };
    expect(validateConfig(invalidSince)).toBe(false);
    expect(validateConfig.errors?.length).toBeGreaterThan(0);

    const invalidTop = { ...LOCKED_CONFIG_EXEMPLAR, top: "20" };
    expect(validateConfig(invalidTop)).toBe(false);
    expect(validateConfig.errors?.length).toBeGreaterThan(0);

    const invalidConcurrency = { ...LOCKED_CONFIG_EXEMPLAR, concurrency: 0 };
    expect(validateConfig(invalidConcurrency)).toBe(false);
    expect(validateConfig.errors?.length).toBeGreaterThan(0);

    const emptyIncludePattern = {
      ...LOCKED_CONFIG_EXEMPLAR,
      include: [""],
    };
    expect(validateConfig(emptyIncludePattern)).toBe(false);
    expect(validateConfig.errors?.length).toBeGreaterThan(0);
  });
});

describe("package.json schema exports", () => {
  const packageJson = JSON.parse(
    readFileSync(join(repoRoot, "package.json"), "utf8"),
  ) as {
    exports: Record<string, string | { types?: string; import?: string }>;
  };

  const schemaExportPaths = [
    "./schemas/scan-result.json",
    "./schemas/hotspot-scanner-config.json",
    "./schemas/complexity-trend.json",
  ] as const;

  it.each(schemaExportPaths)(
    "maps %s to an on-disk schema file",
    (exportPath) => {
      const target = packageJson.exports[exportPath];
      expect(target).toBe(exportPath);

      const resolved = join(repoRoot, exportPath.slice(2));
      expect(() => readFileSync(resolved, "utf8")).not.toThrow();
    },
  );

  it("preserves the main package entry export", () => {
    expect(packageJson.exports["."]).toEqual({
      types: "./dist/index.d.ts",
      import: "./dist/index.js",
    });
  });
});
