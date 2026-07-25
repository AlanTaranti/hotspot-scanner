import { describe, expect, it } from "vitest";
import { createScanWarning } from "../diagnostics/logger.js";
import {
  createMegaCommitSkippedWarnings,
  formatMegaCommitSkipDetailWarning,
  formatMegaCommitSkipSummaryWarning,
  MEGA_COMMIT_SKIPPED_CODE,
} from "./mega-commit-warnings.js";

describe("formatMegaCommitSkipDetailWarning", () => {
  it("includes threshold, unique file count, and commit hash", () => {
    expect(
      formatMegaCommitSkipDetailWarning({
        hash: "abc123",
        uniqueFileCount: 101,
      }),
    ).toBe(
      "Mega-commit skipped for coupling (101 unique in-scope files > 100): abc123",
    );
  });

  it("uses custom threshold in message when provided", () => {
    expect(
      formatMegaCommitSkipDetailWarning(
        { hash: "def456", uniqueFileCount: 51 },
        50,
      ),
    ).toBe(
      "Mega-commit skipped for coupling (51 unique in-scope files > 50): def456",
    );
  });
});

describe("formatMegaCommitSkipSummaryWarning", () => {
  it("summarizes total skipped commits", () => {
    expect(formatMegaCommitSkipSummaryWarning(6)).toBe(
      "Mega-commit coupling skips: 6 commit(s) exceeded 100 unique in-scope files",
    );
  });

  it("uses custom threshold in message when provided", () => {
    expect(formatMegaCommitSkipSummaryWarning(3, 50)).toBe(
      "Mega-commit coupling skips: 3 commit(s) exceeded 50 unique in-scope files",
    );
  });
});

describe("createMegaCommitSkippedWarnings", () => {
  it("returns no warnings when there are no skips", () => {
    expect(createMegaCommitSkippedWarnings([])).toEqual([]);
  });

  it("emits one detail warning per skip when at most five", () => {
    const skips = [
      { hash: "aaa", uniqueFileCount: 101 },
      { hash: "bbb", uniqueFileCount: 150 },
    ];

    expect(createMegaCommitSkippedWarnings(skips)).toEqual([
      createScanWarning(
        MEGA_COMMIT_SKIPPED_CODE,
        "Mega-commit skipped for coupling (101 unique in-scope files > 100): aaa",
      ),
      createScanWarning(
        MEGA_COMMIT_SKIPPED_CODE,
        "Mega-commit skipped for coupling (150 unique in-scope files > 100): bbb",
      ),
    ]);
  });

  it("caps detail warnings and adds one summary for the remainder", () => {
    const skips = Array.from({ length: 7 }, (_, index) => ({
      hash: `hash-${index}`,
      uniqueFileCount: 101 + index,
    }));

    const warnings = createMegaCommitSkippedWarnings(skips, { maxDetail: 3 });

    expect(warnings).toHaveLength(4);
    expect(warnings[0]).toEqual(
      createScanWarning(
        MEGA_COMMIT_SKIPPED_CODE,
        "Mega-commit skipped for coupling (101 unique in-scope files > 100): hash-0",
      ),
    );
    expect(warnings[1]).toEqual(
      createScanWarning(
        MEGA_COMMIT_SKIPPED_CODE,
        "Mega-commit skipped for coupling (102 unique in-scope files > 100): hash-1",
      ),
    );
    expect(warnings[2]).toEqual(
      createScanWarning(
        MEGA_COMMIT_SKIPPED_CODE,
        "Mega-commit skipped for coupling (103 unique in-scope files > 100): hash-2",
      ),
    );
    expect(warnings[3]).toEqual(
      createScanWarning(
        MEGA_COMMIT_SKIPPED_CODE,
        "Mega-commit coupling skips: 7 commit(s) exceeded 100 unique in-scope files",
      ),
    );
  });

  it("uses custom threshold in warning messages when provided", () => {
    const skips = [{ hash: "custom", uniqueFileCount: 51 }];

    expect(
      createMegaCommitSkippedWarnings(skips, { megaCommitThreshold: 50 }),
    ).toEqual([
      createScanWarning(
        MEGA_COMMIT_SKIPPED_CODE,
        "Mega-commit skipped for coupling (51 unique in-scope files > 50): custom",
      ),
    ]);
  });
});
