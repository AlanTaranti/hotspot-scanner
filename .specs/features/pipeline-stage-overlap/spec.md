# Milestone 34 — Pipeline Stage Overlap Specification

**Feature slug:** `pipeline-stage-overlap`  
**Milestone:** ROADMAP M34  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md) § Data flow, [CONCERNS.md](../../codebase/CONCERNS.md) § Performance (RT-001)  
**Context:** [`.specs/features/pipeline-stage-overlap/context.md`](./context.md)  
**Sisters:** [integration](../integration/) (M6 sequential `runScan`), [perf-diagnostics-ux](../perf-diagnostics-ux/) (M28 progress phases), [per-function-churn](../per-function-churn/) (M23 function-churn after complexity)

## Problem Statement

`runScan()` runs Git Change Miner (I/O-bound numstat stream) and Complexity Analyzer (CPU-bound AST workers) **strictly sequentially**. On large repos, wall time is roughly the sum of both stages even though they do not depend on each other’s outputs until scoring. Function mode still needs complexity ranges before hunk-overlap churn, and coupling still needs numstat co-change events — so only the first two stages are safe to overlap.

M34 overlaps **numstat ∥ complexity** in `src/scan.ts` with coherent cancel/error handling, keeps function-churn sequential after complexity, leaves rankings/JSON unchanged, documents the peak-memory trade-off, and does **not** parallelize function-churn with numstat.

## Goals

- [ ] Overlap git miner and complexity in `src/scan.ts` with coherent cancel/error handling
- [ ] File mode: coupling/scoring only after both complete; function mode: function-churn only after complexity (needs ranges)
- [ ] Document peak-memory trade-off; progress phases unchanged
- [ ] Boundary: do **not** parallelize function-churn with numstat
- [ ] Rankings and JSON contract unchanged; `pnpm build && pnpm test` green

## Out of Scope

| Feature                                              | Reason                                                 |
| ---------------------------------------------------- | ------------------------------------------------------ |
| Function-churn ∥ numstat (or ∥ complexity)           | ROADMAP boundary — rename/alias complexity; deferred   |
| New progress phases (`complexity`, `overlap`)        | Locked — phases unchanged ([context.md](./context.md)) |
| User-facing cancel API / SIGINT orchestration        | YAGNI — abort is internal sibling-cancel only          |
| Scoring formula / ranking / JSON `version` changes   | Locked unchanged                                       |
| CI wall-clock or peak-RSS gates                      | Manual / documented trade-off only (existing policy)   |
| M35 pathspec / interval-index / discovery defaults   | Separate milestones                                    |
| Parallelizing enrich or coupling with git/complexity | Not in ROADMAP M34                                     |

---

## User Stories

### P1: Overlap numstat ∥ complexity ⭐ MVP

**User Story**: As an operator scanning a large repository, I want git mining and complexity analysis to run concurrently so that wall-clock scan time approaches the slower of the two stages instead of their sum.

**Why P1**: Primary ROADMAP M34 deliverable; largest safe overlap without changing ranking inputs.

**Acceptance Criteria**:

1. WHEN `runScan()` reaches the mining/analysis stages THEN it SHALL start `GitMiner.mine` (numstat) and `ComplexityAnalyzer.analyze` such that both are in flight concurrently (not strictly sequential awaits)
2. WHEN either stage is still running THEN the other stage SHALL be allowed to make progress without waiting for the first to finish
3. WHEN both stages complete successfully THEN `runScan()` SHALL proceed to scoring / coupling (and function-churn when applicable) using the same inputs as today
4. WHEN `granularity === "file"` THEN `runScan()` SHALL NOT spawn `FunctionChurnMiner`

**Independent Test**: Unit test with mocked `mine`/`analyze` proving overlapping in-flight execution; fixture scan still exit 0.

**Requirements**: HOTSPOT-360, HOTSPOT-371

---

### P1: File-mode barrier before scoring / coupling ⭐ MVP

**User Story**: As a consumer of file-mode rankings, I want hotspot scoring and temporal coupling to run only after both git and complexity finish so that results stay coherent and identical in meaning to sequential scans.

**Why P1**: ROADMAP file-mode barrier; prevents scoring with partial inputs.

**Acceptance Criteria**:

1. WHEN `granularity === "file"` THEN hotspot scoring SHALL start only after **both** numstat mining and complexity analysis have completed successfully
2. WHEN `granularity === "file"` THEN temporal coupling scoring and static enrich SHALL start only after both overlapping stages have completed successfully
3. WHEN either overlapping stage fails THEN scoring / coupling SHALL NOT run

**Independent Test**: Mocked call-order assertions in `scan.test.ts`.

**Requirements**: HOTSPOT-361

---

### P1: Function-mode ordering (ranges → churn) ⭐ MVP

