/** Apply log1p then min-max to [0, 1]. Degenerate (all equal) → all 0. */
export function normalizeLogMinMax(values: number[]): number[] {
  if (values.length === 0) {
    return [];
  }

  const transformed = values.map((value) => Math.log1p(value));
  const min = Math.min(...transformed);
  const max = Math.max(...transformed);

  if (max === min) {
    return values.map(() => 0);
  }

  return transformed.map((value) => (value - min) / (max - min));
}
