import type { ScanWarning } from "../types/index.js";

/** Human-readable warning line for table/markdown reporters. */
export function formatScanWarning(warning: ScanWarning): string {
  const codePart = warning.code ? ` [${warning.code}]` : "";
  return `${warning.severity}:${codePart} ${warning.message}`;
}
