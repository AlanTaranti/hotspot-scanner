// Fixture: class-field-arrows.ts
// Provenance: hand-crafted
// Expected: functionCount=3, cyclomaticComplexity=5
//   - simple (L9): base 1
//   - branch (L10): if=1 + base 2
//   - fnField (L14): for=1 + base 2

export class Example {
  simple = () => 1;
  branch = () => {
    if (true) return 1;
    return 0;
  };
  fnField = function () {
    for (let i = 0; i < 1; i++) {}
  };
  notAFunction = 42;
}
