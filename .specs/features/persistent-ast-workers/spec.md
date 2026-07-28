# Milestone 31 — Persistent AST Workers Specification

**Feature slug:** `persistent-ast-workers`  
**Milestone:** ROADMAP M31  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md) (§ Complexity stage parallelism), [CONCERNS.md](../../codebase/CONCERNS.md) (§ Performance / RT-001, RT-005), [TESTING.md](../../codebase/TESTING.md)  
**Sisters:** [ast-parallelization](../ast-parallelization/) (M15 spawn-per-batch pool), [perf-diagnostics-ux](../perf-diagnostics-ux/) (M28 `--concurrency` wiring)  
**Depth:** Large

## Problem Statement

M15 parallelized complexity analysis with a bounded `worker_threads` pool, but each batch still pays a full cold start: `new Worker()` per batch plus a fresh ts-morph `Project` inside every `loadBatch`. On large TS/JS trees (many batches), spawn + compiler-host startup dominates wall time even when `--concurrency` is tuned. McCabe decision nodes and rankings must stay unchanged (RT-005); operators already control concurrency via M28 CLI/config.

M31 keeps the public `--concurrency` contract and replaces per-batch worker/Project construction with a persistent pool (N live workers + batch queue) and Project reuse across batches, locking the cheaper syntactic-diagnostics path.

## Goals

- [ ] Persistent worker pool: up to N live workers with a batch queue (no `new Worker()` per batch) — `src/complexity/pool.ts` / `worker.ts`
- [ ] Reuse one ts-morph `Project` per worker (or inline session) across batches with bounded heap — `src/complexity/project.ts` / `analyze-batch.ts`
- [ ] Lock cheaper syntactic diagnostics (`getProgram().getSyntacticDiagnostics(sourceFile)` per file); never semantic / pre-emit diagnostics — without changing McCabe decision nodes (RT-005)
- [ ] Preserve `concurrency === 1` and single-batch inline fallback; `--concurrency` CLI/config semantics unchanged
- [ ] Output equivalence vs current analyzer (discovery order, parse-skip, rankings / JSON `"1.0"` unchanged)
- [ ] After Execute: update `scripts/benchmark-scan.md`, CONCERNS, ARCHITECTURE
- [ ] `pnpm build && pnpm test` passes after Execute

## Out of Scope

| Feature                                                         | Reason                                           |
| --------------------------------------------------------------- | ------------------------------------------------ |
| Historical AST / blame                                          | ARCHITECTURE constraint; locked                  |
| Change McCabe decision-node kinds                               | CONCERNS RT-005                                  |
| Change rankings, formulas, or JSON `version` `"1.0"`            | Locked product contract                          |
| Change `--concurrency` CLI/config precedence or validation      | M28 SoT; only pool internals change              |
| Change `DEFAULT_BATCH_SIZE` (50) or default concurrency formula | Memory/CPU caps stay; YAGNI                      |
| CI wall-clock performance gates                                 | Manual timing only (`scripts/benchmark-scan.md`) |
| Pipeline stage overlap (git ∥ complexity)                       | M34                                              |
| Parallel git mining                                             | ADR / different milestone                        |
| File-level parallelism within a batch                           | Batch remains unit of work                       |
| New CLI flags (`--batch-size`, `--workers`)                     | YAGNI                                            |
| ROADMAP.md / STATE.md edits in this planning session            | Parent agent syncs later                         |

---

## User Stories

### P1: Persistent worker pool with batch queue ⭐ MVP

**User Story**: As a developer scanning a large repo, I want complexity workers to stay alive across batches so that I avoid paying worker spawn and module-load cost on every batch.

**Why P1**: Primary ROADMAP M31 deliverable; removes per-batch `new Worker()`.

**Acceptance Criteria**:

1. WHEN `concurrency > 1` and more than one batch exists THEN the pool SHALL spawn at most `concurrency` workers for the whole `runBatches` call (not one worker per batch)
2. WHEN batches are pending THEN free workers SHALL pull the next batch from a shared queue until all batches complete
3. WHEN `runBatches` completes (resolve or reject) THEN the pool SHALL terminate all workers it spawned (no leaked threads)
4. WHEN a worker fails a batch THEN `runBatches` SHALL reject with an error that includes `repoPath` and batch path context (same enrichment quality as M15)
5. WHEN `batches.length === 0` THEN the pool SHALL return `[]` without spawning workers

**Independent Test**: `pool.test.ts` — spy/count worker constructions ≤ concurrency for multi-batch runs; assert workers exit after completion.

**Requirements**: HOTSPOT-300, HOTSPOT-301, HOTSPOT-302

---

### P1: Reuse ts-morph Project across batches ⭐ MVP

**User Story**: As the complexity stage, I want each worker (and the inline path) to reuse one ts-morph `Project` across batches so that compiler-host cold start is paid once per worker session, not once per batch.

**Why P1**: ROADMAP lists Project reuse as a core wall-time win alongside persistent workers.

