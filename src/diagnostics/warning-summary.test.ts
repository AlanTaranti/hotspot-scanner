import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatAmbiguousRenameWarnings,
  formatSinceTruncationWarning,
  formatUnlinkedRenameWarnings,
} from "../git/rename-warnings.js";
import {
  classifyWarning,
  flushWarningSummary,
  flushWarningsJson,
} from "./warning-summary.js";
import {
  createCliDiagnosticHandlers,
  createScanWarning,
} from "./logger.js";
import type { ScanWarning } from "../types/domain.js";

function renameWarning(message: string): ScanWarning {
  return {
    severity: "warning",
    code: "RENAME_HISTORY_INCOMPLETE",
    message,
  };
}

describe("classifyWarning", () => {
  it("classifies ambiguous rename messages", () => {
    const [message] = formatAmbiguousRenameWarnings(["src/a.ts"]);
    expect(classifyWarning(renameWarning(message!))).toEqual({
      code: "RENAME_HISTORY_INCOMPLETE",
      subKind: "ambiguous",
    });
  });

  it("classifies unlinked sample and remainder messages", () => {
    const messages = formatUnlinkedRenameWarnings(
      Array.from({ length: 7 }, (_, i) => ({
        from: `old${i}.ts`,
        to: `new${i}.ts`,
      })),
    );
    expect(messages).toHaveLength(6);
    for (const message of messages) {
      expect(classifyWarning(renameWarning(message)).subKind).toBe("unlinked");
    }
  });

  it("classifies since-truncation messages", () => {
    const message = formatSinceTruncationWarning("12 months ago");
    expect(classifyWarning(renameWarning(message))).toEqual({
      code: "RENAME_HISTORY_INCOMPLETE",
      subKind: "since-truncation",
    });
  });

  it("defaults other codes and unknown rename shapes", () => {
    expect(
      classifyWarning(
        createScanWarning("READ_FAILED", "Could not read src/x.ts"),
      ),
    ).toEqual({ code: "READ_FAILED", subKind: "default" });

    expect(
      classifyWarning({
        severity: "warning",
        code: "RENAME_HISTORY_INCOMPLETE",
        message: "Unexpected rename shape",
      }),
    ).toEqual({
      code: "RENAME_HISTORY_INCOMPLETE",
      subKind: "default",
    });

    expect(
      classifyWarning({ severity: "warning", message: "no code" }),
    ).toEqual({ code: "UNKNOWN", subKind: "default" });
  });
});

describe("flushWarningsJson", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits empty warnings array for an empty buffer", () => {
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    flushWarningsJson([]);

    expect(write).toHaveBeenCalledWith('{"warnings":[]}\n');
  });

  it("emits full structured warnings without aggregation", () => {
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const warnings = [
      createScanWarning("READ_FAILED", "Could not read a.ts"),
      createScanWarning("READ_FAILED", "Could not read b.ts"),
    ];

    flushWarningsJson(warnings);

    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenNthCalledWith(1, "\n");
    expect(JSON.parse(String(write.mock.calls[1]![0]))).toEqual({
      warnings,
    });
  });
});

describe("flushWarningSummary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits nothing for an empty buffer", () => {
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    flushWarningSummary([]);

    expect(write).not.toHaveBeenCalled();
  });

  it("aggregates multiple ambiguous paths into one line with count", () => {
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const messages = formatAmbiguousRenameWarnings([
      "src/a.ts",
      "src/b.ts",
      "src/c.ts",
    ]);

    flushWarningSummary(messages.map(renameWarning));

    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenNthCalledWith(1, "\n");
    expect(write).toHaveBeenNthCalledWith(
      2,
      "warning: Rename history may be incomplete for 3 path(s). Next step: verify rename detection or widen --since to capture more history.\n",
    );
  });

  it("aggregates unlinked samples + remainder into total pair count", () => {
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const messages = formatUnlinkedRenameWarnings(
      Array.from({ length: 7 }, (_, i) => ({
        from: `old${i}.ts`,
        to: `new${i}.ts`,
      })),
    );
    expect(messages).toHaveLength(6); // 5 samples + remainder

    flushWarningSummary(messages.map(renameWarning));

    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenNthCalledWith(1, "\n");
    expect(write).toHaveBeenNthCalledWith(
      2,
      "warning: Suspected unlinked rename (no git rename metadata): 7 pair(s). Next step: ensure git records renames (-M is enabled) or widen --since to capture earlier history.\n",
    );
  });

  it("emits original since-truncation message when count is 1", () => {
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const message = formatSinceTruncationWarning("6 months ago");

    flushWarningSummary([renameWarning(message)]);

    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenNthCalledWith(1, "\n");
    expect(write).toHaveBeenNthCalledWith(2, `warning: ${message}\n`);
  });

  it("emits original line for a single non-rename warning", () => {
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const warning = createScanWarning(
      "EMPTY_SINCE_WINDOW",
      "No commits found in the specified --since window.",
    );

    flushWarningSummary([warning]);

    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenNthCalledWith(1, "\n");
    expect(write).toHaveBeenNthCalledWith(
      2,
      "warning: No commits found in the specified --since window.\n",
    );
  });

  it("aggregates other repeated codes with count and code", () => {
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    flushWarningSummary([
      createScanWarning("READ_FAILED", "Could not read a.ts"),
      createScanWarning("READ_FAILED", "Could not read b.ts"),
      createScanWarning("READ_FAILED", "Could not read c.ts"),
    ]);

    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenNthCalledWith(1, "\n");
    expect(write.mock.calls[1]![0]).toMatch(
      /^warning: 3 READ_FAILED: Could not read a\.ts\n$/,
    );
  });
});

