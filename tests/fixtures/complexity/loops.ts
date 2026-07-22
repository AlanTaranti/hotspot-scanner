// Fixture: loops.ts
// Provenance: hand-crafted
// Expected: functionCount=1, cyclomaticComplexity=4 (for, while, do-while = 3 nodes + base 1)

export function run(): void {
  for (let i = 0; i < 3; i++) {}
  while (false) {}
  do {} while (false);
}
