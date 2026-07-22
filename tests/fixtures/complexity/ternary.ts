// Fixture: ternary.ts
// Provenance: hand-crafted
// Expected: functionCount=1, cyclomaticComplexity=2 (ternary=1 + base 1)

export function pick(x: boolean): number {
  return x ? 1 : 0;
}
