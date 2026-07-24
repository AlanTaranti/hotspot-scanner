import { describe, expect, it } from "vitest";
import type { ParsedCommit } from "./parse.js";
import {
  createEmptyBlindSpotSignals,
  createEmptySinceWindowWarning,
  createRenameHistoryIncompleteWarning,
  formatAmbiguousRenameWarnings,
  formatFunctionPostRenameOverlapWarning,
  formatSinceTruncationWarning,
  formatUnlinkedRenameWarnings,
  pathsLookLikeRename,
  recordBlindSpotsFromCommit,
} from "./rename-warnings.js";

describe("createEmptySinceWindowWarning", () => {
  it("returns structured EMPTY_SINCE_WINDOW warning", () => {
    expect(createEmptySinceWindowWarning()).toEqual({
      severity: "warning",
      code: "EMPTY_SINCE_WINDOW",
      message: "No commits found in the specified --since window.",
    });
  });
});

describe("createRenameHistoryIncompleteWarning", () => {
  it("wraps message with RENAME_HISTORY_INCOMPLETE code", () => {
    expect(
      createRenameHistoryIncompleteWarning(
        "Rename history may be incomplete for: a.ts",
      ),
    ).toEqual({
      severity: "warning",
      code: "RENAME_HISTORY_INCOMPLETE",
      message: "Rename history may be incomplete for: a.ts",
    });
  });
});

describe("formatAmbiguousRenameWarnings", () => {
  it("matches the existing incomplete-history prefix per path", () => {
    expect(formatAmbiguousRenameWarnings(["a.ts", "b.ts"])).toEqual([
      "Rename history may be incomplete for: a.ts",
      "Rename history may be incomplete for: b.ts",
    ]);
  });

  it("returns an empty array for no paths", () => {
    expect(formatAmbiguousRenameWarnings([])).toEqual([]);
  });
});

describe("formatUnlinkedRenameWarnings", () => {
  it("names each suspected pair", () => {
    expect(
      formatUnlinkedRenameWarnings([
        { from: "src/old/foo.ts", to: "lib/foo.ts" },
      ]),
    ).toEqual([
      "Suspected unlinked rename (no git rename metadata): src/old/foo.ts -> lib/foo.ts",
    ]);
  });

  it("caps listed pairs and summarizes the remainder", () => {
    const pairs = Array.from({ length: 7 }, (_, index) => ({
      from: `del/${index}.ts`,
      to: `add/${index}.ts`,
    }));

    const warnings = formatUnlinkedRenameWarnings(pairs, { maxPairs: 3 });

    expect(warnings).toHaveLength(4);
    expect(warnings[0]).toContain("del/0.ts -> add/0.ts");
    expect(warnings[1]).toContain("del/1.ts -> add/1.ts");
    expect(warnings[2]).toContain("del/2.ts -> add/2.ts");
    expect(warnings[3]).toBe(
      "... and 4 more suspected unlinked renames",
    );
  });

  it("uses singular summary text for one remaining pair", () => {
    const pairs = Array.from({ length: 4 }, (_, index) => ({
      from: `del/${index}.ts`,
      to: `add/${index}.ts`,
    }));

    expect(formatUnlinkedRenameWarnings(pairs, { maxPairs: 3 })).toContain(
      "... and 1 more suspected unlinked rename",
    );
  });

  it("returns an empty array for no pairs", () => {
    expect(formatUnlinkedRenameWarnings([])).toEqual([]);
  });
});

describe("formatSinceTruncationWarning", () => {
  it("mentions the since window", () => {
    expect(formatSinceTruncationWarning("12 months ago")).toBe(
      "Rename history before the --since window (12 months ago) may be missing under canonical paths",
    );
  });
});

describe("formatFunctionPostRenameOverlapWarning", () => {
  it("states current ranges vs historical hunks and reduced confidence", () => {
    const message = formatFunctionPostRenameOverlapWarning();
    expect(message).toContain("[line, endLine]");
    expect(message).toContain("historical hunks");
    expect(message).toContain("confidence may be reduced");
    expect(message).toContain("renames or moves");
  });
});

describe("pathsLookLikeRename", () => {
  it("returns true when basenames match across directories", () => {
    expect(pathsLookLikeRename("src/foo.ts", "lib/foo.ts")).toBe(true);
  });

  it("returns false for unrelated basenames", () => {
    expect(pathsLookLikeRename("src/foo.ts", "src/bar.ts")).toBe(false);
  });

  it("returns false for identical paths", () => {
    expect(pathsLookLikeRename("src/foo.ts", "src/foo.ts")).toBe(false);
  });
});

describe("recordBlindSpotsFromCommit", () => {
  const commit = (
    files: ParsedCommit["files"],
    hash = "abc123",
  ): ParsedCommit => ({
    hash,
    date: new Date("2024-01-01"),
    author: "dev",
    files,
  });

  it("records unlinked delete+add pairs with matching basenames", () => {
    const signals = createEmptyBlindSpotSignals();
    recordBlindSpotsFromCommit(
      commit([
        { path: "src/old/foo.ts", additions: 0, deletions: 10 },
        { path: "lib/foo.ts", additions: 10, deletions: 0 },
      ]),
      signals,
    );

    expect(signals.unlinkedSuspectedRenames).toEqual([
      { from: "src/old/foo.ts", to: "lib/foo.ts" },
    ]);
    expect(signals.renameLinkCount).toBe(0);
  });

  it("ignores pairs when git rename metadata is present", () => {
    const signals = createEmptyBlindSpotSignals();
    recordBlindSpotsFromCommit(
      commit([
        {
          path: "lib/foo.ts",
          additions: null,
          deletions: null,
          renameFrom: "src/old/foo.ts",
        },
      ]),
      signals,
    );

    expect(signals.unlinkedSuspectedRenames).toEqual([]);
    expect(signals.renameLinkCount).toBe(1);
  });

  it("does not pair unrelated delete+add paths", () => {
    const signals = createEmptyBlindSpotSignals();
    recordBlindSpotsFromCommit(
      commit([
        { path: "src/foo.ts", additions: 0, deletions: 5 },
        { path: "src/bar.ts", additions: 5, deletions: 0 },
      ]),
      signals,
    );

    expect(signals.unlinkedSuspectedRenames).toEqual([]);
  });

  it("deduplicates repeated pairs across commits", () => {
    const signals = createEmptyBlindSpotSignals();
    const sample = commit([
      { path: "src/old/foo.ts", additions: 0, deletions: 10 },
      { path: "lib/foo.ts", additions: 10, deletions: 0 },
    ]);

    recordBlindSpotsFromCommit(sample, signals);
    recordBlindSpotsFromCommit(sample, signals);

    expect(signals.unlinkedSuspectedRenames).toHaveLength(1);
  });
});
