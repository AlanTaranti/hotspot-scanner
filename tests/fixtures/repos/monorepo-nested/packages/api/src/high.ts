import { apiMedium } from "./medium";

export function apiHigh(a: number, b: number, c: number): number {
  if (a > 0) {
    if (b > 0) {
      for (let i = 0; i < a; i++) {
        if (c > i) {
          b += i;
        }
      }
    } else if (b < 0) {
      while (b < 0) {
        b++;
      }
    }
  } else if (a < 0) {
    switch (c) {
      case 1:
        return a + b;
      case 2:
        return a - b;
      default:
        return a * b;
    }
  }
  return a && b ? a + b : (c ?? apiMedium(0));
}

// api co-change 1

// api co-change 2

// api co-change 3

// extra churn on api high

// api co-change 1

// api co-change 2

// api co-change 3

// extra churn on api high
