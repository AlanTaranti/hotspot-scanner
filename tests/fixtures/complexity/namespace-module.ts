// Fixture: namespace-module.ts
// Provenance: hand-crafted (M29 / HOTSPOT-290)
// Expected: functionCount=3, cyclomaticComplexity=5
// Regression: namespace/module bodies already collected — no M29 collector change
//   - N.f (L10): if=1 + base 2
//   - N.g (L15): base 1
//   - M.h (L19): for=1 + base 2

namespace N {
  export function f() {
    if (true) return 1;
    return 0;
  }

  export function g() {}
}

module M {
  export function h() {
    for (let i = 0; i < 1; i++) {
      //
    }
  }
}
