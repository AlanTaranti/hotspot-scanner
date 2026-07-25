import { describe, expect, it } from "vitest";
import { formatDoctorJsonReport, type DoctorJsonReport } from "./format.js";
import type { DoctorResult } from "./index.js";

function parseReport(output: string): DoctorJsonReport {
  return JSON.parse(output) as DoctorJsonReport;
}

describe("formatDoctorJsonReport", () => {
  it("serializes the locked envelope with version, findings, and exitCode", () => {
    const result: DoctorResult = {
      findings: [
        {
          id: "node-engines",
          status: "pass",
          message: "Node v22.0.0 satisfies engines.node (>=22)",
        },
      ],
      exitCode: 0,
    };

    const parsed = parseReport(formatDoctorJsonReport(result));

    expect(parsed).toEqual({
      version: "1.0",
      findings: result.findings,
      exitCode: 0,
    });
  });

  it("preserves all finding fields across mixed statuses", () => {
    const findings = [
      { id: "node-engines" as const, status: "pass" as const, message: "ok" },
      { id: "config" as const, status: "warn" as const, message: "missing config" },
      { id: "git-repo" as const, status: "fail" as const, message: "not a repo" },
      { id: "scope" as const, status: "pass" as const, message: "eligible files: 3" },
    ];
    const result: DoctorResult = { findings, exitCode: 1 };

    const parsed = parseReport(formatDoctorJsonReport(result));

    expect(parsed.findings).toEqual(findings);
    expect(parsed.exitCode).toBe(1);
    expect(parsed.version).toBe("1.0");
  });

  it("includes non-zero exit codes without altering findings", () => {
    const result: DoctorResult = {
      findings: [
        { id: "config", status: "fail", message: "Invalid JSON in config" },
      ],
      exitCode: 2,
    };

    const parsed = parseReport(formatDoctorJsonReport(result));

    expect(parsed.exitCode).toBe(2);
    expect(parsed.findings).toEqual(result.findings);
  });

  it("ends output with a trailing newline", () => {
    const result: DoctorResult = { findings: [], exitCode: 0 };

    expect(formatDoctorJsonReport(result).endsWith("\n")).toBe(true);
  });
});
