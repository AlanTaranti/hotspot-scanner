# Milestone 4 — Scoring Specification

**Feature slug:** `scoring`  
**Milestone:** ROADMAP M4  
**Design SoT:** [IMPL-2026-003 §4.3, §5.1, §7.1, §8.4, §9, §13](../../../specifications/IMPL-2026-003-hotspot-scanner.md)  
**Context:** [`.specs/features/scoring/context.md`](./context.md)

## Problem Statement

The hotspot-scanner pipeline needs real hotspot and temporal-coupling rankings to surface maintenance risk. M2 delivers `FileChangeStats` and `CoChangeEvent[]`; M3 delivers `ComplexityResult[]`. Without M4 scoring, `runScan()` returns empty `hotspots` and `coupling` arrays and no maintenance signal is produced.

M1 delivered typed contracts in `src/scoring/index.ts` and domain types in `src/types/domain.ts`, but `createHotspotScorer()` and `createTemporalCouplingScorer()` still throw. Formula and normalization changes silently reorder rankings — a fragile area per [CONCERNS.md](../../codebase/CONCERNS.md).

## Goals

- [x] `HotspotScorer`: log-scale normalize complexity + churn, compute `hotspotScore`, sort desc
- [x] `TemporalCouplingScorer`: aggregate co-change pairs, apply `minCochange` threshold, compute `couplingStrength`, sort desc
- [x] `DEFAULT_MIN_COCHANGE = 3` exported for M5 CLI
- [x] Fixed-input fixture tests with expected ranking order
- [x] Functional `createHotspotScorer()` and `createTemporalCouplingScorer()`; ≥80% line coverage on `src/scoring/**`

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| `src/scan.ts` pipeline wiring | Milestone 6 — Integration |
| `bin/hotspot-scanner.ts` CLI flags (`--min-cochange`, `--top`, `--since`, `--format`) | Milestone 5 — Reporter + CLI |
| Reporter table/JSON output | Milestone 5 |
| Versioned Git fixture repo (`tests/fixtures/repos/`) | Milestone 6 — Integration |
| Extension filter at orchestration (intersect git paths with complexity paths) | M6 may filter at `runScan()` |
| Worker-thread parallelization | Deferred in [STATE.md](../../project/STATE.md) |
| Adding coupling into `hotspotScore` | IMPL §4.3 — separate rankings |

---

## User Stories

### P1: Log-scale normalization ⭐ MVP

**User Story**: As a scoring module implementer, I want a documented `normalizeLogMinMax()` function that applies log1p then min-max so that heavy-tailed churn and complexity distributions produce stable, auditable rankings.

**Why P1**: IMPL §4.3 leaves normalization strategy open; user decision captured in [context.md](./context.md). CONCERNS.md flags normalization as fragile.

**Acceptance Criteria**:

1. WHEN `normalizeLogMinMax(values)` is called with an array of non-negative numbers THEN each output SHALL equal `(log1p(v) - min) / (max - min)` where min/max are taken over the log1p-transformed set
2. WHEN all input values are equal (including single-element array) THEN all outputs SHALL be 0 (degenerate min-max)
3. WHEN an input value is 0 THEN `log1p(0)` SHALL be 0 and the value SHALL participate normally in min-max
4. WHEN the input array is empty THEN the function SHALL return an empty array

**Independent Test**: Unit tests on `normalize.ts` with fixed arrays and documented expected outputs.

**Requirements**: HOTSPOT-29

---

### P1: HotspotScorer formula ⭐ MVP

**User Story**: As a pipeline consumer, I want `hotspotScore = complexityNormalized × churnNormalized` for each file with complexity data so that files with both high complexity and high churn rank highest.

**Why P1**: Core hotspot signal per IMPL §4.3; all downstream reporting depends on this formula.

**Acceptance Criteria**:

1. WHEN `createHotspotScorer().score(fileStats, complexity)` is called THEN it SHALL produce one `HotspotScore` per `ComplexityResult` entry
2. WHEN a `ComplexityResult.filePath` has no matching `fileStats` entry THEN churn SHALL be treated as 0 (`commitCount = 0`)
3. WHEN complexity and churn are normalized THEN `hotspotScore` SHALL equal `complexityNormalized × churnNormalized`
4. WHEN churn is sourced from `fileStats` THEN it SHALL use raw `commitCount` (not `linesChanged` or relative churn)

