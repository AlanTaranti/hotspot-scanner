export type IndentationMetrics = {
  n: number;
  total: number;
  mean: number;
  sd: number;
  max: number;
};

function isBlankLine(line: string): boolean {
  return line.trim().length === 0;
}

/** Measure logical indent level: tab = 1 level; every 4 spaces = 1 level. */
function measureIndentLevel(line: string): number {
  let level = 0;
  let spaceCount = 0;

  for (const char of line) {
    if (char === "\t") {
      if (spaceCount > 0) {
        level += Math.floor(spaceCount / 4);
        spaceCount = 0;
      }
      level += 1;
    } else if (char === " ") {
      spaceCount += 1;
    } else {
      break;
    }
  }

  if (spaceCount > 0) {
    level += Math.floor(spaceCount / 4);
  }

  return level;
}

/** Tornhill-style whitespace complexity from leading indentation per non-blank line. */
export function analyzeIndentation(source: string): IndentationMetrics {
  const lines = source.split(/\r?\n/);
  const levels: number[] = [];

  for (const line of lines) {
    if (isBlankLine(line)) {
      continue;
    }
    levels.push(measureIndentLevel(line));
  }

  const n = levels.length;
  if (n === 0) {
    return { n: 0, total: 0, mean: 0, sd: 0, max: 0 };
  }

  const total = levels.reduce((sum, level) => sum + level, 0);
  const mean = total / n;
  const max = Math.max(...levels);
  const variance =
    levels.reduce((sum, level) => sum + (level - mean) ** 2, 0) / n;
  const sd = Math.sqrt(variance);

  return { n, total, mean, sd, max };
}
