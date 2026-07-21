import type { ScanOptions, ScanResult } from "./types/index.js";

const DEFAULT_SINCE = "12 months ago";

export async function runScan(options: ScanOptions): Promise<ScanResult> {
  return {
    version: "1.0",
    hotspots: [],
    coupling: [],
    meta: {
      since: options.since ?? DEFAULT_SINCE,
      scannedAt: new Date().toISOString(),
    },
  };
}
