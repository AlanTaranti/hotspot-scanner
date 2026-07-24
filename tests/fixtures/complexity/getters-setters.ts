// Fixture: getters-setters.ts
// Provenance: hand-crafted
// Expected: functionCount=3, cyclomaticComplexity=6
//   - get count (L9): base 1
//   - set count (L13): if=1 + base 2
//   - get label (L19): if=1, else if=1 + base 3

export class Counter {
  get count() {
    return 1;
  }

  set count(value: number) {
    if (value > 0) {
      //
    }
  }

  get label() {
    if (true) {
      return "a";
    } else if (false) {
      return "b";
    }
    return "c";
  }
}
