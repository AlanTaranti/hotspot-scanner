const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM_GREEN = "\x1b[2;32m";
const DIM_YELLOW = "\x1b[2;33m";

const SCORE_DECIMALS = 4;
const SCORE_BAND_HIGH = 0.7;
const SCORE_BAND_MEDIUM = 0.4;

const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

/** Format a score/strength value with optional ANSI band color (red ≥0.7, yellow ≥0.4). */
export function paintScore(score: number, enabled: boolean): string {
  const text = score.toFixed(SCORE_DECIMALS);
  if (!enabled) {
    return text;
  }
  if (score >= SCORE_BAND_HIGH) {
    return `${RED}${text}${RESET}`;
  }
  if (score >= SCORE_BAND_MEDIUM) {
    return `${YELLOW}${text}${RESET}`;
  }
  return text;
}

/** Wrap text in bold when enabled. */
export function paintBold(text: string, enabled: boolean): string {
  if (!enabled) {
    return text;
  }
  return `${BOLD}${text}${RESET}`;
}

export type GrowthPatternKind =
  | "deteriorating"
  | "refactored"
  | "stable"
  | "inconclusive";

/** Color growth-pattern kind token (deteriorating red, refactored green, inconclusive yellow, stable plain). */
export function paintGrowthPattern(
  kind: GrowthPatternKind,
  enabled: boolean,
): string {
  if (!enabled) {
    return kind;
  }
  switch (kind) {
    case "deteriorating":
      return `${RED}${kind}${RESET}`;
    case "refactored":
      return `${GREEN}${kind}${RESET}`;
    case "inconclusive":
      return `${YELLOW}${kind}${RESET}`;
    case "stable":
      return kind;
  }
}

/** Color doctor status prefix (`pass:` green, `warn:` yellow, `fail:` red). */
export function paintDoctorStatus(
  status: "pass" | "warn" | "fail",
  enabled: boolean,
): string {
  const prefix = `${status}:`;
  if (!enabled) {
    return prefix;
  }
  switch (status) {
    case "pass":
      return `${GREEN}${prefix}${RESET}`;
    case "warn":
      return `${YELLOW}${prefix}${RESET}`;
    case "fail":
      return `${RED}${prefix}${RESET}`;
  }
}

/** Color StaticDep display text (`yes` dim green, `no` dim yellow). */
export function paintStaticDep(text: string, enabled: boolean): string {
  if (!enabled) {
    return text;
  }
  if (text === "yes") {
    return `${DIM_GREEN}${text}${RESET}`;
  }
  if (text === "no") {
    return `${DIM_YELLOW}${text}${RESET}`;
  }
  return text;
}

/** Remove ANSI escape sequences (for layout assertions in tests). */
export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, "");
}
