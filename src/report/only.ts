export type ReportSection = "hotspots";

export const ALL_REPORT_SECTIONS: readonly ReportSection[] = [
  "hotspots",
] as const;

const VALID_SECTIONS = new Set<string>(ALL_REPORT_SECTIONS);

export function parseOnlySection(value: string): ReportSection {
  if (value.length === 0) {
    throw new Error("--only section must not be empty");
  }
  if (!VALID_SECTIONS.has(value)) {
    throw new Error(`Invalid --only: ${value}. Expected hotspots.`);
  }
  return value as ReportSection;
}

export function collectOnly(
  value: string,
  previous: readonly ReportSection[],
): ReportSection[] {
  return [...previous, parseOnlySection(value)];
}

export function normalizeOnly(
  only?: readonly ReportSection[],
): ReadonlySet<ReportSection> {
  if (only === undefined || only.length === 0) {
    return new Set(ALL_REPORT_SECTIONS);
  }
  return new Set(only);
}

export function includesSection(
  onlySet: ReadonlySet<ReportSection>,
  section: ReportSection,
): boolean {
  return onlySet.has(section);
}
