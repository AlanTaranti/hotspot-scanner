import { provide } from "@app/provider";

export function consume(): number {
  return provide();
}

// co-change 1

// co-change 2

// co-change 3

// consumer-orphan co-change 1

// consumer-orphan co-change 2

// consumer-orphan co-change 3

// extra churn on consumer
