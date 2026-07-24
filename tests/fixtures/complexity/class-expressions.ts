// Fixture: class-expressions.ts
// Provenance: hand-crafted (M29)
// Expected: functionCount=5, cyclomaticComplexity=7
//   - constructor (L11): base 1
//   - method (L12): if=1 + base 2
//   - get count (L16): base 1
//   - set count (L19): if=1 + base 2
//   - arrowField (L24): base 1

export const Example = class {
  constructor() {}
  method() {
    if (true) return 1;
    return 0;
  }
  get count() {
    return 1;
  }
  set count(value: number) {
    if (value > 0) {
      //
    }
  }
  arrowField = () => 3;
};
