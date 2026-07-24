// Fixture: object-literal-accessors.ts
// Provenance: hand-crafted (M29)
// Expected: functionCount=3, cyclomaticComplexity=6
//   - get foo (L9): base 1
//   - set foo (L12): if=1 + base 2
//   - get label (L17): if=1, else if=1 + base 3

export const handlers = {
  get foo() {
    return 1;
  },
  set foo(value: number) {
    if (value > 0) {
      //
    }
  },
  get label() {
    if (true) {
      return "a";
    } else if (false) {
      return "b";
    }
    return "c";
  },
};
