import type { ScanResult } from "../types/index.js";

export interface ReporterOptions {
  format: "table" | "json";
  top?: number;
}

export interface Reporter {
  render(result: ScanResult, options: ReporterOptions): string;
}

export function createReporter(): Reporter {
  throw new Error("Reporter not implemented — see Milestone 5");
}