**Acceptance Criteria**:

1. WHEN a persistent worker processes multiple batches for the same `repoPath` THEN it SHALL reuse a single `createTsMorphProject` adapter / underlying `Project` across those batches
2. WHEN `concurrency === 1` and multiple batches run inline THEN the inline path SHALL reuse one Project adapter across those batches (not a fresh Project per batch)
3. WHEN a batch finishes loading THEN previously loaded `SourceFile`s from earlier batches SHALL be removed (or otherwise released) before/during the next `loadBatch` so heap stays batch-bounded (M3 D7 intent preserved)
4. WHEN `analyzeBatch` is called without a shared adapter THEN it MAY create a one-shot adapter (backward-compatible for unit call sites) that still uses a single Project for that call’s `loadBatch`

**Independent Test**: `project.test.ts` — two sequential `loadBatch` calls on one adapter; assert both succeed and prior files are not retained as live source files after the second load (or equivalent memory-bound assertion).

**Requirements**: HOTSPOT-303, HOTSPOT-304

---

### P1: Syntactic diagnostics path (RT-005 safe) ⭐ MVP

**User Story**: As a maintainer, I want parse gating to use only syntactic diagnostics so that we avoid expensive semantic/pre-emit work without changing McCabe decision-node semantics.

**Why P1**: ROADMAP / RT-005 — cheaper path must not alter counting or warn-skip contract.

**Acceptance Criteria**:

1. WHEN a file is loaded for complexity analysis THEN parse gating SHALL use `project.getProgram().getSyntacticDiagnostics(sourceFile)` (or equivalent ts-morph syntactic-only API) — not `getPreEmitDiagnostics` / semantic diagnostics
2. WHEN syntactic diagnostics are non-empty THEN the file SHALL be recorded as a parse failure and skipped (existing `PARSE_FAILED` behavior)
3. WHEN McCabe fixtures under `tests/fixtures/complexity/` are analyzed THEN observed complexities SHALL match header-documented expected values (no decision-node drift)
4. WHEN `mccabe.ts` decision-node kinds are reviewed THEN M31 SHALL NOT modify them

**Independent Test**: Unit assertion or spy that syntactic diagnostics are requested; existing `mccabe.test.ts` / complexity fixtures unchanged expectations.

**Requirements**: HOTSPOT-305, HOTSPOT-306

---

### P1: Inline fallback and `--concurrency` semantics preserved ⭐ MVP

**User Story**: As an operator and test author, I want `concurrency === 1`, single-batch, and CLI/config `--concurrency` behavior unchanged so that M28 contracts and deterministic tests keep working.

**Why P1**: Locked decision — only pool internals change.

**Acceptance Criteria**:

1. WHEN `concurrency === 1` THEN `runBatches` SHALL process batches on the main thread without spawning `Worker` (M15 D6 preserved)
2. WHEN the analyzer sees a single batch (`batches.length <= 1`) THEN effective concurrency SHALL remain forced to `1` (existing `index.ts` behavior)
3. WHEN `--concurrency` / config `concurrency` is set THEN merged scan config SHALL still flow to `createComplexityAnalyzer({ concurrency })` unchanged (no bin/config redesign)
4. WHEN default concurrency is used THEN formula SHALL remain `min(availableParallelism(), 4)` (`DEFAULT_WORKER_CONCURRENCY`)

**Independent Test**: Existing pool/index tests for concurrency 1; CLI/config concurrency tests from M28 still pass.

**Requirements**: HOTSPOT-307, HOTSPOT-308

---

### P1: Output equivalence ⭐ MVP

**User Story**: As a scoring consumer, I want persistent workers to produce the same `ComplexityAnalyzerResult` as today’s analyzer so that hotspot rankings stay identical.

**Why P1**: Performance-only milestone; locked rankings / formulas / JSON version.

**Acceptance Criteria**:

1. WHEN the same fixture repo is analyzed with `concurrency: 1` (inline) and `concurrency: 2` (persistent workers) THEN `results`, `functions`, and `warnings` SHALL be deep-equal
2. WHEN results are merged THEN discovery-order sorting for `results` / `functions` / `warnings` SHALL match M15 rules
3. WHEN public `ComplexityAnalyzerResult` / JSON scan `version` is inspected THEN shapes and `"1.0"` SHALL be unchanged

**Independent Test**: Equivalence test in `index.test.ts` (or pool/index) comparing concurrency 1 vs >1 on a multi-batch temp repo.

**Requirements**: HOTSPOT-309

---

### P1: Parse failures and injectable pool ⭐ MVP

**User Story**: As a test author and operator, I want parse-skip and injectable `createWorkerPool` / `concurrency` seams preserved so that Vitest stays deterministic and one bad file never aborts the scan.

**Why P1**: RT-002 / TESTING.md adapter boundary.

**Acceptance Criteria**:

