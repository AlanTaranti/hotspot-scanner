# Milestone 15 — AST Parallelization Specification

**Feature slug:** `ast-parallelization`  
**Milestone:** ROADMAP M15  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [CONCERNS.md](../../codebase/CONCERNS.md), [TESTING.md](../../codebase/TESTING.md) (RT-001, RT-005)  
**Context:** [`.specs/features/ast-parallelization/context.md`](./context.md)

## Problem Statement

M3 introduced batch processing (50 files per `ts-morph` `Project`) to bound heap usage on large repos (RT-001 D7), but batches are processed **sequentially** on a single thread. M11 multiplied per-file CPU cost with per-function McCabe walks. On multi-core machines, the complexity stage leaves CPU idle while parsing and analyzing ASTs one batch at a time.

M15 adds worker-thread parallel batch processing inside `src/complexity/` so large-repo scans use available CPU without changing public analyzer contracts, McCabe semantics, or pipeline stage ordering.

## Goals

- [ ] Worker-thread batch processing in `src/complexity/` (RT-001)
- [ ] Output functionally identical to the current sequential implementation
- [ ] Injectable pool/concurrency at the `ComplexityAnalyzer` adapter boundary (TESTING.md)
- [ ] `pnpm build && pnpm test` passing after Execute
- [ ] Remove "Worker-thread parallelization" entry from [STATE.md](../../project/STATE.md) §Deferred when Done

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature                                  | Reason                                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| Parallel git mining                      | ADR-2026-020; different module                                          |
| Overlap git + complexity pipeline stages | [integration/context.md](../integration/context.md) — sequential stages |
| CLI `--workers` / `--batch-size` flags   | YAGNI; internal constants first                                         |
| CI performance thresholds                | Manual benchmark only (integration/context.md C5)                       |
| Alter McCabe / decision node definition  | CONCERNS RT-005 — reuse `complexityForFunction()`                       |
| File-level parallelism within a batch    | Batch-level aligns with M3 D7 fresh `Project` per batch                 |
| Scoring/reporter parallelization         | In-memory; not RT-001 bottleneck                                        |
| Change `DEFAULT_BATCH_SIZE` (50)         | Memory tuning ≠ parallelism                                             |
| Historical AST from Git                  | ARCHITECTURE constraint — working tree only                             |

---

## User Stories

### P1: Worker pool with bounded concurrency ⭐ MVP

**User Story**: As a developer scanning a large repo, I want file batches analyzed concurrently via worker threads so that multi-core CPU is utilized during the complexity stage.

**Why P1**: ROADMAP M15 primary deliverable; addresses RT-001 CPU idle time.

**Acceptance Criteria**:

1. WHEN the analyzer has more than one batch THEN batches SHALL be dispatched to a worker pool with bounded concurrency
2. WHEN concurrency is not overridden THEN default SHALL be `min(os.availableParallelism(), 4)`
3. WHEN each worker processes a batch THEN it SHALL instantiate a fresh `ts-morph` `Project` for that batch only (no shared AST state across workers)
4. WHEN `concurrency === 1` OR only one batch exists THEN the analyzer SHALL process without unnecessary worker spawn overhead
5. WHEN a worker throws THEN the error SHALL propagate to `analyze()` with context (`repoPath`, batch paths)

**Independent Test**: Unit test on `pool.ts` with mock workers asserting max in-flight batches ≤ concurrency.

**Requirements**: HOTSPOT-113

---

### P1: Output equivalence ⭐ MVP

**User Story**: As a scoring module consumer, I want parallel analysis to produce the same `ComplexityAnalyzerResult` as the sequential implementation so that hotspot rankings are unchanged.

**Why P1**: Parallelism is an optimization; correctness must not regress M3–M11 behavior.

**Acceptance Criteria**:

1. WHEN `analyze({ repoPath, scope })` runs on a fixture repo THEN `results`, `functions`, and `warnings` SHALL be deep-equal to the pre-M15 sequential output for the same inputs
2. WHEN results are merged from parallel workers THEN `results` SHALL be ordered by original discovery order of `filePath`
3. WHEN `functions` are merged THEN entries for the same file SHALL appear grouped in discovery order of their parent `filePath`, with stable order within a file (line ascending)
4. WHEN `warnings` are merged THEN they SHALL be ordered by discovery order of the failed `filePath`
5. WHEN `createComplexityAnalyzer()` public return shape is inspected THEN `ComplexityAnalyzerResult` interface SHALL be unchanged