**Independent Test**: Fixed `FileChangeStats` map + `ComplexityResult[]` → assert per-file normalized values and scores.

**Requirements**: HOTSPOT-30, HOTSPOT-31

---

### P1: Hotspot ranking determinism ⭐ MVP

**User Story**: As a test author, I want hotspot results sorted by `hotspotScore` descending with deterministic tie-breaking so that fixture tests assert exact ordering.

**Why P1**: CONCERNS.md — formula changes silently reorder rankings; tests must lock order.

**Acceptance Criteria**:

1. WHEN multiple files are scored THEN results SHALL be sorted by `hotspotScore` descending
2. WHEN two files have equal `hotspotScore` THEN tie-break SHALL be `filePath` ascending (lexicographic)
3. WHEN the same inputs are scored twice THEN output order SHALL be identical

**Independent Test**: Fixture with tied scores → stable order by `filePath`.

**Requirements**: HOTSPOT-32

---

### P1: Co-change pair aggregation ⭐ MVP

**User Story**: As a coupling scorer consumer, I want unordered file pairs counted from `CoChangeEvent[]` so that files changed together in multiple commits surface as coupled.

**Why P1**: Temporal coupling input derivation; incorrect pairing corrupts all coupling rankings.

**Acceptance Criteria**:

1. WHEN a `CoChangeEvent` contains N distinct file paths THEN the scorer SHALL increment co-change count for each unordered pair C(N, 2)
2. WHEN the same path appears twice in one commit's `filesChanged` THEN duplicates SHALL be deduplicated before pairing
3. WHEN pair (A, B) is counted THEN canonical order SHALL be `fileA < fileB` lexicographically

**Independent Test**: Synthetic `CoChangeEvent[]` with known pair counts.

**Requirements**: HOTSPOT-33

---

### P1: Coupling strength formula ⭐ MVP

**User Story**: As a pipeline consumer, I want `couplingStrength = coChangeCount / min(commitsA, commitsB)` so that coupling reflects co-change frequency relative to individual file churn.

**Why P1**: IMPL §4.3 closed formula; denominator uses raw commit counts per STATE.md.

**Acceptance Criteria**:

1. WHEN a pair (A, B) has `coChangeCount` co-changes THEN `couplingStrength` SHALL equal `coChangeCount / min(commitsA, commitsB)`
2. WHEN `commitsA` or `commitsB` is sourced THEN it SHALL use `fileStats.get(path).commitCount`
3. WHEN `min(commitsA, commitsB) === 0` THEN the pair SHALL be excluded from output (no NaN or Infinity)

**Independent Test**: Fixed stats + events → assert strength values and exclusions.

**Requirements**: HOTSPOT-34

---

### P1: minCochange threshold ⭐ MVP

**User Story**: As a developer tuning coupling sensitivity, I want pairs below a minimum co-change count excluded so that noise pairs do not dominate the coupling table.

**Why P1**: IMPL §6.1 `--min-cochange`; ROADMAP M4 deliverable. Default locked in [context.md](./context.md).

**Acceptance Criteria**:

1. WHEN `coChangeCount < minCochange` THEN the pair SHALL be excluded from output
2. WHEN `coChangeCount >= minCochange` AND denominator > 0 THEN the pair SHALL be included
3. WHEN `DEFAULT_MIN_COCHANGE` is imported from `src/scoring/` THEN its value SHALL be 3
4. WHEN boundary testing at N=3 THEN pairs with counts 2, 3, and 4 SHALL be excluded, included, and included respectively

**Independent Test**: Same events scored with `minCochange` 2, 3, 4 → assert inclusion/exclusion.

**Requirements**: HOTSPOT-35

---

### P1: Coupling ranking ⭐ MVP

**User Story**: As a test author, I want coupling pairs sorted by `couplingStrength` descending with deterministic tie-breaking so that fixture tests assert exact ordering.

**Why P1**: Reporter (M5) will display top N; order must be stable and testable.

**Acceptance Criteria**:

1. WHEN multiple pairs are scored THEN results SHALL be sorted by `couplingStrength` descending
2. WHEN two pairs have equal `couplingStrength` THEN tie-break SHALL be `fileA` ascending (lexicographic)
3. WHEN the same inputs are scored twice THEN output order SHALL be identical

