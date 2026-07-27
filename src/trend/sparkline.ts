const GLYPHS = "▁▂▃▄▅▆▇█";

/** Map numeric series to an ASCII sparkline using min–max scaling. */
export function sparkline(values: number[]): string {
  if (values.length === 0) {
    return "";
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return GLYPHS[Math.floor((GLYPHS.length - 1) / 2)]!.repeat(values.length);
  }

  const range = max - min;
  let result = "";

  for (const value of values) {
    const normalized = (value - min) / range;
    const index = Math.min(
      GLYPHS.length - 1,
      Math.max(0, Math.round(normalized * (GLYPHS.length - 1))),
    );
    result += GLYPHS[index]!;
  }

  return result;
}
