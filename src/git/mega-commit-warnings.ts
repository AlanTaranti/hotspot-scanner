import { createScanWarning } from "../diagnostics/logger.js";
import type { ScanWarning } from "../types/index.js";
import {
  MEGA_COMMIT_UNIQUE_FILE_THRESHOLD,
  type MegaCommitSkip,
} from "./aggregate.js";

export const MEGA_COMMIT_SKIPPED_CODE = "MEGA_COMMIT_SKIPPED";

const DEFAULT_MAX_DETAIL_WARNINGS = 5;

export function formatMegaCommitSkipDetailWarning(
  skip: MegaCommitSkip,
  threshold: number = MEGA_COMMIT_UNIQUE_FILE_THRESHOLD,
): string {
  return `Mega-commit skipped for coupling (${skip.uniqueFileCount} unique in-scope files > ${threshold}): ${skip.hash}`;
}

export function formatMegaCommitSkipSummaryWarning(
  totalSkipped: number,
  threshold: number = MEGA_COMMIT_UNIQUE_FILE_THRESHOLD,
): string {
  return `Mega-commit coupling skips: ${totalSkipped} commit(s) exceeded ${threshold} unique in-scope files`;
}

export function createMegaCommitSkippedWarnings(
  skips: MegaCommitSkip[],
  options?: { maxDetail?: number; megaCommitThreshold?: number },
): ScanWarning[] {
  const maxDetail = options?.maxDetail ?? DEFAULT_MAX_DETAIL_WARNINGS;
  const threshold =
    options?.megaCommitThreshold ?? MEGA_COMMIT_UNIQUE_FILE_THRESHOLD;
  if (skips.length === 0) {
    return [];
  }

  const warnings: ScanWarning[] = [];
  for (const skip of skips.slice(0, maxDetail)) {
    warnings.push(
      createScanWarning(
        MEGA_COMMIT_SKIPPED_CODE,
        formatMegaCommitSkipDetailWarning(skip, threshold),
      ),
    );
  }

  const remaining = skips.length - Math.min(skips.length, maxDetail);
  if (remaining > 0) {
    warnings.push(
      createScanWarning(
        MEGA_COMMIT_SKIPPED_CODE,
        formatMegaCommitSkipSummaryWarning(skips.length, threshold),
      ),
    );
  }

  return warnings;
}
