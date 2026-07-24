# Pipeline Stage Overlap — Context

**Feature slug:** `pipeline-stage-overlap`  
**Milestone:** ROADMAP M34  
**Depth:** Large / Complex  
**Captured:** 2026-07-23 (planner-feature; user-locked + agent discretion)

---

## Locked by user (ROADMAP / session)

| Topic | Choice |
| ----- | ------ |
| Overlapping stages | **Git miner (numstat) ∥ Complexity analyzer only** |
| Function-churn | Stays **sequential after complexity** (needs `[line, endLine]` ranges) |
| Function-churn ∥ numstat | **Out of scope** this milestone (rename/alias complexity) |
| Rankings / JSON | **Unchanged** (`version: "1.0"`, same fields/order semantics) |
| Gate | `pnpm build && pnpm test` |
| ROADMAP / STATE edits | **Deferred** — do not sync in planning session |
| tasks.md Status | **Planned** — no Execute in this session |

---

## Decision: Cancel / error when a sibling stage fails

**Question:** When numstat or complexity fails during overlap, what happens to the other stage?

**Choice (agent discretion):** Orchestrator-owned `AbortController`. Start both stages with the same `signal`. On first rejection, `abort()` the sibling, then await sibling settlement (swallow abort-induced completion / attach as `cause` only if useful). Propagate the **original** failure (preserve `GitLogError` / analyzer errors). No unhandled promise rejections.

**Minimal plumbing:**

- Optional `signal?: AbortSignal` on `GitMiner` / `streamGitLog` → `child.kill()` on abort
- Optional `signal?: AbortSignal` on `ComplexityAnalyzer.analyze` / pool → terminate in-flight workers and stop scheduling new batches
- No new CLI flag; abort is internal to `runScan` failure paths only (no user cancel API in M34)

**Rationale:** ROADMAP requires “coherent cancel/error handling.” Fire-and-forget orphans violate RT-001 memory discipline. Full user-facing cancel is YAGNI.

---

## Decision: Progress phases during overlap

**Question:** Does overlapping change `ScanProgress` phases?

**Choice (agent discretion):** **Phases unchanged** — keep `"git" | "function-churn"` only. Complexity still has **no** progress callback (M28 YAGNI). During overlap, `phase: "git"` events may interleave with CPU work; stderr throttle remains every 1,000 commits **per phase**. Do **not** add `"complexity"` or `"overlap"` phases in M34.

**Rationale:** ROADMAP allows “unchanged or carefully extended”; unchanged minimizes diagnostics/contract churn and matches M28.

---

## Decision: Peak-memory trade-off documentation

**Question:** Where and how to document the trade-off?

**Choice (agent discretion):** Document in **ARCHITECTURE** data-flow (overlap note) and **CONCERNS** Performance (RT-001): overlapping stages hold git aggregates **and** complexity worker/AST batches concurrently → higher peak RSS than sequential `mine`→`analyze`. No CI memory gate; qualitative note for operators/benchmarks. Optional one-line README cross-link if ARCHITECTURE already linked from README perf notes.

---

## Decision: Barrier semantics (file vs function)

| Mode | After `git ∥ complexity` both settle successfully |
| ---- | -------------------------------------------------- |
| **file** | Then hotspot scoring + temporal coupling + static enrich (unchanged consumers) |
| **function** | Then **function-churn** (patch stream) using `functionComplexity` ranges → function hotspot scoring; coupling still uses **numstat** `coChangeEvents` / `fileStats` (must wait for git) |

**Invariant:** Coupling and scoring never start until **both** overlapping stages complete successfully. Function-churn never starts until complexity completes (ranges). Function-churn never runs in parallel with numstat.

---

## Decision: Equivalence testing

**Choice (agent discretion):** Prove rankings/`meta` semantic equivalence vs pre-overlap behavior via fixture integration (same top hotspots / functions / coupling on `small-ts` under fixed options). Prove concurrency structurally in unit tests with mocked `mine`/`analyze` (barrier / call-order / overlapping in-flight), **not** flaky wall-clock asserts in CI.

---

## Explicit non-goals (context)

- Parallelizing function-churn with numstat or with complexity
- Changing scoring formulas, JSON schema, or warning codes
- User-facing cancel (`SIGINT` wiring beyond existing process death)
- CI wall-clock or peak-RSS thresholds
- M35 function-mode I/O restrictions / interval index

---

## Open items

None — no `PENDENTE-DISCUSSÃO`. Ready for Design / Tasks.
