// Fixture: assignment-callables.ts
// Provenance: hand-crafted (M29)
// Expected: functionCount=4, cyclomaticComplexity=6
//   - handler (L9): if=1 + base 2
//   - foo (L14): base 1
//   - fn (L18): ternary=1 + base 2
//   - <anonymous>:L20 (L20): base 1

handler = function named() {
  if (true) return 1;
  return 0;
};

exports.foo = function () {
  return 2;
};

obj.fn = () => (true ? 3 : 4);

obj[key] = () => 4;
