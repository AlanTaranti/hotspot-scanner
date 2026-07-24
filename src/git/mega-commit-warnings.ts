import { createScanWarning } from "../diagnostics/logger.js";
import type { ScanWarning } from "../types/index.js";
import {
  MEGA_COMMIT_UNIQUE_FILE_THRESHOLD,
  type MegaCommitSkip,
} from "./aggregate.js";

export const MEGA_COMMIT_SKIPPED_CODE = "MEGA_COMMIT_SKIPPED";

const DEFAULT_MAX_DETAIL_WARNINGS = 5;

export function formatMegaCommitSkipDetailWarning(skip: MegaCommitSkip): string {
  return `Mega-commit skipped for coupling (${skip.uniqueFileCount} unique in-scope files > ${MEGA_COMMIT_UNIQUE_FILE_THRESHOLD}): ${skip.hash}`;
}

export function formatMegaCommitSkipSummaryWarning(totalSkipped: number): string {
  return `Mega-commit coupling skips: ${totalSkipped} commit(s) exceeded ${MEGA_COMMIT_UNIQUE_FILE_THRESHOLD} unique in-scope files`;
}

export function createMegaCommitSkippedWarnings(
  skips: MegaCommitSkip[],
  options?: { maxDetail?: number },
): ScanWarning[] {
  const maxDetail = options?.maxDetail ?? DEFAULT_MAX_DETAIL_WARNINGS;
  if (skips.length === 0) {
    return [];
  }

  const warnings: ScanWarning[] = [];
  for (const skip of skips.slice(0, maxDetail)) {
    warnings.push(
      createScanWarning(
        MEGA_COMMIT_SKIPPED_CODE,
        formatMegaCommitSkipDetailWarning(skip),
      ),
    );
  }

  const remaining = skips.length - Math.min(skips.length, maxDetail);
  if (remaining > 0) {
    warnings.push(
      createScanWarning(
        MEGA_COMMIT_SKIPPED_CODE,
        formatMegaCommitSkipSummaryWarning(skips.length),
      ),
    );
  }

  return warnings;
}
