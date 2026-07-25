import type { DoctorFinding, DoctorResult } from "./index.js";

export interface DoctorJsonReport {
  version: "1.0";
  findings: DoctorFinding[];
  exitCode: 0 | 1 | 2;
}

export function formatDoctorJsonReport(result: DoctorResult): string {
  const payload: DoctorJsonReport = {
    version: "1.0",
    findings: result.findings,
    exitCode: result.exitCode,
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}
