# Milestone 15 — AST Parallelization Context

**Feature slug:** `ast-parallelization`  
**Captured:** 2026-07-23  
**Trigger:** ROADMAP M15 scope, STATE.md §Deferred worker-thread parallelization, RT-001 performance concerns

---

## Decision: Parallelism unit = batch (not file)

**Question:** What is the unit of parallel work — individual files or existing batches?

**Choice:** **Batch-level parallelism** — each worker receives one batch (≤50 files), instantiates a fresh `ts-morph` `Project`, and runs the existing `analyzeBatch` logic.

**Rationale:**

- Aligns with M3 design decision D7 (fresh `Project` per batch for heap bounds)
- Avoids shared mutable AST state across threads (ts-morph is not thread-safe)
- Minimizes refactor — `analyzeBatch` in `index.ts` becomes the worker payload boundary
- File-level parallelism within a batch would share one `Project` or multiply project overhead without clear gain

**Status:** **Confirmed**

**Applies to:** T1 worker entry, design D1, HOTSPOT-113.

---

## Decision: No CLI flags for concurrency or batch size

**Question:** Should M15 expose `--workers` or `--batch-size`?

**Choice:** **No CLI flags** — concurrency and batch size remain internal constants (`DEFAULT_WORKER_CONCURRENCY`, `DEFAULT_BATCH_SIZE`).

**Rationale:**

- YAGNI — ROADMAP does not require user-facing tuning
- Benchmark can document internal defaults; add flags only if a future milestone proves need
- Keeps CLI surface unchanged; reduces test matrix

**Status:** **Confirmed**

**Applies to:** spec Out of Scope, HOTSPOT-113, HOTSPOT-119.

---

## Decision: Pipeline stages remain sequential

**Question:** Should git mining and complexity analysis overlap now that complexity parallelizes internally?

**Choice:** **No** — `runScan()` keeps `git mine → complexity analyze → score` sequential. M15 parallelizes only inside `src/complexity/`.

**Rationale:**

- Matches [integration/context.md](../integration/context.md) closed decision
- Complexity discovery uses working tree, not git output — stage overlap adds coordination cost without clear win
- Scope boundary keeps M15 focused on RT-001 AST CPU bottleneck

**Status:** **Confirmed**

**Applies to:** spec Out of Scope, HOTSPOT-116.

---

## Decision: Default concurrency cap

**Question:** What should the default worker pool size be?

**Choice:** **`min(os.availableParallelism(), 4)`** — use available cores but cap at 4 to limit memory (N workers × batch heap).

**Rationale:**

- `availableParallelism()` adapts to container/CI core count
- Cap at 4 prevents memory spike on large repos (4 × 50 files × ts-morph AST)
- Overridable via `ComplexityAnalyzerDependencies.concurrency` for tests

**Status:** **Confirmed**

**Applies to:** design D4, HOTSPOT-113, HOTSPOT-117.

---

## Decision: Benchmark remains manual only

**Question:** Should M15 add CI performance thresholds?

**Choice:** **No** — update `scripts/benchmark-scan.md` with qualitative before/after notes only. No millisecond gate in `pnpm test`.

**Rationale:**

- [integration/context.md](../integration/context.md) C5 — CI runners vary; wall-clock not gated
- ROADMAP M15 does not require automated perf regression detection
- Operator records qualitative judgment on developer laptop

**Status:** **Confirmed**

**Applies to:** HOTSPOT-119, T6 docs.

---

## Decision: Requirement ID range

**Question:** Which HOTSPOT IDs does M15 use?

**Choice:** **HOTSPOT-113 through HOTSPOT-120** (8 requirements), continuing after scan-compare HOTSPOT-112.

**Rationale:**

- Project convention: sequential IDs per milestone
- scan-compare (M13) consumed HOTSPOT-103..112

**Status:** **Confirmed**

**Applies to:** spec.md traceability table, tasks.md.

---

## Decision: Sequential fallback for small repos

**Question:** When should workers be avoided entirely?

**Choice:** WHEN `concurrency === 1` OR `batches.length <= 1` THEN process inline without worker spawn overhead.

**Rationale:**

- Fixture repos and unit tests benefit from fast path
- Worker thread startup cost not justified for ≤50 files
- Equivalence testing can compare inline vs pool with `concurrency: 1`

**Status:** **Confirmed**

**Applies to:** design D6, HOTSPOT-113, HOTSPOT-117.