**Independent Test**: Equivalence test — same fixture analyzed with `concurrency: 1` (inline) vs default concurrency; assert deep equality.

**Requirements**: HOTSPOT-114

---

### P1: Parse failures unchanged ⭐ MVP

**User Story**: As a developer scanning a real repo, I want parse failures handled identically to M3 so that one bad file never aborts the scan.

**Why P1**: RT-002 fragile area; worker split must not change warn-skip contract.

**Acceptance Criteria**:

1. WHEN ts-morph fails to parse a file in a worker THEN the warning SHALL contain `filePath` and the parse error message
2. WHEN a file fails to parse THEN it SHALL be excluded from `results` (no `ComplexityResult` entry)
3. WHEN valid and invalid files are analyzed together across multiple batches THEN `analyze()` SHALL return partial results and warnings without throwing
4. WHEN all files in a batch fail THEN the batch SHALL contribute empty `results` and non-empty `warnings` without throwing

**Independent Test**: Fixture with `invalid-syntax.ts` in a multi-batch temp repo; assert warning format and partial results.

**Requirements**: HOTSPOT-115

---

### P1: Discovery on main thread ⭐ MVP

**User Story**: As the complexity orchestrator, I want file discovery to remain on the main thread so that only AST analysis parallelizes.

**Why P1**: Discovery is I/O-light; parallelizing it adds complexity without RT-001 benefit.

**Acceptance Criteria**:

1. WHEN `analyze()` runs THEN `discoverSourceFiles(repoPath, scope)` SHALL execute on the main thread before any worker dispatch
2. WHEN discovery completes THEN batch chunking SHALL use existing `DEFAULT_BATCH_SIZE` (50) on the main thread
3. WHEN `discoverSourceFiles` is injected via `ComplexityAnalyzerDependencies` THEN the injected implementation SHALL be used (test seam preserved)

**Independent Test**: Mock `discoverSourceFiles` in `index.test.ts`; assert called once before pool dispatch.

**Requirements**: HOTSPOT-116

---

### P1: Testability — injectable pool ⭐ MVP

**User Story**: As a test author, I want to mock the worker pool or force `concurrency: 1` so that Vitest runs deterministically without flaky worker timing.

**Why P1**: TESTING.md mandates mock at `ComplexityAnalyzer` adapter boundary.

**Acceptance Criteria**:

1. WHEN `ComplexityAnalyzerDependencies` includes `createWorkerPool` THEN the analyzer SHALL use the injected pool instead of the default
2. WHEN `ComplexityAnalyzerDependencies` includes `concurrency` THEN the default pool SHALL respect that limit
3. WHEN unit tests run with `concurrency: 1` THEN they SHALL not require real `worker_threads` for core equivalence assertions
4. WHEN `pnpm test` runs THEN all tests SHALL pass without timing-dependent assertions

**Independent Test**: `index.test.ts` with mocked `createWorkerPool` returning sequential inline processor.

**Requirements**: HOTSPOT-117

---

### P1: McCabe regression gate ⭐ MVP

**User Story**: As a CI maintainer, I want all existing McCabe fixtures to pass unchanged so that RT-005 decision node semantics are preserved.

**Why P1**: CONCERNS RT-005 — parallelization must not alter counting logic.

**Acceptance Criteria**:

1. WHEN each file in `tests/fixtures/complexity/` is analyzed THEN observed McCabe values SHALL match header-documented expected values
2. WHEN `pnpm test` runs THEN all complexity unit tests from M3/M11 SHALL pass without fixture updates
3. WHEN function-mode scan runs on `small-ts` integration fixture THEN output SHALL match pre-M15 rankings (order may tie-break identically)

**Independent Test**: Existing `mccabe.test.ts`, `analyze-file.test.ts`, complexity fixture tests — zero changes required.

**Requirements**: HOTSPOT-118

---

### P2: Manual benchmark documentation

**User Story**: As an operator assessing RT-001, I want benchmark instructions updated with M15 before/after notes so that qualitative speedup can be recorded.