**User Story**: As an operator using `--granularity function`, I want function-churn mining to start only after complexity provides function ranges, while still overlapping numstat with complexity, so that hunk overlap remains correct and wall time still improves.

**Why P1**: ROADMAP function-mode constraint; M23 depends on `endLine` ranges.

**Acceptance Criteria**:

1. WHEN `granularity === "function"` THEN `FunctionChurnMiner.mine` SHALL start only after complexity analysis has completed successfully (ranges available)
2. WHEN `granularity === "function"` THEN `FunctionChurnMiner.mine` SHALL NOT run concurrently with the numstat `GitMiner.mine` of the same `runScan()` invocation
3. WHEN `granularity === "function"` THEN temporal coupling SHALL still consume numstat `coChangeEvents` / `fileStats` and SHALL wait until numstat mining has completed successfully
4. WHEN function-churn runs THEN it SHALL receive the same `functionComplexity` list shape as today (including `line` / `endLine`)

**Independent Test**: Mocked ordering — complexity settles before churn `mine`; churn not overlapping numstat; integration on `small-ts` function mode exit 0.

**Requirements**: HOTSPOT-362, HOTSPOT-363, HOTSPOT-372

---

### P1: Coherent cancel / error handling ⭐ MVP

**User Story**: As an operator, when git mining or complexity fails during overlap, I want the sibling stage cancelled or settled cleanly and a single clear error so that the process does not leak work, leave unhandled rejections, or produce partial rankings.

**Why P1**: ROADMAP “coherent cancel/error handling”; RT-001 / fragile `scan.ts` wiring.

**Acceptance Criteria**:

1. WHEN one overlapping stage rejects THEN `runScan()` SHALL abort the sibling via an orchestrator-owned `AbortSignal` (best-effort kill/terminate)
2. WHEN abort is signaled THEN git numstat spawn SHALL stop reading and kill the child process (when still running)
3. WHEN abort is signaled THEN complexity worker pool SHALL stop scheduling new batches and terminate in-flight workers (best-effort)
4. WHEN either stage fails THEN `runScan()` SHALL reject with the **original** failure (preserve existing error types/messages such as `GitLogError`)
5. WHEN either stage fails THEN there SHALL be no unhandled promise rejection from the sibling
6. WHEN either stage fails THEN hotspot / function / coupling scoring SHALL NOT run
7. WHEN CLI observes a thrown scan error THEN exit code SHALL be `!= 0` (existing semantics)

**Independent Test**: Unit — mock one stage reject, assert sibling receives abort and `runScan` rejects with original error; no unhandledRejection.

**Requirements**: HOTSPOT-364, HOTSPOT-365, HOTSPOT-366, HOTSPOT-376, HOTSPOT-377

---

### P1: Progress and warnings during overlap ⭐ MVP

**User Story**: As an operator watching stderr, I want existing progress phases and warning aggregation to keep working during overlap so that diagnostics remain interpretable.

**Why P1**: ROADMAP “progress phases unchanged or carefully extended”; M28 contract.

**Acceptance Criteria**:

1. WHEN progress is emitted THEN `ScanProgress.phase` SHALL remain only `"git" | "function-churn"` (no new phases in M34)
2. WHEN `onProgress` is provided THEN numstat mining SHALL still forward `phase: "git"` during the overlapping window
3. WHEN function mode runs THEN `phase: "function-churn"` SHALL still be emitted only from `FunctionChurnMiner` after the overlap barrier
4. WHEN both overlapping stages emit warnings THEN `runScan()` SHALL aggregate them into `meta.warnings` and forward via `onWarning` (order: all git warnings then all complexity warnings after both settle, or document stable deterministic order in design — must be test-stable)
5. WHEN `onProgress` / `onWarning` are omitted THEN overlap SHALL still complete without error

**Independent Test**: Existing progress/warning tests updated; no new phase string in types.

**Requirements**: HOTSPOT-367, HOTSPOT-368, HOTSPOT-369

---

### P1: Peak-memory trade-off documentation ⭐ MVP

**User Story**: As a maintainer or operator, I want the peak-memory trade-off of stage overlap documented so that concurrency/memory tuning decisions are informed.

**Why P1**: Explicit ROADMAP deliverable.

**Acceptance Criteria**:

1. WHEN ARCHITECTURE data-flow is updated THEN it SHALL describe git ∥ complexity overlap and post-barrier scoring / function-churn ordering
2. WHEN CONCERNS Performance is updated THEN it SHALL note higher peak RSS vs sequential stages (aggregates + workers concurrent)
3. WHEN docs mention overlap THEN they SHALL state that rankings/JSON are unchanged and that function-churn is not overlapped with numstat in M34

**Independent Test**: Doc checklist in task Done when.

