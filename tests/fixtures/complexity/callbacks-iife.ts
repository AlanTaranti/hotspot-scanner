// Fixture: callbacks-iife.ts
// Provenance: hand-crafted (M50)
// Expected: functionCount=6, cyclomaticComplexity=12
//   - usesCallbacks (L11): nested if×2 + base 1 = 3
//   - <anonymous>:L12 (L12): if=1 + base 1 = 2
//   - <anonymous>:L16 (L16): if=1 + base 1 = 2
//   - usesIife (L22): nested if×1 + base 1 = 2
//   - <anonymous>:L23 (L23): if=1 + base 1 = 2
//   - <anonymous>:L28 (L28): base 1

export function usesCallbacks() {
  setTimeout(function timer() {
    if (Date.now() > 0) return;
  }, 0);

  doWork(() => {
    if (true) return 1;
    return 0;
  });
}

export function usesIife() {
  const x = (function () {
    if (false) return 0;
    return 1;
  })();

  const y = (() => {
    return 2;
  })();

  return x + y;
}
