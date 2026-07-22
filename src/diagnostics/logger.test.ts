import { afterEach, describe, expect, it, vi } from "vitest";
import {
  logProgress,
  logWarning,
  maybeLogProgress,
  PROGRESS_LOG_INTERVAL,
} from "./logger.js";

describe("diagnostics logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logWarning writes to stderr with prefix", () => {
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    logWarning("parse failed");

    expect(write).toHaveBeenCalledWith("warning: parse failed\n");
  });

  it("logProgress writes formatted commit count", () => {
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    logProgress(5000);

    expect(write).toHaveBeenCalledWith("Processing commit 5,000...\n");
  });

  it("maybeLogProgress emits at interval boundaries", () => {
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    expect(maybeLogProgress(999)).toBe(false);
    expect(write).not.toHaveBeenCalled();

    expect(maybeLogProgress(1000)).toBe(true);
    expect(write).toHaveBeenCalledWith("Processing commit 1,000...\n");

    write.mockClear();
    expect(maybeLogProgress(2000)).toBe(true);
    expect(write).toHaveBeenCalledWith("Processing commit 2,000...\n");
  });

  it("maybeLogProgress does not emit for zero commits", () => {
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    expect(maybeLogProgress(0)).toBe(false);
    expect(write).not.toHaveBeenCalled();
  });

  it("uses PROGRESS_LOG_INTERVAL as default", () => {
    expect(PROGRESS_LOG_INTERVAL).toBe(1000);
  });
});
