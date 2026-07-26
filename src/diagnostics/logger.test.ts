import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COMPLEXITY_PROGRESS_LOG_INTERVAL,
  createCliDiagnosticHandlers,
  createScanWarning,
  logProgress,
  logWarning,
  maybeLogProgress,
  PROGRESS_LOG_INTERVAL,
} from "./logger.js";

describe("diagnostics logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
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

      expect(write).toHaveBeenCalledWith("Processing git commit 5,000...\n");
    });

    it("writes complexity phase with batch and file counters", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);

      logProgress({
        phase: "complexity",
        commitsProcessed: 0,
        batchesProcessed: 2,
        totalBatches: 5,
        filesProcessed: 100,
        totalFiles: 237,
      });

      expect(write).toHaveBeenCalledWith(
        "Processing complexity batch 2/5 (100/237 files)...\n",
      );
    });

    it("writes complexity phase with partial counters when totals are omitted", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);

      logProgress({
        phase: "complexity",
        commitsProcessed: 0,
        filesProcessed: 50,
      });

      expect(write).toHaveBeenCalledWith(
        "Processing complexity (50 files)...\n",
      );
    });
  });

  describe("maybeLogProgress", () => {
    it("emits at interval boundaries with phase label", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);

      expect(
        maybeLogProgress({ phase: "git", commitsProcessed: 999 }),
      ).toBe(false);
      expect(write).not.toHaveBeenCalled();

      expect(
        maybeLogProgress({ phase: "git", commitsProcessed: 1000 }),
      ).toBe(true);
      expect(write).toHaveBeenCalledWith("Processing git commit 1,000...\n");
    });

    it("does not emit for zero commits", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);

      expect(
        maybeLogProgress({ phase: "git", commitsProcessed: 0 }),
      ).toBe(false);
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
        maybeLogProgress({
          phase: "complexity",
          commitsProcessed: 0,
          batchesProcessed: 1,
          totalBatches: 5,
          filesProcessed: 50,
          totalFiles: 237,
        }),
      ).toBe(true);
      expect(write).toHaveBeenCalledWith(
        "Processing complexity batch 1/5 (50/237 files)...\n",
      );
    });

    it("emits complexity progress on final partial batch", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);

      expect(
        maybeLogProgress({
          phase: "complexity",
          commitsProcessed: 0,
          batchesProcessed: 5,
          totalBatches: 5,
          filesProcessed: 237,
          totalFiles: 237,
        }),
      ).toBe(true);
      expect(write).toHaveBeenCalledWith(
        "Processing complexity batch 5/5 (237/237 files)...\n",
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
    it("forwards progress and all warning severities by default", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const { onProgress, onWarning } = createCliDiagnosticHandlers();

      onProgress({ phase: "git", commitsProcessed: 1000 });
      onWarning({ severity: "info", message: "info msg" });
      onWarning({ severity: "warning", message: "warn msg" });

      expect(write).toHaveBeenCalledWith("Processing git commit 1,000...\n");
      expect(write).toHaveBeenCalledWith("info: info msg\n");
      expect(write).toHaveBeenCalledWith("warning: warn msg\n");
    });

    it("forwards complexity progress with batch and file counters", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const { onProgress } = createCliDiagnosticHandlers();

      onProgress({
        phase: "complexity",
        commitsProcessed: 0,
        batchesProcessed: 1,
        totalBatches: 3,
        filesProcessed: 50,
        totalFiles: 120,
      });

      expect(write).toHaveBeenCalledWith(
        "Processing complexity batch 1/3 (50/120 files)...\n",
      );
    });

    it("suppresses progress when noProgress is set", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const { onProgress, onWarning } = createCliDiagnosticHandlers({
        noProgress: true,
      });

      onProgress({ phase: "git", commitsProcessed: 1000 });
      onWarning({ severity: "info", message: "info msg" });

      expect(write).toHaveBeenCalledTimes(1);
      expect(write).toHaveBeenCalledWith("info: info msg\n");
    });

    it("suppresses progress and info warnings when quiet is set", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const { onProgress, onWarning } = createCliDiagnosticHandlers({
        quiet: true,
      });

      onProgress({ phase: "git", commitsProcessed: 1000 });
      onWarning({ severity: "info", message: "info msg" });
      onWarning({ severity: "warning", message: "warn msg" });
      onWarning({ severity: "error", message: "error msg" });

      expect(write).not.toHaveBeenCalledWith(
        expect.stringContaining("Processing git commit"),
      );
      expect(write).toHaveBeenCalledTimes(2);
      expect(write).toHaveBeenCalledWith("warning: warn msg\n");
      expect(write).toHaveBeenCalledWith("error: error msg\n");
    });

    it("quiet supersedes noProgress when both are set", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const { onProgress, onWarning } = createCliDiagnosticHandlers({
        quiet: true,
        noProgress: true,
      });

      onProgress({ phase: "git", commitsProcessed: 1000 });
      onWarning({ severity: "info", message: "info msg" });

      expect(write).not.toHaveBeenCalled();
    });
  });
});
