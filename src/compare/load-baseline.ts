import { readFile } from "node:fs/promises";
import type {
  CouplingPair,
  DiagnosticSeverity,
  FunctionHotspotScore,
  HotspotScore,
  ScanGranularity,
  ScanResult,
  ScanWarning,
  StaticDependencyDirection,
} from "../types/index.js";

export class BaselineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BaselineError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidGranularity(value: unknown): value is ScanGranularity {
  return value === "file" || value === "function";
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function requireKey(
  record: Record<string, unknown>,
  key: string,
  path: string,
): unknown {
  if (!(key in record)) {
    throw new BaselineError(
      `Baseline ${path} is missing required field: ${key}`,
    );
  }
  return record[key];
}

function assertRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new BaselineError(`Baseline ${path} must be an object`);
  }
  return value;
}

function assertString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    throw new BaselineError(`Baseline ${path} must be a string`);
  }
  return value;
}

function assertNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new BaselineError(`Baseline ${path} must be a number`);
  }
  return value;
}

function assertInteger(value: unknown, path: string): number {
  if (!isInteger(value)) {
    throw new BaselineError(`Baseline ${path} must be an integer`);
  }
  return value;
}

function assertBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    throw new BaselineError(`Baseline ${path} must be a boolean`);
  }
  return value;
}

const COUPLING_RESCAN_HINT =
  " Re-scan with a current hotspot-scanner version to regenerate the baseline.";

function requireCouplingField(
  record: Record<string, unknown>,
  key: string,
  path: string,
): unknown {
  if (!(key in record)) {
    throw new BaselineError(
      `Baseline ${path} is missing required field: ${key}.${COUPLING_RESCAN_HINT}`,
    );
  }
  return record[key];
}

const STATIC_DEPENDENCY_DIRECTIONS = new Set<StaticDependencyDirection>([
  "none",
  "a-to-b",
  "b-to-a",
  "both",
]);

const DIAGNOSTIC_SEVERITIES = new Set<DiagnosticSeverity>([
  "info",
  "warning",
  "error",
]);

function assertStaticDependencyDirection(
  value: unknown,
  path: string,
): StaticDependencyDirection {
  if (
    typeof value !== "string" ||
    !STATIC_DEPENDENCY_DIRECTIONS.has(value as StaticDependencyDirection)
  ) {
    throw new BaselineError(
      `Baseline ${path} must be one of: none, a-to-b, b-to-a, both`,
    );
  }
  return value as StaticDependencyDirection;
}

function assertHotspot(item: unknown, index: number): HotspotScore {
  const path = `hotspots[${index}]`;
  const record = assertRecord(item, path);

  return {
    filePath: assertString(
      requireKey(record, "filePath", path),
      `${path}.filePath`,
    ),
    complexityNormalized: assertNumber(
      requireKey(record, "complexityNormalized", path),
      `${path}.complexityNormalized`,
    ),
    churnNormalized: assertNumber(
      requireKey(record, "churnNormalized", path),
      `${path}.churnNormalized`,
    ),
    hotspotScore: assertNumber(
      requireKey(record, "hotspotScore", path),
      `${path}.hotspotScore`,
    ),
    cyclomaticComplexity: assertNumber(
      requireKey(record, "cyclomaticComplexity", path),
      `${path}.cyclomaticComplexity`,
    ),
    functionCount: assertInteger(
      requireKey(record, "functionCount", path),
      `${path}.functionCount`,
    ),
    commitCount: assertInteger(
      requireKey(record, "commitCount", path),
      `${path}.commitCount`,
    ),
    linesChanged: assertInteger(
      requireKey(record, "linesChanged", path),
      `${path}.linesChanged`,
    ),
    authorCount: assertInteger(
      requireKey(record, "authorCount", path),
      `${path}.authorCount`,
    ),
  };
}

function assertFunctionHotspot(
  item: unknown,
  index: number,
): FunctionHotspotScore {
  const path = `functions[${index}]`;
  const record = assertRecord(item, path);

  return {
    filePath: assertString(
      requireKey(record, "filePath", path),
      `${path}.filePath`,
    ),
    functionName: assertString(
      requireKey(record, "functionName", path),
      `${path}.functionName`,
    ),
    line: assertInteger(requireKey(record, "line", path), `${path}.line`),
    complexity: assertNumber(
      requireKey(record, "complexity", path),
      `${path}.complexity`,
    ),
    complexityNormalized: assertNumber(
      requireKey(record, "complexityNormalized", path),
      `${path}.complexityNormalized`,
    ),
    churnNormalized: assertNumber(
      requireKey(record, "churnNormalized", path),
      `${path}.churnNormalized`,
    ),
    hotspotScore: assertNumber(
      requireKey(record, "hotspotScore", path),
      `${path}.hotspotScore`,
    ),
    commitCount: assertInteger(
      requireKey(record, "commitCount", path),
      `${path}.commitCount`,
    ),
    linesChanged: assertInteger(
      requireKey(record, "linesChanged", path),
      `${path}.linesChanged`,
    ),
    authorCount: assertInteger(
      requireKey(record, "authorCount", path),
      `${path}.authorCount`,
    ),
  };
}

