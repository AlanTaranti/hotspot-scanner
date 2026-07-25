const RESET = "\x1b[0m";
const RED = "\x1b[31m";
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
