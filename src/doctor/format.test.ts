import { describe, expect, it } from "vitest";
import { stripAnsi } from "../report/color.js";
import {
  formatDoctorJsonReport,
  formatDoctorTextReport,
  type DoctorJsonReport,
} from "./format.js";
import type { DoctorFinding, DoctorResult } from "./index.js";

function parseReport(output: string): DoctorJsonReport {
  return JSON.parse(output) as DoctorJsonReport;
}

describe("formatDoctorTextReport", () => {
  const findings: DoctorFinding[] = [
    { id: "node-engines", status: "pass", message: "Node ok" },
    { id: "config", status: "warn", message: "missing config" },
    { id: "git-repo", status: "fail", message: "not a repo" },
  ];

  it("formats status: message lines without color when disabled", () => {
    expect(formatDoctorTextReport(findings, { color: false })).toBe(
      "pass: Node ok\nwarn: missing config\nfail: not a repo\n",
    );
  });

  it("colors only the status prefix when enabled", () => {
    const colored = formatDoctorTextReport(findings, { color: true });

    expect(colored).toContain("\x1b[32mpass:\x1b[0m Node ok");
    expect(colored).toContain("\x1b[33mwarn:\x1b[0m missing config");
    expect(colored).toContain("\x1b[31mfail:\x1b[0m not a repo");
  });

  it("stripAnsi(colored) equals plain output", () => {
    const plain = formatDoctorTextReport(findings, { color: false });
    const colored = formatDoctorTextReport(findings, { color: true });

    expect(stripAnsi(colored)).toBe(plain);
  });

  it("ends output with a trailing newline", () => {
    expect(
      formatDoctorTextReport([], { color: false }).endsWith("\n"),
    ).toBe(true);
  });
});

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
