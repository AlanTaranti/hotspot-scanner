/** Uniformly sample items, preserving endpoints when truncating. */
export function uniformSample<T>(items: readonly T[], max: number): T[] {
  if (max <= 0 || items.length === 0) {
    return [];
  }

  if (items.length <= max) {
    return [...items];
  }

  if (max === 1) {
    return [items[0]!];
  }

  const result: T[] = [];
  for (let i = 0; i < max; i += 1) {
    const index = Math.round((i * (items.length - 1)) / (max - 1));
    result.push(items[index]!);
  }

  return result;
}