**Requirements**: HOTSPOT-373, HOTSPOT-374, HOTSPOT-375

---

### P2: Equivalence + integration verification

**User Story**: As a maintainer, I want fixture proofs that overlapped scans preserve ranking semantics and that error paths still fail closed.

**Why P2**: Cross-cutting proof after wiring; prevents silent ranking drift.

**Acceptance Criteria**:

1. WHEN file-mode scan runs on `tests/fixtures/repos/small-ts` THEN hotspot and coupling rankings SHALL match pre-overlap semantic expectations (stable top entries / comparable ordered lists under fixed options)
2. WHEN function-mode scan runs on the same fixture THEN function rankings SHALL remain coherent (non-empty where expected; churn still from hunk overlap)
3. WHEN integration covers overlap THEN file mode SHALL still spawn zero patch streams
4. WHEN `pnpm build && pnpm test` runs THEN the suite SHALL pass with coverage thresholds intact

**Independent Test**: `src/scan.integration.test.ts` (+ unit cancel tests) + full gate.

**Requirements**: HOTSPOT-370, HOTSPOT-378, HOTSPOT-379

---

## Edge Cases

- WHEN git fails before complexity finishes THEN complexity SHALL be aborted; `runScan` rejects with git error; no rankings returned
- WHEN complexity fails before git finishes THEN git SHALL be aborted; `runScan` rejects with complexity error; no rankings returned
- WHEN both fail nearly simultaneously THEN `runScan` SHALL reject with one primary error and still avoid unhandled rejections
- WHEN abort races with natural completion THEN settled success of the sibling SHALL be discarded if the other failed (no partial `ScanResult`)
- WHEN `concurrency === 1` THEN overlap with git SHALL still apply (pool inline path + numstat concurrent)
- WHEN `--since` yields empty git window THEN existing empty-window warning behavior SHALL remain; complexity still runs (overlap) unless git stage throws
- WHEN repo validation fails THEN neither git nor complexity SHALL start (pre-overlap guards unchanged)

---

## Requirement Traceability

| Requirement ID | Story                                        | Phase | Status   |
| -------------- | -------------------------------------------- | ----- | -------- |
| HOTSPOT-360    | P1: Overlap numstat ∥ complexity             | Tasks | In Tasks |
| HOTSPOT-361    | P1: File-mode barrier                        | Tasks | In Tasks |
| HOTSPOT-362    | P1: Function-mode churn after complexity     | Tasks | In Tasks |
| HOTSPOT-363    | P1: Function-mode coupling waits for git     | Tasks | In Tasks |
| HOTSPOT-364    | P1: Abort sibling on first failure           | Tasks | In Tasks |
| HOTSPOT-365    | P1: Propagate original error / non-zero exit | Tasks | In Tasks |
| HOTSPOT-366    | P1: No unhandled sibling rejection           | Tasks | In Tasks |
| HOTSPOT-367    | P1: Progress phases unchanged                | Tasks | In Tasks |
| HOTSPOT-368    | P1: git progress during overlap              | Tasks | In Tasks |
| HOTSPOT-369    | P1: Warning aggregation during overlap       | Tasks | In Tasks |
| HOTSPOT-370    | P2: Ranking/JSON equivalence                 | Tasks | In Tasks |
| HOTSPOT-371    | P1: File mode no function-churn spawn        | Tasks | In Tasks |
| HOTSPOT-372    | P1: No function-churn ∥ numstat              | Tasks | In Tasks |
| HOTSPOT-373    | P1: Peak-memory docs                         | Tasks | In Tasks |
| HOTSPOT-374    | P1: ARCHITECTURE data-flow update            | Tasks | In Tasks |
| HOTSPOT-375    | P1: CONCERNS Performance update              | Tasks | In Tasks |
| HOTSPOT-376    | P1: Git spawn abort/kill                     | Tasks | In Tasks |
| HOTSPOT-377    | P1: Complexity pool abort/terminate          | Tasks | In Tasks |
| HOTSPOT-378    | P2: Integration + cancel coverage            | Tasks | In Tasks |
| HOTSPOT-379    | P2: Full project gate                        | Tasks | In Tasks |

**ID range:** HOTSPOT-360 … HOTSPOT-379 (exclusive use for M34)  
**Coverage:** 20 total, 20 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] Wall-clock opportunity: git and complexity overlap in `runScan` (structurally verified)
- [ ] File and function barriers respected; function-churn never overlaps numstat
- [ ] Sibling failure aborts the other stage without unhandled rejections; no partial rankings
- [ ] Progress phases unchanged; warnings still in `meta.warnings`
- [ ] Peak-memory trade-off documented in ARCHITECTURE + CONCERNS
- [ ] Rankings/JSON unchanged; `pnpm build && pnpm test` passes
