export function high(a: number, b: number, c: number): number {
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
  return a && b ? a + b : (c ?? 0);
}

// co-change 1

// co-change 2

// co-change 3

// extra churn on high
