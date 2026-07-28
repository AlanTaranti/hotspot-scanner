# Milestone 32 — Coupling Stream Aggregation Specification

**Feature slug:** `coupling-stream-aggregate`  
**Milestone:** ROADMAP M32  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [CONCERNS.md](../../codebase/CONCERNS.md), [TESTING.md](../../codebase/TESTING.md)  
**Sister features:** [git-change-miner](../git-change-miner/spec.md), [path-scoping](../path-scoping/spec.md), [scoring](../scoring/spec.md), [perf-diagnostics-ux](../perf-diagnostics-ux/spec.md)

## Problem Statement

Temporal coupling today retains a full `CoChangeEvent[]` (one entry per commit with its `filesChanged` list) through the numstat stream, then re-walks that array in `scoreCoupling` to build `pair → coChangeCount`. On large histories this doubles memory pressure and adds a second full pass — a RT-001 risk called out for M32.

Additionally, a single mega-commit touching hundreds of unique files expands to `C(n, 2)` pair increments and can dominate memory even when streaming line-by-line. Path scope already filters co-change events post-mine, but mega-guard and pair aggregation must see **in-scope** unique files so narrow `--include` scans do not skip valid small in-scope co-changes inside otherwise huge commits.

## Goals

- [x] Aggregate `pair → coChangeCount` during the numstat stream; do **not** retain a full `coChangeEvents[]` for scoring
- [x] Preserve `couplingStrength` formula and ranking order for all commits below the mega-commit guard
- [x] Guard commits with too many unique (in-scope) files: **skip** coupling contribution + structured `ScanWarning`; document in CONCERNS
- [x] Path scope filters **before/during** pair aggregation (and mega-guard), preserving M7 coupling semantics for non-mega commits
- [x] Streaming line-by-line numstat parse retained (RT-001 / ADR-2026-020)
- [x] `pnpm build && pnpm test` green after Execute

## Out of Scope

| Feature                                                                                                         | Reason                                       |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Historical AST / per-commit function ranges                                                                     | Explicitly deferred (STATE / CONCERNS)       |
| Changing `couplingStrength` or hotspot formulas                                                                 | Locked — rankings unchanged except mega-skip |
| Changing published `ScanResult` / compare JSON fields (except additive mega-commit warnings in `meta.warnings`) | Locked                                       |
| CLI flag or config for mega-commit threshold                                                                    | YAGNI — named constant only                  |
| Cap / truncate file list inside mega-commits (partial pair counting)                                            | Locked decision: **skip**, not cap           |
| Persistent AST workers / static enrich cache / pipeline overlap                                                 | M31 / M33 / M34                              |
| Function-mode patch-stream changes                                                                              | M35; file numstat path only                  |
| New rename-confidence warning families (RT-003)                                                                 | M26/M28 boundary                             |

---

## User Stories

### P1: Stream-time pair aggregation ⭐ MVP

**User Story**: As a developer scanning a large repo, I want co-change counts accumulated as `pair → coChangeCount` during the numstat stream so that the miner does not retain a full per-commit event array.

**Why P1**: Core M32 memory win; removes the second full pass over `coChangeEvents[]`.

**Acceptance Criteria**:

1. WHEN `aggregateOneCommit` processes a commit THEN it SHALL increment pair co-change counts for each unordered unique-file pair in that commit (after path scope + mega-guard) without appending a `CoChangeEvent` to a retained array used for scoring
2. WHEN mining completes THEN `GitMinerResult` SHALL expose aggregated pair counts (not a full `coChangeEvents[]` required by the scoring path)
3. WHEN rename links are finalized THEN pair keys SHALL be remapped through the final `PathAliasMap` (merge counts for pairs that canonicalize to the same key) before scoring — equivalent to today's post-stream `canonicalizeCoChangeEvents` + pair expansion
4. WHEN the numstat stream is processed THEN parsing SHALL remain line-by-line (no full-log buffer) — RT-001 unchanged

**Independent Test**: Unit tests on `aggregate.ts` / miner with multi-commit fixtures asserting pair counts and absence of a growing `coChangeEvents` accumulator used for scoring.

**Requirements**: HOTSPOT-320, HOTSPOT-321, HOTSPOT-322

---

### P1: Preserved coupling ranking below mega-guard ⭐ MVP

**User Story**: As a pipeline consumer, I want `couplingStrength` and pair ranking identical to pre-M32 behavior for histories with no mega-commits so that baselines and fixtures stay stable.

**Why P1**: Locked decision — formulas/rankings unchanged except explicit mega-commit skip.

**Acceptance Criteria**:

