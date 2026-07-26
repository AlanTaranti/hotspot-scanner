import { readFile } from "node:fs/promises";
import type {
  DiagnosticSeverity,
  FunctionHotspotScore,
  HotspotScore,
  ScanGranularity,
  ScanResult,
  ScanStageTimings,
  ScanWarning,
} from "../types/index.js";

const BASELINE_CONTRACT_HINT =
  "\nHint: re-scan with --format json --output <path> using the current hotspot-scanner version, or fix the baseline file to match the JSON contract.";

export class BaselineError extends Error {
  constructor(message: string) {
    const withHint =
      !message.includes("Hint:") && !message.includes("Re-scan");
    super(withHint ? `${message}${BASELINE_CONTRACT_HINT}` : message);
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

const DIAGNOSTIC_SEVERITIES = new Set<DiagnosticSeverity>([
  "info",
  "warning",
  "error",
]);

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
    parseFailed: assertBoolean(
      requireKey(record, "parseFailed", path),
      `${path}.parseFailed`,
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

function assertNonNegativeInteger(value: unknown, path: string): number {
  const integer = assertInteger(value, path);
  if (integer < 0) {
    throw new BaselineError(`Baseline ${path} must be a non-negative integer`);
  }
  return integer;
}

function assertScanStageTimings(value: unknown): ScanStageTimings {
  const path = "meta.timings";
  const record = assertRecord(value, path);

  const timings: ScanStageTimings = {
    gitMs: assertNonNegativeInteger(
      requireKey(record, "gitMs", path),
      `${path}.gitMs`,
    ),
    complexityMs: assertNonNegativeInteger(
      requireKey(record, "complexityMs", path),
      `${path}.complexityMs`,
    ),
    totalMs: assertNonNegativeInteger(
      requireKey(record, "totalMs", path),
      `${path}.totalMs`,
    ),
  };

  if ("functionChurnMs" in record) {
    timings.functionChurnMs = assertNonNegativeInteger(
      record.functionChurnMs,
      `${path}.functionChurnMs`,
    );
  }

  return timings;
}

export function parseScanResult(json: unknown): ScanResult {
  if (!isRecord(json)) {
    throw new BaselineError("Baseline JSON must be an object");
  }

  if ("coupling" in json) {
    throw new BaselineError(
      'Baseline JSON contains unsupported field "coupling". Re-scan with a current hotspot-scanner version.',
    );
  }

  if (json.version === "1.0") {
    throw new BaselineError(
      'Unsupported baseline version: "1.0". Expected "2.0". Re-scan with a current hotspot-scanner version.',
    );
  }

  if (json.version !== "2.0") {
    throw new BaselineError(
      `Unsupported baseline version: ${String(json.version)}. Expected "2.0".`,
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
    version: "2.0",
    hotspots: assertHotspots(json.hotspots),
    functions: assertFunctions(json.functions),
    meta: {
      since: json.meta.since,
      scannedAt: json.meta.scannedAt,
      granularity: json.meta.granularity,
      warnings: assertWarnings(json.meta.warnings),
      ...(json.meta.timings !== undefined
        ? { timings: assertScanStageTimings(json.meta.timings) }
        : {}),
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
