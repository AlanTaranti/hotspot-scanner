// Fixture: logical-ops.ts
// Provenance: hand-crafted
// Expected: functionCount=1, cyclomaticComplexity=4 (&&, ||, ?? = 3 nodes + base 1)

export function check(a: boolean, b: boolean, c: boolean | undefined): boolean {
  return (a && b) || (c ?? false);
}