1. WHEN all commits have unique in-scope file counts ≤ the mega-commit threshold THEN `scoreCoupling` output SHALL match pre-M32 results for the same `fileStats`, `minCochange`, and co-change inputs (same pairs, `coChangeCount`, `couplingStrength`, sort order)
2. WHEN `couplingStrength` is computed THEN it SHALL remain `coChangeCount / min(commitsA, commitsB)` with the same zero-denominator skip behavior
3. WHEN `--min-cochange` is applied THEN threshold semantics SHALL be unchanged (boundary at N-1, N, N+1)
4. WHEN static enrichment runs after scoring THEN ranking fields SHALL remain untouched (enrichment stays post-score)

**Independent Test**: Golden / fixture parity tests: fixed events-or-pairs inputs → identical `CouplingPair[]` ordering and strengths vs locked expected values from existing `coupling-scorer.test.ts` cases.

**Requirements**: HOTSPOT-323, HOTSPOT-324

---

### P1: Mega-commit guard + ScanWarning ⭐ MVP

**User Story**: As an operator, I want commits that touch too many unique files to be skipped for coupling aggregation (with a clear warning) so that one bulk commit cannot explode memory via `C(n, 2)` pair updates.

**Why P1**: ROADMAP M32 guard; documents the only intentional ranking change.

**Acceptance Criteria**:

1. WHEN a commit's **unique in-scope** file count is **greater than** `MEGA_COMMIT_UNIQUE_FILE_THRESHOLD` (constant **100**) THEN the miner SHALL **not** increment any coupling pair counts for that commit
2. WHEN a commit is skipped for mega-commit THEN file churn aggregation (`FileChangeStats`) for that commit SHALL still proceed (churn is not gated by the mega-commit rule)
3. WHEN one or more commits are skipped THEN the miner SHALL emit `ScanWarning` objects with `code: "MEGA_COMMIT_SKIPPED"`, `severity: "warning"`, and a message that includes the threshold and enough context to identify the skip (commit hash and unique-file count for detailed lines)
4. WHEN many commits are skipped THEN warnings SHALL be noise-controlled: at most **5** per-commit detail warnings plus one summary warning with the total skipped count (same capping pattern family as M26 unlinked-rename warnings)
5. WHEN no commit exceeds the threshold THEN the miner SHALL emit **no** `MEGA_COMMIT_SKIPPED` warnings
6. WHEN a mega-commit is skipped THEN scan exit code semantics SHALL remain unchanged (success with warnings → exit `0`)

**Independent Test**: Synthetic commit with >100 unique in-scope paths → zero pair increments from that commit + expected warning code; commit with 100 unique paths still aggregates pairs; churn `commitCount` still increments.

**Requirements**: HOTSPOT-325, HOTSPOT-326, HOTSPOT-327

---

### P1: Path scope before/during aggregation ⭐ MVP

**User Story**: As a monorepo developer using `--include` / default excludes, I want path scope applied before mega-guard and pair increments so that in-scope coupling matches M7 semantics and mega-guard does not false-skip narrow scans inside large out-of-scope commits.

**Why P1**: ROADMAP explicit; avoids semantic regression vs post-filter-only mega-guard.

**Acceptance Criteria**:

