import { readFile } from "node:fs/promises";
import type { ScanGranularity, ScanResult } from "../types/index.js";

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

export function parseScanResult(json: unknown): ScanResult {
  if (!isRecord(json)) {
    throw new BaselineError("Baseline JSON must be an object");
  }

  if (json.version !== "1.0") {
    throw new BaselineError(
      `Unsupported baseline version: ${String(json.version)}. Expected "1.0".`,
    );
  }

  if (!Array.isArray(json.hotspots)) {
    throw new BaselineError("Baseline JSON is missing required field: hotspots");
  }

  if (!Array.isArray(json.functions)) {
    throw new BaselineError("Baseline JSON is missing required field: functions");
  }

  if (!Array.isArray(json.coupling)) {
    throw new BaselineError("Baseline JSON is missing required field: coupling");
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
    hotspots: json.hotspots as ScanResult["hotspots"],
    functions: json.functions as ScanResult["functions"],
    coupling: json.coupling as ScanResult["coupling"],
    meta: {
      since: json.meta.since,
      scannedAt: json.meta.scannedAt,
      granularity: json.meta.granularity,
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