function assertCouplingPair(item: unknown, index: number): CouplingPair {
  const path = `coupling[${index}]`;
  const record = assertRecord(item, path);

  return {
    fileA: assertString(requireKey(record, "fileA", path), `${path}.fileA`),
    fileB: assertString(requireKey(record, "fileB", path), `${path}.fileB`),
    coChangeCount: assertInteger(
      requireKey(record, "coChangeCount", path),
      `${path}.coChangeCount`,
    ),
    couplingStrength: assertNumber(
      requireKey(record, "couplingStrength", path),
      `${path}.couplingStrength`,
    ),
    hasStaticDependency: assertBoolean(
      requireCouplingField(record, "hasStaticDependency", path),
      `${path}.hasStaticDependency`,
    ),
    staticDependencyDirection: assertStaticDependencyDirection(
      requireCouplingField(record, "staticDependencyDirection", path),
      `${path}.staticDependencyDirection`,
    ),
    hasRuntimeStaticDependency: assertBoolean(
      requireCouplingField(record, "hasRuntimeStaticDependency", path),
      `${path}.hasRuntimeStaticDependency`,
    ),
    hasTypeOnlyStaticDependency: assertBoolean(
      requireCouplingField(record, "hasTypeOnlyStaticDependency", path),
      `${path}.hasTypeOnlyStaticDependency`,
    ),
    hasReExportStaticDependency: assertBoolean(
      requireCouplingField(record, "hasReExportStaticDependency", path),
      `${path}.hasReExportStaticDependency`,
    ),
  };
}

function assertHotspots(value: unknown): HotspotScore[] {
  if (!Array.isArray(value)) {
    throw new BaselineError(
      "Baseline JSON is missing required field: hotspots",
    );
  }
  return value.map((item, index) => assertHotspot(item, index));
}

function assertFunctions(value: unknown): FunctionHotspotScore[] {
  if (!Array.isArray(value)) {
    throw new BaselineError(
      "Baseline JSON is missing required field: functions",
    );
  }
  return value.map((item, index) => assertFunctionHotspot(item, index));
}

function assertCoupling(value: unknown): CouplingPair[] {
  if (!Array.isArray(value)) {
    throw new BaselineError(
      "Baseline JSON is missing required field: coupling",
    );
  }
  return value.map((item, index) => assertCouplingPair(item, index));
}

function assertScanWarning(value: unknown, index: number): ScanWarning {
  const path = `meta.warnings[${index}]`;
  const record = assertRecord(value, path);
  const severity = assertString(requireKey(record, "severity", path), `${path}.severity`);
  if (!DIAGNOSTIC_SEVERITIES.has(severity as DiagnosticSeverity)) {
    throw new BaselineError(
      `Baseline ${path}.severity must be one of: info, warning, error`,
    );
  }
  const warning: ScanWarning = {
    severity: severity as DiagnosticSeverity,
    message: assertString(requireKey(record, "message", path), `${path}.message`),
  };
  if ("code" in record) {
    warning.code = assertString(record.code, `${path}.code`);
  }
  return warning;
}

function assertWarnings(value: unknown): ScanWarning[] {
  if (!Array.isArray(value)) {
    throw new BaselineError("Baseline meta.warnings must be an array");
  }
  return value.map((item, index) => assertScanWarning(item, index));
}

export function parseScanResult(json: unknown): ScanResult {
  if (!isRecord(json)) {
    throw new BaselineError("Baseline JSON must be an object");
  }

  if (json.version !== "1.0") {
    throw new BaselineError(
      `Unsupported baseline version: ${String(json.version)}. Expected "1.0".`,
    );
  }

  if (!isRecord(json.meta)) {
    throw new BaselineError("Baseline JSON is missing required field: meta");
  }

  if (typeof json.meta.since !== "string") {
    throw new BaselineError("Baseline meta.since must be a string");
  }

  if (typeof json.meta.scannedAt !== "string") {
    throw new BaselineError("Baseline meta.scannedAt must be a string");
  }

  if (!isValidGranularity(json.meta.granularity)) {
    throw new BaselineError(
      `Invalid baseline meta.granularity: ${String(json.meta.granularity)}. Expected "file" or "function".`,
    );
  }

  return {
    version: "1.0",
    hotspots: assertHotspots(json.hotspots),
    functions: assertFunctions(json.functions),
    coupling: assertCoupling(json.coupling),
    meta: {
      since: json.meta.since,
      scannedAt: json.meta.scannedAt,
      granularity: json.meta.granularity,
      warnings: assertWarnings(json.meta.warnings),
    },
  };
}

export async function loadBaseline(filePath: string): Promise<ScanResult> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new BaselineError(`Failed to read baseline file: ${message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new BaselineError(`Failed to parse baseline JSON: ${message}`);
  }

  return parseScanResult(parsed);
}
