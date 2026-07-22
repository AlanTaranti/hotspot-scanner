// Fixture: if-else.ts
// Provenance: hand-crafted
// Expected: functionCount=1, cyclomaticComplexity=3 (if=1, else if=1, base=1)

export function check(x: number): string {
  if (x < 0) {
    return "negative";
  } else if (x === 0) {
    return "zero";
  } else {
    return "positive";
  }
}
