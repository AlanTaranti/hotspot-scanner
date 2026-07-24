// Fixture: object-literal-methods.ts
// Provenance: hand-crafted
// Expected: functionCount=3, cyclomaticComplexity=4
//   - bar (L9): base 1
//   - baz (L12): if=1 + base 2
//   - inner (L17): base 1

export const handlers = {
  bar() {
    return 1;
  },
  baz: () => {
    if (true) return 2;
    return 3;
  },
  nested: {
    inner() {
      return 1;
    },
  },
};
