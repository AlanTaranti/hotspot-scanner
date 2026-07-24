# Milestone 6 — Integration Context

**Feature slug:** `integration`  
**Captured:** 2026-07-22  
**Trigger:** Deferred decisions from M2–M5 specs, ROADMAP M6 scope, IMPL §9

---

## Decision: No orchestration intersection filter

**Question:** M4 deferred "intersect git paths with complexity paths" to M6. Should `runScan()` restrict complexity analysis to files present in `fileStats`?

**Choice:** **No intersection filter** — keep M3 `discoverSourceFiles()` behavior (all eligible TS/JS in working tree); M4 hotspot scorer uses `ComplexityResult[]` as driver; missing `fileStats` → churn 0.

**Rationale:**

- M4 `scoreHotspots()` already handles missing git stats per file
- Filtering at orchestration would require API changes to `ComplexityAnalyzer` or post-filtering results — YAGNI for v1
- Files with complexity but no git history still appear with zero churn (valid signal)

**Status:** **Confirmed** — implementer does not add intersection logic in `src/scan.ts`.

**Applies to:** `runScan()` pipeline wiring (T3).

---

## Decision: `runScan` returns full ranked lists

**Question:** Should `runScan()` apply `--top` slicing before returning `ScanResult`?

**Choice:** **No** — return complete sorted arrays from scorers; reporter and CLI apply `top` via `createReporter().render(result, { top })` (M5 D3).

**Rationale:**

- Keeps `runScan()` a pure pipeline orchestrator
- Library consumers (`import { runScan }`) get full data; display limit is presentation concern
- M5 tests and reporter already own slicing in `src/report/slice.ts`

**Applies to:** T3, T4 integration assertions (assert full list length ≥ 1, not sliced count).

---

## Decision: Sequential pipeline stages

**Question:** Can git mining and complexity analysis run in parallel?

**Choice:** **Sequential** — git mine → complexity analyze → score (both scorers after both inputs ready).

**Rationale:**

- Matches [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md) data-flow diagram
- Complexity does not depend on git output for file discovery (working tree only)
- Parallelism deferred per STATE.md; sequential is simpler to test and reason about

**Applies to:** T3 implementation order.

---

## Decision: P1 fixture scope — `small-ts` only

**Question:** How many versioned Git fixture repos are required for M6 MVP?

**Choice:** **P1: `tests/fixtures/repos/small-ts/` only.** P2: `with-renames/` and `merge-heavy/` in T6.

**Rationale:**

- ROADMAP bullet is singular ("Full scan on versioned Git fixture repo")
- `small-ts` proves end-to-end wiring; rename/merge scenarios have unit coverage in `tests/fixtures/git-log/`
- P2 fixtures reduce T1 blocking time for core pipeline delivery

**Applies to:** T1 (P1), T6 (P2).

---

## Decision: Benchmark without CI time threshold

**Question:** Should M6 add a performance regression gate (max milliseconds) to `pnpm test`?

**Choice:** **No CI threshold** — document manual benchmark procedure; operator records qualitative timing.

**Rationale:**

- IMPL §9: "Script de benchmark manual, não necessariamente no CI"
- CI runners vary; flaky timing gates harm developer experience
- RT-001 mitigated by manual check before v1 release declaration

**Applies to:** T2 (`scripts/benchmark-scan.md` or equivalent).

---

## Decision: E2E test strategy — real git, no scan mocks

**Question:** Should integration tests mock `GitMiner` at the `runScan()` level?

**Choice:** **Real fixture repo** for `runScan` integration tests; mock git only at `GitMiner` adapter boundary in unit tests (existing TESTING.md rule).

**Rationale:**

- M6 goal is proving wiring, not re-testing miner/analyzer in isolation
- `tests/fixtures/repos/small-ts/` is small and fast
- CLI integration test may use `runCli` or subprocess against built binary

**Applies to:** T4, T5.

---

## Decision: Optional dependency injection in `runScan`

**Question:** Should `runScan()` accept injected factories for testability?

**Choice:** **Default factories only in v1** — `createGitMiner()`, `createComplexityAnalyzer()`, scorers called directly. Add optional `deps` parameter only if T4 implementer needs it for git-failure tests without polluting integration tests.

**Rationale:**

- Integration tests use real modules on fixture
- Git failure can be tested with a non-git temp directory (path validation) or temp dir without `.git` causing spawn failure
- YAGNI — avoid over-abstracting orchestrator

**Applies to:** T3 design; T4 test plan.

---

## Related closed decisions (STATE.md)

| Decision                  | Value                     | Relevance to M6                                |
| ------------------------- | ------------------------- | ---------------------------------------------- |
| Default `--since`         | `"12 months ago"`         | Fixture commit dates + integration test window |
| Default `--min-cochange`  | `3`                       | Fixture co-change pair design                  |
| Default `--top`           | `20`                      | Not applied in `runScan`; CLI/reporter only    |
| Exit code on success      | `0`                       | CLI integration test                           |
| Rename via `PathAliasMap` | Not `--follow` global log | P2 `with-renames` fixture validates E2E        |
| Requirement ID start      | `HOTSPOT-51`              | Continues after M5 (`HOTSPOT-50`)              |
