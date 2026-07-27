import { describe, expect, it } from "vitest";
import { formatGitStderrHint } from "./git-error-hint.js";

describe("formatGitStderrHint", () => {
  describe("since/date family", () => {
    it.each([
      "fatal: invalid date format: 'not-a-date'",
      "error: not a valid date",
      "bad date in --since=foo",
    ])("matches %#", (stderr) => {
      expect(formatGitStderrHint(stderr)).toBe(
        "Fix --since or config since — use a relative window (e.g. `12 months ago`) or an ISO date (YYYY-MM-DD).",
      );
    });

    it("matches case-insensitively", () => {
      expect(formatGitStderrHint("INVALID DATE format")).toBe(
        "Fix --since or config since — use a relative window (e.g. `12 months ago`) or an ISO date (YYYY-MM-DD).",
      );
    });
  });

  describe("shallow family", () => {
    it.each([
      "error: object not found - shallow clone not allowed",
      "fatal: missing commit in shallow repository",
    ])("matches %#", (stderr) => {
      expect(formatGitStderrHint(stderr)).toBe(
        "Deepen the clone with `git fetch --unshallow` or re-clone without --depth for full history.",
      );
    });

    it("matches case-insensitively", () => {
      expect(formatGitStderrHint("SHALLOW clone limitation")).toBe(
        "Deepen the clone with `git fetch --unshallow` or re-clone without --depth for full history.",
      );
    });
  });

  describe("corrupt family", () => {
    it.each([
      "error: corrupt object at 0xdeadbeef",
      "fatal: bad object abc123",
      "error: loose object is corrupt",
    ])("matches %#", (stderr) => {
      expect(formatGitStderrHint(stderr)).toBe(
        "Run `git fsck` to check object integrity, or repair or re-clone the repository.",
      );
    });

    it("matches case-insensitively", () => {
      expect(formatGitStderrHint("CORRUPT object file")).toBe(
        "Run `git fsck` to check object integrity, or repair or re-clone the repository.",
      );
    });
  });

  describe("unmatched and empty", () => {
    it.each(["", "fatal: repository not found", "error: unknown git failure"])(
      "returns undefined for %#",
      (stderr) => {
        expect(formatGitStderrHint(stderr)).toBeUndefined();
      },
    );
  });

  describe("priority", () => {
    it("prefers since/date over shallow when both cues appear", () => {
      expect(
        formatGitStderrHint(
          "invalid date format and shallow clone not allowed",
        ),
      ).toBe(
        "Fix --since or config since — use a relative window (e.g. `12 months ago`) or an ISO date (YYYY-MM-DD).",
      );
    });

    it("prefers shallow over corrupt when both cues appear", () => {
      expect(
        formatGitStderrHint("shallow clone and corrupt object at abc"),
      ).toBe(
        "Deepen the clone with `git fetch --unshallow` or re-clone without --depth for full history.",
      );
    });

    it("prefers since/date over corrupt when both cues appear", () => {
      expect(
        formatGitStderrHint("bad date and corrupt object at abc"),
      ).toBe(
        "Fix --since or config since — use a relative window (e.g. `12 months ago`) or an ISO date (YYYY-MM-DD).",
      );
    });
  });
});
