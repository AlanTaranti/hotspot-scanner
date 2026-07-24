import { afterEach, describe, expect, it, vi } from "vitest";
import {
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

      logProgress("git", 5000);

      expect(write).toHaveBeenCalledWith("Processing git commit 5,000...\n");
    });

    it("writes function-churn phase with formatted commit count", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);

      logProgress("function-churn", 2500);

      expect(write).toHaveBeenCalledWith(
        "Processing function-churn commit 2,500...\n",
      );
    });
  });

  describe("maybeLogProgress", () => {
    it("emits at interval boundaries with phase label", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);

      expect(maybeLogProgress("git", 999)).toBe(false);
      expect(write).not.toHaveBeenCalled();

      expect(maybeLogProgress("git", 1000)).toBe(true);
      expect(write).toHaveBeenCalledWith("Processing git commit 1,000...\n");

      write.mockClear();
      expect(maybeLogProgress("function-churn", 2000)).toBe(true);
      expect(write).toHaveBeenCalledWith(
        "Processing function-churn commit 2,000...\n",
      );
    });

    it("does not emit for zero commits", () => {
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);

      expect(maybeLogProgress("git", 0)).toBe(false);
      expect(write).not.toHaveBeenCalled();
    });

    it("uses PROGRESS_LOG_INTERVAL as default", () => {
      expect(PROGRESS_LOG_INTERVAL).toBe(1000);
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
});
