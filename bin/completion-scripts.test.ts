import { describe, expect, it } from "vitest";
import { CliUsageError } from "./scan-actions.js";
import {
  COMPLETION_SHELLS,
  getCompletionScript,
} from "./completion-scripts.js";

const LOCKED_COMMANDS = [
  "init",
  "doctor",
  "trend",
  "scan",
  "completion",
] as const;

const REPRESENTATIVE_TREND_FLAGS = [
  "--since",
  "--max-revisions",
  "--all",
  "--follow",
  "--format",
  "--output",
] as const;

const REPRESENTATIVE_SCAN_FLAGS = [
  "--format",
  "--output",
  "--exclude",
  "--include",
  "--config",
  "--since",
  "--warnings",
] as const;

const MILESTONE_FLAGS = [
  "--quiet",
  "--verbose",
  "--no-progress",
  "--fail-on-explain-miss",
  "--csv-single-file",
] as const;

const WARNINGS_JSON_TEXT = "summary|full|json";

function expectWarningsJsonText(shell: string, script: string): void {
  if (shell === "bash") {
    expect(script).toContain("--warnings");
    return;
  }
  expect(script).toContain(WARNINGS_JSON_TEXT);
}

function expectCompletionScriptBasics(script: string): void {
  for (const command of LOCKED_COMMANDS) {
    expect(script).toContain(command);
  }
  for (const flag of REPRESENTATIVE_SCAN_FLAGS) {
    expect(script).toContain(flag);
  }
  for (const flag of REPRESENTATIVE_TREND_FLAGS) {
    expect(script).toContain(flag);
  }
  expect(script).not.toContain("--granularity");
  expect(script).not.toContain("functions");
  expect(script).not.toContain("--baseline");
  expect(script).not.toContain("--strict");
  expect(script).not.toContain("baseline");
  expect(script).not.toContain("compare");
}

describe("getCompletionScript", () => {
  it.each(COMPLETION_SHELLS)(
    "returns a non-empty %s script with commands and flags",
    (shell) => {
      const script = getCompletionScript(shell);

      expect(script.length).toBeGreaterThan(0);
      expectCompletionScriptBasics(script);
    },
  );

  it.each(COMPLETION_SHELLS)(
    "%s script includes milestone flags and warnings json text",
    (shell) => {
      const script = getCompletionScript(shell);

      for (const flag of MILESTONE_FLAGS) {
        expect(script).toContain(flag);
      }
      expectWarningsJsonText(shell, script);
    },
  );

  it("rejects unknown shells with CliUsageError listing allowed shells", () => {
    expect(() => getCompletionScript("powershell")).toThrow(CliUsageError);
    expect(() => getCompletionScript("powershell")).toThrow(/Invalid shell/);
    expect(() => getCompletionScript("powershell")).toThrow(/bash/);
    expect(() => getCompletionScript("powershell")).toThrow(/zsh/);
    expect(() => getCompletionScript("powershell")).toThrow(/fish/);
  });
});
