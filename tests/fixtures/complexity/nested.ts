// Fixture: nested.ts
// Provenance: hand-crafted
// Expected: functionCount=2, cyclomaticComplexity=3 (outer: if=1+base=2, inner: base=1, sum=3)

export function outer(x: number): number {
  if (x > 0) {
    function inner(): number {
      return 1;
    }
    return inner();
  }
  return 0;
}
