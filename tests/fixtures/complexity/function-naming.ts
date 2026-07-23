// Expected per-function extraction results (functionName, line):
// - namedFunction: "namedFunction", L8
// - Example.bar (method): "bar", L12
// - Example.constructor: "constructor", L11
// - constArrow: "constArrow", L15
// - default export function: "<anonymous>:L17", L17

export function namedFunction(): void {}

export class Example {
  constructor() {}
  bar(): void {}
}

const constArrow = () => {};

export default function () {}
