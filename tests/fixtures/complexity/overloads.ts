// Fixture: overloads.ts
// Provenance: hand-crafted (M29)
// Expected: functionCount=3, cyclomaticComplexity=4
// M29: body-less overload stubs excluded (two function signatures + two method stubs absent)
//   - overloaded implementation (L11): typeof if=1 + base 2
//   - method implementation (L19): base 1
//   - abstract get foo (L25): base 1 (M22 empty-body policy)

function overloaded(x: string): string;
function overloaded(x: number): number;
function overloaded(x: string | number) {
  if (typeof x === "string") return x;
  return x;
}

class Example {
  method(x: string): string;
  method(x: number): number;
  method(x: string | number) {
    return String(x);
  }
}

abstract class AbstractExample {
  abstract get foo(): number;
}
