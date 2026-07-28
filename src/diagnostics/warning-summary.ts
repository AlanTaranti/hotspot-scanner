import type { DiagnosticSeverity, ScanWarning } from "../types/domain.js";
import {
  NEXT_STEP_AMBIGUOUS,
  NEXT_STEP_UNLINKED,
  RENAME_AMBIGUOUS_PREFIX,
  RENAME_SINCE_TRUNCATION_PREFIX,
  RENAME_UNLINKED_PREFIX,
  RENAME_UNLINKED_REMAINDER_PREFIX,
} from "../git/rename-warnings.js";

export type WarningsMode = "summary" | "full" | "json";

export type WarningSubKind =
  | "ambiguous"
  | "unlinked"
  | "since-truncation"
  | "default";

export interface WarningClassification {
  code: string;
  subKind: WarningSubKind;
}

const RENAME_CODE = "RENAME_HISTORY_INCOMPLETE";
const UNLINKED_REMAINDER_COUNT =
  /^\.\.\. and (\d+) more suspected unlinked rename/;

const SEVERITY_PREFIX: Record<DiagnosticSeverity, string> = {
  info: "info",
  warning: "warning",
  error: "error",
};

const SEVERITY_RANK: Record<DiagnosticSeverity, number> = {
  info: 0,
  warning: 1,
  error: 2,
};

export function classifyWarning(warning: ScanWarning): WarningClassification {
  const code = warning.code ?? "UNKNOWN";
  if (code !== RENAME_CODE) {
    return { code, subKind: "default" };
  }

  const { message } = warning;
  if (message.startsWith(RENAME_AMBIGUOUS_PREFIX)) {
    return { code, subKind: "ambiguous" };
  }
  if (
    message.startsWith(RENAME_UNLINKED_PREFIX) ||
    message.startsWith(RENAME_UNLINKED_REMAINDER_PREFIX)
  ) {
    return { code, subKind: "unlinked" };
  }
  if (message.startsWith(RENAME_SINCE_TRUNCATION_PREFIX)) {
    return { code, subKind: "since-truncation" };
  }
  return { code, subKind: "default" };
}

function groupKey(classification: WarningClassification): string {
  return `${classification.code}\0${classification.subKind}`;
}

function unlinkedPairContribution(warning: ScanWarning): number {
  const match = UNLINKED_REMAINDER_COUNT.exec(warning.message);
  if (match) {
    return Number(match[1]);
  }
  return 1;
}

function highestSeverity(warnings: ScanWarning[]): DiagnosticSeverity {
  let best: DiagnosticSeverity = "info";
  for (const warning of warnings) {
    if (SEVERITY_RANK[warning.severity] > SEVERITY_RANK[best]) {
      best = warning.severity;
    }
  }
  return best;
}

function truncateGist(message: string, maxLen = 80): string {
  const trimmed = message.trim();
  if (trimmed.length <= maxLen) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLen - 1)}…`;
}

function formatRenameSummaryLine(
  subKind: WarningSubKind,
  count: number,
  severity: DiagnosticSeverity,
  warnings: ScanWarning[],
): string {
  const prefix = SEVERITY_PREFIX[severity];
  if (subKind === "ambiguous") {
    return `${prefix}: Rename history may be incomplete for ${count} path(s).${NEXT_STEP_AMBIGUOUS}\n`;
  }
  if (subKind === "unlinked") {
    return `${prefix}: Suspected unlinked rename (no git rename metadata): ${count} pair(s).${NEXT_STEP_UNLINKED}\n`;
  }
  // since-truncation: prefer original when count is 1
  if (count === 1) {
    return `${prefix}: ${warnings[0]!.message}\n`;
  }
  return `${prefix}: ${count} ${RENAME_CODE}: ${truncateGist(warnings[0]!.message)}\n`;
}

function formatDefaultSummaryLine(
  code: string,
  count: number,
  severity: DiagnosticSeverity,
  warnings: ScanWarning[],
): string {
  const prefix = SEVERITY_PREFIX[severity];
  if (count === 1) {
    return `${prefix}: ${warnings[0]!.message}\n`;
  }
  return `${prefix}: ${count} ${code}: ${truncateGist(warnings[0]!.message)}\n`;
}

interface BufferedGroup {
  classification: WarningClassification;
  warnings: ScanWarning[];
  /** Logical count (paths / pairs / warnings). */
  count: number;
}

/** Write one JSON document with the full buffered warnings array. */
export function flushWarningsJson(buffer: ScanWarning[]): void {
  if (buffer.length > 0) {
    process.stderr.write("\n");
  }
  process.stderr.write(`${JSON.stringify({ warnings: buffer })}\n`);
}

/** Group buffered warnings and write one stderr line per group. */
export function flushWarningSummary(buffer: ScanWarning[]): void {
  if (buffer.length === 0) {
    return;
  }

  const groups = new Map<string, BufferedGroup>();
  const order: string[] = [];

  for (const warning of buffer) {
    const classification = classifyWarning(warning);
    const key = groupKey(classification);
    let group = groups.get(key);
    if (!group) {
      group = { classification, warnings: [], count: 0 };
      groups.set(key, group);
      order.push(key);
    }
    group.warnings.push(warning);
    if (classification.subKind === "unlinked") {
      group.count += unlinkedPairContribution(warning);
    } else {
      group.count += 1;
    }
  }

  process.stderr.write("\n");

  for (const key of order) {
    const group = groups.get(key)!;
    const { classification, warnings, count } = group;
    const severity = highestSeverity(warnings);
    const { code, subKind } = classification;

    if (code === RENAME_CODE && subKind !== "default") {
      process.stderr.write(
        formatRenameSummaryLine(subKind, count, severity, warnings),
      );
      continue;
    }

    process.stderr.write(
      formatDefaultSummaryLine(code, count, severity, warnings),
    );
  }
}