**Why P2**: ROADMAP ties M15 to RT-001; manual benchmark is the approved measurement channel.

**Acceptance Criteria**:

1. WHEN [scripts/benchmark-scan.md](../../../scripts/benchmark-scan.md) is read THEN it SHALL include an M15 section describing parallel complexity stage
2. WHEN benchmark is run THEN operator SHALL record wall time and qualitative notes (acceptable / slow) — no CI gate
3. WHEN benchmark section references concurrency THEN it SHALL note internal default `min(availableParallelism(), 4)` (not a CLI flag)

**Independent Test**: Doc review; grep for "M15" or "parallel" in benchmark doc.

**Requirements**: HOTSPOT-119

---

### P1: Documentation sync ⭐ MVP

**User Story**: As a maintainer, I want docs updated so that worker-thread parallelization is discoverable and the deferred entry is closed.

**Why P1**: Workspace rule — significant architecture changes update `.specs/codebase/`.

**Acceptance Criteria**:

1. WHEN M15 Execute completes THEN [STATE.md](../../project/STATE.md) §Deferred SHALL no longer list worker-thread parallelization
2. WHEN [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md) is read THEN complexity stage SHALL document worker pool and batch parallelism
3. WHEN [CONCERNS.md](../../codebase/CONCERNS.md) §Performance is read THEN RT-001 SHALL note AST worker-thread batch processing
4. WHEN [INTEGRATIONS.md](../../codebase/INTEGRATIONS.md) is read THEN `worker_threads` usage SHALL be documented under complexity adapter boundary
5. WHEN planning completes THEN [ROADMAP.md](../../project/ROADMAP.md) M15 SHALL link to this spec with `**Specs:** Done`

**Independent Test**: Doc review; grep listed files for worker pool / parallel batch.

**Requirements**: HOTSPOT-120

---

## Edge Cases

- WHEN repo has zero eligible files THEN `analyze()` SHALL return `{ results: [], functions: [], warnings: [] }` without spawning workers
- WHEN repo has ≤50 files (single batch) THEN analysis SHALL complete correctly with concurrency 1 or inline path
- WHEN a worker crashes unexpectedly THEN `analyze()` SHALL reject with an error containing `repoPath` context
- WHEN file paths contain spaces or unicode THEN parallel and sequential paths SHALL produce identical results
- WHEN function granularity (M11) is active in `runScan()` THEN `functions[]` from parallel analyzer SHALL aggregate correctly for `scoreFunctionHotspots()`
- WHEN `scope` excludes all files THEN return empty result without worker spawn
- WHEN multiple batches contain parse failures THEN all warnings SHALL be collected (none dropped due to race)

---

## Requirement Traceability

| Requirement ID | Story                                    | Phase            | Status  |
| -------------- | ---------------------------------------- | ---------------- | ------- |
| HOTSPOT-113    | P1: Worker pool with bounded concurrency | Tasks T1, T2     | Planned |
| HOTSPOT-114    | P1: Output equivalence                   | Tasks T3, T4     | Planned |
| HOTSPOT-115    | P1: Parse failures unchanged             | Tasks T1, T4     | Planned |
| HOTSPOT-116    | P1: Discovery on main thread             | Tasks T1, T3     | Planned |
| HOTSPOT-117    | P1: Testability — injectable pool        | Tasks T2, T3, T4 | Planned |
| HOTSPOT-118    | P1: McCabe regression gate               | Tasks T4, T5     | Planned |
| HOTSPOT-119    | P2: Manual benchmark documentation       | Tasks T6         | Planned |
| HOTSPOT-120    | P1: Documentation sync                   | Tasks T6         | Planned |

**Coverage:** 8 total, 8 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] All P1 acceptance criteria verifiable via Vitest + fixtures (no human judgment)
- [ ] `pnpm build && pnpm test` passes after Execute
- [ ] `src/complexity/**` meets per-file coverage thresholds per [TESTING.md](../../codebase/TESTING.md)
- [ ] `orchestrator-implementer` can execute T1–T6 without ambiguous scope
- [ ] McCabe decision node definition unchanged (existing complexity fixtures pass)
- [ ] `createComplexityAnalyzer().analyze()` public contract unchanged
- [ ] No CLI flags added