1. WHEN a file fails to parse in a persistent worker THEN `PARSE_FAILED` warnings SHALL match existing format/severity and the file SHALL be absent from `results`
2. WHEN `ComplexityAnalyzerDependencies.createWorkerPool` is injected THEN the analyzer SHALL use it
3. WHEN `ComplexityAnalyzerDependencies.concurrency` is set THEN the pool SHALL respect it (subject to single-batch force-to-1)
4. WHEN unit tests use `concurrency: 1` THEN they SHALL not require real worker threads for core assertions

**Independent Test**: Existing parse-failure + mock-pool tests updated if protocol changes; still green.

**Requirements**: HOTSPOT-310, HOTSPOT-311

---

### P2: Manual benchmark + codebase docs

**User Story**: As a maintainer assessing RT-001, I want benchmark notes and architecture/concerns docs updated for persistent workers and Project reuse.

**Why P2**: ROADMAP “After Execute” doc targets; timing remains manual.

**Acceptance Criteria**:

1. WHEN [scripts/benchmark-scan.md](../../../scripts/benchmark-scan.md) is read THEN it SHALL include an M31 section (persistent pool + Project reuse; `--concurrency` still only affects complexity; compare wall time qualitatively)
2. WHEN [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md) § Complexity stage parallelism is read THEN it SHALL describe persistent workers + Project reuse (not “fresh Project per batch” / “new Worker per batch”)
3. WHEN [CONCERNS.md](../../codebase/CONCERNS.md) § Performance is read THEN RT-001 AST notes SHALL mention persistent workers and Project reuse + syntactic diagnostics
4. WHEN timing is assessed THEN operators SHALL record wall time manually — no CI perf gate

**Independent Test**: Doc review / grep for M31 / persistent worker language.

**Requirements**: HOTSPOT-312, HOTSPOT-313

---

## Edge Cases

- WHEN `repoPath` is invalid THEN behavior SHALL match pre-M31 (`analyze()` rejects before pool work)
- WHEN all files in a batch fail parse THEN the batch SHALL contribute empty `results` and non-empty warnings without killing the worker
- WHEN a worker crashes mid-queue THEN `runBatches` SHALL reject and remaining workers SHALL still be terminated
- WHEN `repoPath` differs across messages in one worker (should not happen in production scan) THEN design MAY recreate the Project adapter for the new path (document in design)
- WHEN file paths contain spaces or unicode THEN persistent and inline paths SHALL produce identical results
- WHEN zero eligible files THEN no workers spawn and empty result returns

---

## Requirement Traceability

| Requirement ID | Story                                            | Phase          | Status  |
| -------------- | ------------------------------------------------ | -------------- | ------- |
| HOTSPOT-300    | P1: Persistent worker pool                       | Design / Tasks | Pending |
| HOTSPOT-301    | P1: Persistent worker pool (queue dispatch)      | Design / Tasks | Pending |
| HOTSPOT-302    | P1: Persistent worker pool (terminate / no leak) | Design / Tasks | Pending |
| HOTSPOT-303    | P1: Project reuse across batches                 | Design / Tasks | Pending |
| HOTSPOT-304    | P1: Project reuse (batch-bounded heap)           | Design / Tasks | Pending |
| HOTSPOT-305    | P1: Syntactic diagnostics path                   | Design / Tasks | Pending |
| HOTSPOT-306    | P1: McCabe / RT-005 unchanged                    | Design / Tasks | Pending |
| HOTSPOT-307    | P1: Inline fallback preserved                    | Design / Tasks | Pending |
| HOTSPOT-308    | P1: `--concurrency` semantics unchanged          | Design / Tasks | Pending |
| HOTSPOT-309    | P1: Output equivalence                           | Design / Tasks | Pending |
| HOTSPOT-310    | P1: Parse failures unchanged                     | Design / Tasks | Pending |
| HOTSPOT-311    | P1: Injectable pool / testability                | Design / Tasks | Pending |
| HOTSPOT-312    | P2: Manual benchmark documentation               | Design / Tasks | Pending |
| HOTSPOT-313    | P2: ARCHITECTURE / CONCERNS sync                 | Design / Tasks | Pending |

**ID range reserved:** HOTSPOT-300 … HOTSPOT-319 (unused: 314–319)  
**Coverage:** 14 total, 0 unmapped at Tasks completion (see tasks.md mapping)

---

## Success Criteria

- [ ] All P1 acceptance criteria verifiable via Vitest + fixtures (no human judgment for correctness)
- [ ] `pnpm build && pnpm test` passes after Execute
- [ ] `src/complexity/**` meets per-file coverage thresholds ([TESTING.md](../../codebase/TESTING.md)); `worker.ts` remains coverage-excluded
- [ ] McCabe fixtures unchanged in expected values; `mccabe.ts` decision nodes untouched
- [ ] No CLI/config surface change for concurrency
- [ ] Rankings / formulas / JSON `"1.0"` unchanged
- [ ] `tasks.md` Status `Planned` ends planning; Execute in a separate session