describe("createCliDiagnosticHandlers warningsMode", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("buffers under summary and flush emits then clears (idempotent)", () => {
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const { onWarning, flushWarnings } = createCliDiagnosticHandlers({
      warningsMode: "summary",
    });
    const messages = formatAmbiguousRenameWarnings(["a.ts", "b.ts"]);

    for (const message of messages) {
      onWarning(renameWarning(message));
    }
    expect(write).not.toHaveBeenCalled();

    flushWarnings();
    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenNthCalledWith(1, "\n");
    expect(write).toHaveBeenNthCalledWith(
      2,
      "warning: Rename history may be incomplete for 2 path(s). Next step: verify rename detection or widen --since to capture more history.\n",
    );

    write.mockClear();
    flushWarnings();
    expect(write).not.toHaveBeenCalled();
  });

  it("defaults to summary when warningsMode omitted", () => {
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const { onWarning, flushWarnings } = createCliDiagnosticHandlers();

    onWarning(createScanWarning("READ_FAILED", "Could not read x.ts"));
    expect(write).not.toHaveBeenCalled();

    flushWarnings();
    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenNthCalledWith(1, "\n");
    expect(write).toHaveBeenNthCalledWith(2, "warning: Could not read x.ts\n");
  });

  it("logs immediately under full and flush is a no-op", () => {
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const { onWarning, flushWarnings } = createCliDiagnosticHandlers({
      warningsMode: "full",
    });
    const messages = formatAmbiguousRenameWarnings(["a.ts", "b.ts"]);

    for (const message of messages) {
      onWarning(renameWarning(message));
    }
    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenCalledWith(`warning: ${messages[0]}\n`);
    expect(write).toHaveBeenCalledWith(`warning: ${messages[1]}\n`);

    write.mockClear();
    flushWarnings();
    expect(write).not.toHaveBeenCalled();
  });

  it("quiet suppresses info but still flushes warning/error under summary", () => {
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const { onProgress, onWarning, flushWarnings } =
      createCliDiagnosticHandlers({
        quiet: true,
        warningsMode: "summary",
      });

    onProgress({ phase: "git", commitsProcessed: 1000 });
    onWarning({
      severity: "info",
      code: "INFO_CODE",
      message: "info msg",
    });
    onWarning({
      severity: "warning",
      code: "WARN_CODE",
      message: "warn msg",
    });
    onWarning({
      severity: "error",
      code: "ERR_CODE",
      message: "error msg",
    });

    expect(write).not.toHaveBeenCalled();

    flushWarnings();
    expect(write).toHaveBeenCalledTimes(3);
    expect(write).toHaveBeenNthCalledWith(1, "\n");
    expect(write).toHaveBeenNthCalledWith(2, "warning: warn msg\n");
    expect(write).toHaveBeenNthCalledWith(3, "error: error msg\n");
  });

  it("quiet + full still suppresses info and logs warning/error immediately", () => {
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const { onWarning, flushWarnings } = createCliDiagnosticHandlers({
      quiet: true,
      warningsMode: "full",
    });

    onWarning({ severity: "info", message: "info msg" });
    onWarning({ severity: "warning", message: "warn msg" });
    onWarning({ severity: "error", message: "error msg" });

    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenCalledWith("warning: warn msg\n");
    expect(write).toHaveBeenCalledWith("error: error msg\n");

    write.mockClear();
    flushWarnings();
    expect(write).not.toHaveBeenCalled();
  });

  it("buffers under json and flush emits one JSON document", () => {
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const { onWarning, flushWarnings } = createCliDiagnosticHandlers({
      warningsMode: "json",
    });
    const messages = formatAmbiguousRenameWarnings(["a.ts", "b.ts"]);
    const warnings = messages.map(renameWarning);

    for (const warning of warnings) {
      onWarning(warning);
    }
    expect(write).not.toHaveBeenCalled();

    flushWarnings();
    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenNthCalledWith(1, "\n");
    expect(JSON.parse(String(write.mock.calls[1]![0]))).toEqual({
      warnings,
    });
  });

  it("json flush emits empty array when no warnings buffered", () => {
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const { flushWarnings } = createCliDiagnosticHandlers({
      warningsMode: "json",
    });

    flushWarnings();

    expect(write).toHaveBeenCalledWith('{"warnings":[]}\n');
  });

  it("quiet suppresses info from json payload", () => {
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const { onWarning, flushWarnings } = createCliDiagnosticHandlers({
      quiet: true,
      warningsMode: "json",
    });
    const warn = createScanWarning("WARN_CODE", "warn msg");

    onWarning({ severity: "info", code: "INFO_CODE", message: "info msg" });
    onWarning(warn);
    flushWarnings();

    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenNthCalledWith(1, "\n");
    expect(JSON.parse(String(write.mock.calls[1]![0]))).toEqual({
      warnings: [warn],
    });
  });
});