**Independent Test**: Fixture with tied strengths → stable order by `fileA`.

**Requirements**: HOTSPOT-36

---

### P1: Scoring fixtures ⭐ MVP

**User Story**: As a CI maintainer, I want fixed scoring inputs with documented expected ranking order so that formula regressions are caught before reporting.

**Why P1**: CONCERNS.md mandates fixed inputs and expected order; TESTING.md requires ≥80% on `src/scoring/**`.

**Acceptance Criteria**:

1. WHEN listing `tests/fixtures/scoring/` THEN fixture files SHALL exist for hotspot ranking and coupling pairs
2. WHEN each fixture is scored THEN observed ordering SHALL match the expected order documented in the fixture header or companion metadata
3. WHEN fixture inputs include edge cases THEN they SHALL cover: missing churn, single file, equal scores, minCochange boundary, zero-commit denominator, within-commit dedupe

**Independent Test**: Fixture-driven tests in `hotspot-scorer.test.ts` and `coupling-scorer.test.ts`.

**Requirements**: HOTSPOT-37

---

### P1: Coverage gate ⭐ MVP

**User Story**: As a CI maintainer, I want ≥80% line coverage on `src/scoring/**` and a passing project gate so that scoring regressions are caught before integration.

**Why P1**: TESTING.md mandates ≥80% on scoring modules per IMPL §9.

**Acceptance Criteria**:

1. WHEN `pnpm test` runs with coverage THEN `src/scoring/**` SHALL report ≥80% line coverage
2. WHEN `pnpm build && pnpm test` runs THEN all tests SHALL pass with zero regressions
3. WHEN `index.test.ts` runs THEN it SHALL no longer expect "not implemented" / "Milestone 4" throws

**Independent Test**: `pnpm build && pnpm test` + coverage report for `src/scoring/`.

**Requirements**: HOTSPOT-38

---

## Edge Cases

- WHEN scored file set has one file THEN both normalized values SHALL be 0 and `hotspotScore` SHALL be 0
- WHEN all files have identical complexity THEN `complexityNormalized` SHALL be 0 for all
- WHEN all files have identical churn THEN `churnNormalized` SHALL be 0 for all
- WHEN `ComplexityResult[]` is empty THEN `HotspotScorer` SHALL return empty array
- WHEN `CoChangeEvent[]` is empty THEN `TemporalCouplingScorer` SHALL return empty array
- WHEN a commit has only one file THEN no pairs are produced from that event
- WHEN `min(commitsA, commitsB) === 0` THEN pair excluded regardless of `coChangeCount`
- WHEN `coChangeCount === minCochange - 1` THEN pair excluded; at `minCochange` included (if denominator > 0)
- WHEN paths contain slashes and unicode THEN pairing and join SHALL use exact string match on `filePath`

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-29 | P1: Log-scale normalization | Tasks T1 | Done |
| HOTSPOT-30 | P1: HotspotScorer formula | Tasks T2, T4 | Done |
| HOTSPOT-31 | P1: HotspotScorer formula | Tasks T2, T6 | Done |
| HOTSPOT-32 | P1: Hotspot ranking determinism | Tasks T2, T6 | Done |
| HOTSPOT-33 | P1: Co-change pair aggregation | Tasks T3, T7 | Done |
| HOTSPOT-34 | P1: Coupling strength formula | Tasks T3, T7 | Done |
| HOTSPOT-35 | P1: minCochange threshold | Tasks T3, T4, T7 | Done |
| HOTSPOT-36 | P1: Coupling ranking | Tasks T3, T7 | Done |
| HOTSPOT-37 | P1: Scoring fixtures | Tasks T5, T6, T7 | Done |
| HOTSPOT-38 | P1: Coverage gate | Tasks T8 | Done |

**Coverage:** 10 total, 10 mapped to tasks, 0 unmapped

---

## Success Criteria

- [x] All P1 acceptance criteria verifiable via Vitest + fixtures (no human judgment)
- [x] `pnpm build && pnpm test` passes after Execute
- [x] `src/scoring/**` ≥80% line coverage per [TESTING.md](../../codebase/TESTING.md)
- [x] `orchestrator-implementer` can execute T1–T8 without ambiguous scope
- [x] No changes to `src/scan.ts` or `bin/hotspot-scanner.ts` in M4
