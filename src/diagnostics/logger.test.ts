import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COMPLEXITY_PROGRESS_LOG_INTERVAL,
  PROGRESS_BAR_WIDTH_MAX,
  PROGRESS_BAR_WIDTH_MIN,
  PROGRESS_COLUMNS_FALLBACK,
  createCliDiagnosticHandlers,
  createScanWarning,
  formatFillBar,
  formatProgressBody,
  logProgress,
  logWarning,
  maybeLogProgress,
  PROGRESS_LOG_INTERVAL,
  resolveProgressBarWidth,
  shouldEmitProgress,
} from "./logger.js";

describe("diagnostics logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("resolveProgressBarWidth", () => {
    it("clamps floor(columns * 0.25) between min and max", () => {
      expect(resolveProgressBarWidth(40)).toBe(PROGRESS_BAR_WIDTH_MIN);
      expect(resolveProgressBarWidth(80)).toBe(20);
      expect(resolveProgressBarWidth(200)).toBe(PROGRESS_BAR_WIDTH_MAX);
    });

    it("falls back when columns are missing or invalid", () => {
      expect(resolveProgressBarWidth(undefined)).toBe(
        Math.floor(PROGRESS_COLUMNS_FALLBACK * 0.25),
      );
      expect(resolveProgressBarWidth(0)).toBe(
        Math.floor(PROGRESS_COLUMNS_FALLBACK * 0.25),
      );
      expect(resolveProgressBarWidth(Number.NaN)).toBe(
        Math.floor(PROGRESS_COLUMNS_FALLBACK * 0.25),
      );
    });
  });

  describe("formatFillBar", () => {
    const width = 10;

    it("renders 0%, mid, and 100% fill on TTY glyphs", () => {
      expect(formatFillBar(0, width, true)).toBe("░░░░░░░░░░");
      expect(formatFillBar(0.5, width, true)).toBe("█████░░░░░");
      expect(formatFillBar(1, width, true)).toBe("██████████");
    });

    it("renders ASCII fill on non-TTY", () => {
      expect(formatFillBar(0, width, false)).toBe("----------");
      expect(formatFillBar(0.5, width, false)).toBe("#####-----");
      expect(formatFillBar(1, width, false)).toBe("##########");
    });
  });

  describe("formatProgressBody", () => {
    it("formats complexity with TTY bar and batch fragment", () => {
      const body = formatProgressBody(
        {
          phase: "complexity",
          commitsProcessed: 0,
          filesProcessed: 800,
          totalFiles: 1050,
          batchesProcessed: 16,
          totalBatches: 21,
        },
        { stderrIsTTY: true, stderrColumns: 80 },
      );

      expect(body).toBe(
        "complexity [███████████████░░░░░] 800/1,050 files · batch 16/21",
      );
      expect(body).not.toContain("%");
    });

    it("formats complexity with ASCII bar on non-TTY", () => {
      const body = formatProgressBody(
        {
          phase: "complexity",
          commitsProcessed: 0,
          filesProcessed: 500,
          totalFiles: 1000,
        },
        { stderrIsTTY: false, stderrColumns: 80 },
      );

      expect(body).toBe("complexity [##########----------] 500/1,000 files");
    });

    it("omits bar when totalFiles is unknown", () => {
      const body = formatProgressBody({
        phase: "complexity",
        commitsProcessed: 0,
        filesProcessed: 800,
        batchesProcessed: 2,
      });

      expect(body).toBe("complexity 800 files · batch 2");
      expect(body).not.toContain("[");
    });

    it("omits bar when totalFiles is zero", () => {
      const body = formatProgressBody({
        phase: "complexity",
        commitsProcessed: 0,
        filesProcessed: 0,
        totalFiles: 0,
      });

      expect(body).toBe("complexity 0 files");
      expect(body).not.toContain("[");
    });

    it("formats git as indeterminate counter without bar or percent", () => {
      const body = formatProgressBody({
        phase: "git",
        commitsProcessed: 12000,
      });

      expect(body).toBe("git 12,000 commits…");
      expect(body).not.toContain("[");
      expect(body).not.toContain("%");
    });

    it("formats finalize body", () => {
      expect(
        formatProgressBody({ phase: "finalize", commitsProcessed: 0 }),
      ).toBe("Finalizing…");
    });
  });

  describe("shouldEmitProgress", () => {
    it("always allows finalize", () => {
      expect(
        shouldEmitProgress({ phase: "finalize", commitsProcessed: 0 }),
      ).toBe(true);
    });
  });

  describe("logWarning", () => {
    it("writes warning severity with prefix", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);

      logWarning({ severity: "warning", message: "parse failed" });

      expect(write).toHaveBeenCalledWith("warning: parse failed\n");
    });

    it("writes info severity with prefix", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);

      logWarning({ severity: "info", message: "scan started" });

      expect(write).toHaveBeenCalledWith("info: scan started\n");
    });

    it("writes error severity with prefix", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);

      logWarning({ severity: "error", message: "fatal issue" });

      expect(write).toHaveBeenCalledWith("error: fatal issue\n");
    });
  });

  describe("logProgress", () => {
    it("writes git phase with formatted commit count", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);

      logProgress({ phase: "git", commitsProcessed: 5000 });

      expect(write).toHaveBeenCalledWith("git 5,000 commits…\n");
    });

    it("writes complexity phase with bar and counters", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);

      logProgress(
        {
          phase: "complexity",
          commitsProcessed: 0,
          batchesProcessed: 2,
          totalBatches: 5,
          filesProcessed: 100,
          totalFiles: 237,
        },
        { stderrIsTTY: false, stderrColumns: 80 },
      );

      expect(write).toHaveBeenCalledWith(
        "complexity [########------------] 100/237 files · batch 2/5\n",
      );
    });

    it("writes complexity phase without bar when total is omitted", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);

      logProgress({
        phase: "complexity",
        commitsProcessed: 0,
        filesProcessed: 50,
      });

      expect(write).toHaveBeenCalledWith("complexity 50 files\n");
    });
  });

  describe("maybeLogProgress", () => {
    it("emits at interval boundaries with phase label", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);

      expect(maybeLogProgress({ phase: "git", commitsProcessed: 999 })).toBe(
        false,
      );
      expect(write).not.toHaveBeenCalled();

      expect(maybeLogProgress({ phase: "git", commitsProcessed: 1000 })).toBe(
        true,
      );
      expect(write).toHaveBeenCalledWith("git 1,000 commits…\n");
    });

    it("does not emit for zero commits", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);

      expect(maybeLogProgress({ phase: "git", commitsProcessed: 0 })).toBe(
        false,
      );
      expect(write).not.toHaveBeenCalled();
    });

    it("uses PROGRESS_LOG_INTERVAL as default for git phases", () => {
      expect(PROGRESS_LOG_INTERVAL).toBe(1000);
    });

    it("throttles complexity progress on filesProcessed interval", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);

      expect(
        maybeLogProgress({
          phase: "complexity",
          commitsProcessed: 0,
          filesProcessed: 49,
          totalFiles: 237,
        }),
      ).toBe(false);
      expect(write).not.toHaveBeenCalled();

      expect(
        maybeLogProgress(
          {
            phase: "complexity",
            commitsProcessed: 0,
            batchesProcessed: 1,
            totalBatches: 5,
            filesProcessed: 50,
            totalFiles: 237,
          },
          undefined,
          { stderrIsTTY: false, stderrColumns: 80 },
        ),
      ).toBe(true);
      expect(write).toHaveBeenCalledWith(
        "complexity [####----------------] 50/237 files · batch 1/5\n",
      );
    });

    it("emits complexity progress on final partial batch", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);

      expect(
        maybeLogProgress(
          {
            phase: "complexity",
            commitsProcessed: 0,
            batchesProcessed: 5,
            totalBatches: 5,
            filesProcessed: 237,
            totalFiles: 237,
          },
          undefined,
          { stderrIsTTY: false, stderrColumns: 80 },
        ),
      ).toBe(true);
      expect(write).toHaveBeenCalledWith(
        "complexity [####################] 237/237 files · batch 5/5\n",
      );
    });

    it("uses COMPLEXITY_PROGRESS_LOG_INTERVAL as default for complexity", () => {
      expect(COMPLEXITY_PROGRESS_LOG_INTERVAL).toBe(50);
    });
  });

  describe("createScanWarning", () => {
    it("defaults severity to warning", () => {
      expect(createScanWarning("PARSE_FAILED", "syntax error")).toEqual({
        code: "PARSE_FAILED",
        message: "syntax error",
        severity: "warning",
      });
    });

    it("accepts explicit severity", () => {
      expect(
        createScanWarning("EMPTY_SINCE_WINDOW", "no commits", "info"),
      ).toEqual({
        code: "EMPTY_SINCE_WINDOW",
        message: "no commits",
        severity: "info",
      });
    });
  });

  describe("createCliDiagnosticHandlers", () => {
    it("forwards progress immediately and flushes warning severities under default summary", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const { onProgress, onWarning, flushWarnings } =
        createCliDiagnosticHandlers({ stderrIsTTY: false });

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

      expect(write).toHaveBeenCalledWith("git 1,000 commits…\n");
      expect(write).toHaveBeenCalledTimes(1);

      flushWarnings();
      expect(write).toHaveBeenNthCalledWith(2, "\n");
      expect(write).toHaveBeenCalledWith("info: info msg\n");
      expect(write).toHaveBeenCalledWith("warning: warn msg\n");
    });

    it("forwards complexity progress with bar and counters", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const { onProgress } = createCliDiagnosticHandlers({
        stderrIsTTY: false,
        stderrColumns: 80,
      });

      onProgress({
        phase: "complexity",
        commitsProcessed: 0,
        batchesProcessed: 1,
        totalBatches: 3,
        filesProcessed: 50,
        totalFiles: 120,
      });

      expect(write).toHaveBeenCalledWith(
        "complexity [########------------] 50/120 files · batch 1/3\n",
      );
    });

    it("overwrites one live line on TTY stderr for git progress", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const { onProgress } = createCliDiagnosticHandlers({ stderrIsTTY: true });

      onProgress({ phase: "git", commitsProcessed: 1000 });
      onProgress({ phase: "git", commitsProcessed: 2000 });

      expect(write).toHaveBeenNthCalledWith(1, "\x1b[2K\rgit 1,000 commits…");
      expect(write).toHaveBeenNthCalledWith(2, "\x1b[2K\rgit 2,000 commits…");
      expect(
        write.mock.calls.every((call) => !String(call[0]).endsWith("\n")),
      ).toBe(true);
    });

    it("overwrites one live line on TTY stderr for complexity progress", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const { onProgress } = createCliDiagnosticHandlers({
        stderrIsTTY: true,
        stderrColumns: 80,
      });

      onProgress({
        phase: "complexity",
        commitsProcessed: 0,
        batchesProcessed: 1,
        totalBatches: 3,
        filesProcessed: 50,
        totalFiles: 120,
      });

      expect(write).toHaveBeenCalledWith(
        "\x1b[2K\rcomplexity [████████░░░░░░░░░░░░] 50/120 files · batch 1/3",
      );
    });

    it("clears live progress at flushWarnings before summary warnings", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const { onProgress, onWarning, flushWarnings } =
        createCliDiagnosticHandlers({ stderrIsTTY: true });

      onProgress({ phase: "git", commitsProcessed: 1000 });
      onWarning({
        severity: "warning",
        code: "WARN_CODE",
        message: "warn msg",
      });
      flushWarnings();

      expect(write).toHaveBeenNthCalledWith(1, "\x1b[2K\rgit 1,000 commits…");
      expect(write).toHaveBeenNthCalledWith(2, "\x1b[2K\r");
      expect(write).toHaveBeenNthCalledWith(3, "\n");
      expect(write).toHaveBeenNthCalledWith(4, "warning: warn msg\n");
    });

    it("clears live progress before each warning under warnings=full", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const { onProgress, onWarning } = createCliDiagnosticHandlers({
        stderrIsTTY: true,
        warningsMode: "full",
      });

      onProgress({ phase: "git", commitsProcessed: 1000 });
      onWarning({
        severity: "warning",
        code: "WARN_CODE",
        message: "warn msg",
      });

      expect(write).toHaveBeenNthCalledWith(1, "\x1b[2K\rgit 1,000 commits…");
      expect(write).toHaveBeenNthCalledWith(2, "\x1b[2K\r");
      expect(write).toHaveBeenNthCalledWith(3, "warning: warn msg\n");
    });

    it("clears live progress on flushWarnings even under warnings=full", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const { onProgress, flushWarnings } = createCliDiagnosticHandlers({
        stderrIsTTY: true,
        warningsMode: "full",
      });

      onProgress({ phase: "git", commitsProcessed: 1000 });
      flushWarnings();

      expect(write).toHaveBeenNthCalledWith(1, "\x1b[2K\rgit 1,000 commits…");
      expect(write).toHaveBeenNthCalledWith(2, "\x1b[2K\r");
      expect(write).toHaveBeenCalledTimes(2);
    });

    it("clears stale git line when switching to complexity phase on TTY", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const { onProgress } = createCliDiagnosticHandlers({
        stderrIsTTY: true,
        stderrColumns: 80,
      });

      onProgress({ phase: "git", commitsProcessed: 1000 });
      onProgress({
        phase: "complexity",
        commitsProcessed: 0,
        batchesProcessed: 1,
        totalBatches: 3,
        filesProcessed: 50,
        totalFiles: 120,
      });

      expect(write).toHaveBeenNthCalledWith(1, "\x1b[2K\rgit 1,000 commits…");
      expect(write).toHaveBeenNthCalledWith(2, "\x1b[2K\r");
      expect(write).toHaveBeenNthCalledWith(
        3,
        "\x1b[2K\rcomplexity [████████░░░░░░░░░░░░] 50/120 files · batch 1/3",
      );
    });

    it("clears stale complexity line when switching to finalize phase on TTY", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const { onProgress } = createCliDiagnosticHandlers({
        stderrIsTTY: true,
        stderrColumns: 80,
      });

      onProgress({
        phase: "complexity",
        commitsProcessed: 0,
        filesProcessed: 120,
        totalFiles: 120,
      });
      onProgress({ phase: "finalize", commitsProcessed: 0 });

      expect(write).toHaveBeenNthCalledWith(3, "\x1b[2K\rFinalizing…");
    });

    it("emits finalize without throttle", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const { onProgress } = createCliDiagnosticHandlers({
        stderrIsTTY: false,
      });

      onProgress({ phase: "finalize", commitsProcessed: 0 });

      expect(write).toHaveBeenCalledWith("Finalizing…\n");
    });

    it("uses injected stderrColumns for bar width", () => {
      const narrow = formatProgressBody(
        {
          phase: "complexity",
          commitsProcessed: 0,
          filesProcessed: 50,
          totalFiles: 100,
        },
        { stderrIsTTY: false, stderrColumns: 40 },
      );
      const wide = formatProgressBody(
        {
          phase: "complexity",
          commitsProcessed: 0,
          filesProcessed: 50,
          totalFiles: 100,
        },
        { stderrIsTTY: false, stderrColumns: 200 },
      );

      expect(narrow).toContain("[#####-----]");
      expect(wide).toContain("[####################--------------------]");
    });

    it("double clearLiveProgress is a no-op", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const { onProgress, clearLiveProgress } = createCliDiagnosticHandlers({
        stderrIsTTY: true,
      });

      onProgress({ phase: "git", commitsProcessed: 1000 });
      clearLiveProgress();
      clearLiveProgress();

      expect(write).toHaveBeenNthCalledWith(1, "\x1b[2K\rgit 1,000 commits…");
      expect(write).toHaveBeenNthCalledWith(2, "\x1b[2K\r");
      expect(write).toHaveBeenCalledTimes(2);
    });

    it("suppresses progress when noProgress is set", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const { onProgress, onWarning, flushWarnings } =
        createCliDiagnosticHandlers({
          noProgress: true,
        });

      onProgress({ phase: "git", commitsProcessed: 1000 });
      onProgress({ phase: "finalize", commitsProcessed: 0 });
      onWarning({ severity: "info", message: "info msg" });

      expect(write).not.toHaveBeenCalled();
      flushWarnings();
      expect(write).toHaveBeenCalledTimes(2);
      expect(write).toHaveBeenNthCalledWith(1, "\n");
      expect(write).toHaveBeenNthCalledWith(2, "info: info msg\n");
    });

    it("suppresses progress and info warnings when quiet is set", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const { onProgress, onWarning, flushWarnings } =
        createCliDiagnosticHandlers({
          quiet: true,
        });

      onProgress({ phase: "git", commitsProcessed: 1000 });
      onProgress({ phase: "finalize", commitsProcessed: 0 });
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

    it("quiet supersedes noProgress when both are set", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const { onProgress, onWarning, flushWarnings } =
        createCliDiagnosticHandlers({
          quiet: true,
          noProgress: true,
        });

      onProgress({ phase: "git", commitsProcessed: 1000 });
      onProgress({ phase: "finalize", commitsProcessed: 0 });
      onWarning({ severity: "info", message: "info msg" });

      flushWarnings();
      expect(write).not.toHaveBeenCalled();
    });

    // M62 (HOTSPOT-1034): first-progress since= prefix — composes with M59 live overwrite
    describe("since= first-progress prefix (M62)", () => {
      it("prefixes only the first emitted progress line on non-TTY", () => {
        const write = vi
          .spyOn(process.stderr, "write")
          .mockImplementation(() => true);
        const { onProgress } = createCliDiagnosticHandlers({
          stderrIsTTY: false,
          since: "12 months ago",
        });

        onProgress({ phase: "git", commitsProcessed: 1000 });
        onProgress({ phase: "git", commitsProcessed: 2000 });

        expect(write).toHaveBeenNthCalledWith(
          1,
          "since=12 months ago · git 1,000 commits…\n",
        );
        expect(write).toHaveBeenNthCalledWith(2, "git 2,000 commits…\n");
      });

      it("prefixes only the first emitted progress line on TTY (M59 overwrite)", () => {
        const write = vi
          .spyOn(process.stderr, "write")
          .mockImplementation(() => true);
        const { onProgress } = createCliDiagnosticHandlers({
          stderrIsTTY: true,
          since: "6 months ago",
        });

        onProgress({ phase: "git", commitsProcessed: 1000 });
        onProgress({ phase: "git", commitsProcessed: 2000 });

        expect(write).toHaveBeenNthCalledWith(
          1,
          "\x1b[2K\rsince=6 months ago · git 1,000 commits…",
        );
        expect(write).toHaveBeenNthCalledWith(2, "\x1b[2K\rgit 2,000 commits…");
      });

      it("does not repeat since= when switching phases", () => {
        const write = vi
          .spyOn(process.stderr, "write")
          .mockImplementation(() => true);
        const { onProgress } = createCliDiagnosticHandlers({
          stderrIsTTY: false,
          stderrColumns: 80,
          since: "1 year ago",
        });

        onProgress({ phase: "git", commitsProcessed: 1000 });
        onProgress({
          phase: "complexity",
          commitsProcessed: 0,
          batchesProcessed: 1,
          totalBatches: 3,
          filesProcessed: 50,
          totalFiles: 120,
        });

        expect(write).toHaveBeenNthCalledWith(
          1,
          "since=1 year ago · git 1,000 commits…\n",
        );
        expect(write).toHaveBeenNthCalledWith(
          2,
          "complexity [########------------] 50/120 files · batch 1/3\n",
        );
        expect(String(write.mock.calls[1][0])).not.toContain("since=");
      });

      it("applies prefix on first emitted line after throttle skips early ticks", () => {
        const write = vi
          .spyOn(process.stderr, "write")
          .mockImplementation(() => true);
        const { onProgress } = createCliDiagnosticHandlers({
          stderrIsTTY: false,
          since: "3 months ago",
        });

        onProgress({ phase: "git", commitsProcessed: 500 });
        expect(write).not.toHaveBeenCalled();

        onProgress({ phase: "git", commitsProcessed: 1000 });
        expect(write).toHaveBeenCalledWith(
          "since=3 months ago · git 1,000 commits…\n",
        );
      });

      it("omits prefix when since option is not set", () => {
        const write = vi
          .spyOn(process.stderr, "write")
          .mockImplementation(() => true);
        const { onProgress } = createCliDiagnosticHandlers({
          stderrIsTTY: false,
        });

        onProgress({ phase: "git", commitsProcessed: 1000 });

        expect(write).toHaveBeenCalledWith("git 1,000 commits…\n");
      });

      it("suppresses progress and prefix when quiet is set", () => {
        const write = vi
          .spyOn(process.stderr, "write")
          .mockImplementation(() => true);
        const { onProgress } = createCliDiagnosticHandlers({
          quiet: true,
          since: "12 months ago",
        });

        onProgress({ phase: "git", commitsProcessed: 1000 });

        expect(write).not.toHaveBeenCalled();
      });

      it("suppresses progress and prefix when noProgress is set", () => {
        const write = vi
          .spyOn(process.stderr, "write")
          .mockImplementation(() => true);
        const { onProgress } = createCliDiagnosticHandlers({
          noProgress: true,
          since: "12 months ago",
        });

        onProgress({ phase: "git", commitsProcessed: 1000 });

        expect(write).not.toHaveBeenCalled();
      });
    });
  });
});
