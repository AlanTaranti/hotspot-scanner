// Fixture: switch.ts
// Provenance: hand-crafted
// Expected: functionCount=1, cyclomaticComplexity=5 (3 cases + default = 4 nodes + base 1)

export function label(n: number): string {
  switch (n) {
    case 1:
      return "one";
    case 2:
      return "two";
    case 3:
      return "three";
    default:
      return "other";
  }
}