1. WHEN `runScan` builds a `PathScope` THEN it SHALL pass an in-scope predicate into the git aggregation path so unique-file sets used for mega-guard and pair increments include only in-scope canonical paths
2. WHEN a commit has many out-of-scope files but ≤100 in-scope unique files THEN coupling pairs among those in-scope files SHALL still be counted (mega-guard uses in-scope count only)
3. WHEN a co-change would have produced fewer than 2 in-scope files THEN that commit SHALL contribute **no** pair increments (equivalent to today's dropping events with `< 2` in-scope files)
4. WHEN `filterGitMinerResult` runs THEN it SHALL continue to filter `fileStats` to in-scope paths and filter pair counts so only pairs where **both** files are in scope remain (defense-in-depth if aggregation ran without a scope predicate)
5. WHEN scope is omitted in miner unit tests THEN aggregation MAY record all paths; post-filter remains responsible for scope (backward-compatible test seam)

**Independent Test**: Unit tests: commit with 150 files / 3 in-scope → pairs among the 3 counted, no mega skip; `filter-git` tests updated for pair-count shape.

**Requirements**: HOTSPOT-328, HOTSPOT-329, HOTSPOT-330

---

### P1: Scoring consumes pair counts ⭐ MVP

**User Story**: As the scoring module, I want `scoreCoupling` to accept pre-aggregated pair counts so that it does not re-expand per-commit file lists.

**Why P1**: Completes the end-to-end removal of the second pass.

**Acceptance Criteria**:

1. WHEN `scoreCoupling` is invoked THEN it SHALL accept aggregated pair counts (not require `CoChangeEvent[]` as the production input)
2. WHEN pair counts are empty THEN it SHALL return `[]`
3. WHEN `createTemporalCouplingScorer().score` is called from `runScan` THEN it SHALL pass the filtered pair-count structure from the git stage
4. WHEN the public domain type `CoChangeEvent` remains exported THEN it MAY stay for compatibility, but the production scan path SHALL not depend on retaining a full event array for coupling

**Independent Test**: Update `coupling-scorer.test.ts` and scoring index tests to feed pair counts; assert same outputs as prior fixtures.

**Requirements**: HOTSPOT-331, HOTSPOT-332

---

### P2: Documentation — CONCERNS + warning catalog

**User Story**: As an operator and future agent, I want CONCERNS / ARCHITECTURE / README to document stream pair aggregation, the mega-commit threshold, and `MEGA_COMMIT_SKIPPED` so that the intentional ranking caveat is discoverable.

**Why P2**: ROADMAP requires CONCERNS documentation; M28 catalog pattern.

**Acceptance Criteria**:

1. WHEN CONCERNS Git / Performance sections are updated THEN they SHALL document: no full `coChangeEvents[]` retention for scoring; mega-commit skip at unique in-scope file count > 100; churn still aggregated
2. WHEN the M28 warning catalog is updated THEN it SHALL include `MEGA_COMMIT_SKIPPED` with operator interpretation (bulk commit skipped for coupling; rankings may omit pairs from that commit)
3. WHEN ARCHITECTURE pipeline prose mentions Git miner outputs THEN it SHALL describe pair-count aggregation instead of (or in addition to, historically) `CoChangeEvent[]` as the coupling feed

**Independent Test**: Doc review checklist in the docs task Done when.

**Requirements**: HOTSPOT-333, HOTSPOT-334

---

## Edge Cases

- WHEN a commit has 0 or 1 in-scope unique files THEN system SHALL add no pair increments for that commit
- WHEN a commit has exactly 100 in-scope unique files THEN system SHALL aggregate all `C(100, 2)` pairs (threshold is **strictly greater than** 100)
- WHEN a commit has 101 in-scope unique files THEN system SHALL skip coupling for that commit and emit mega-commit warning accounting
- WHEN rename canonicalization merges two pair keys into one THEN `coChangeCount` SHALL sum
- WHEN `min(commitsA, commitsB) === 0` AFTER filtering THEN the pair SHALL still be omitted from results (unchanged)
- WHEN mega-commits are skipped THEN pairs that only co-changed inside skipped commits SHALL be absent or under-counted vs a no-guard baseline — this is the **documented** exception

---

## Requirement Traceability

| Requirement ID | Story                                                          | Phase | Status |
| -------------- | -------------------------------------------------------------- | ----- | ------ |
| HOTSPOT-320    | P1: Stream-time pair aggregation                               | Tasks | Done   |
| HOTSPOT-321    | P1: Stream-time pair aggregation (`GitMinerResult` shape)      | Tasks | Done   |
| HOTSPOT-322    | P1: Stream-time pair aggregation (finalize canonicalize pairs) | Tasks | Done   |
| HOTSPOT-323    | P1: Preserved ranking below mega-guard                         | Tasks | Done   |
| HOTSPOT-324    | P1: Formula / min-cochange unchanged                           | Tasks | Done   |
| HOTSPOT-325    | P1: Mega-commit skip rule (threshold 100)                      | Tasks | Done   |
| HOTSPOT-326    | P1: Churn still aggregated on mega-commit                      | Tasks | Done   |
| HOTSPOT-327    | P1: `MEGA_COMMIT_SKIPPED` warnings + cap                       | Tasks | Done   |
| HOTSPOT-328    | P1: Scope predicate into aggregation                           | Tasks | Done   |
| HOTSPOT-329    | P1: In-scope mega-guard semantics                              | Tasks | Done   |
| HOTSPOT-330    | P1: `filterGitMinerResult` pair-count defense                  | Tasks | Done   |
| HOTSPOT-331    | P1: `scoreCoupling` accepts pair counts                        | Tasks | Done   |
| HOTSPOT-332    | P1: `runScan` / scorer wiring                                  | Tasks | Done   |
| HOTSPOT-333    | P2: CONCERNS / Performance docs                                | Tasks | Done   |
| HOTSPOT-334    | P2: Warning catalog + ARCHITECTURE                             | Tasks | Done   |

**ID range used:** HOTSPOT-320 … HOTSPOT-334 (HOTSPOT-335–339 reserved unused)  
**Coverage:** 15 total, mapped in tasks.md

---

## Success Criteria

- [x] Production coupling path does not retain full `coChangeEvents[]` through mine → score
- [x] Non-mega fixtures produce identical coupling rankings to pre-M32
- [x] Mega-commit fixtures skip pair updates and emit `MEGA_COMMIT_SKIPPED`
- [x] Path-scoped mega-guard uses in-scope unique file counts
- [x] CONCERNS documents the guard; `pnpm build && pnpm test` passes
