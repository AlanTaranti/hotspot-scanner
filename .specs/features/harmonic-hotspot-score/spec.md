# Milestone 8 — Harmonic Hotspot Score Specification

**Feature slug:** `harmonic-hotspot-score`  
**Milestone:** ROADMAP M8  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [CONCERNS.md](../../codebase/CONCERNS.md), [TESTING.md](../../codebase/TESTING.md)  
**Supersedes:** M4 combiner aspect of [HOTSPOT-30](../scoring/spec.md) (product formula)

## Problem Statement

M4 scoring uses a multiplicative combiner (`hotspotScore = complexityNormalized × churnNormalized`) that favors one-axis outliers — a file with very high complexity but near-zero churn can still rank above a file with moderate but balanced signals on both axes. Teams prioritizing refactoring targets want files that are **actively complex and actively churned**, not spiky single-axis outliers.

M8 replaces only the combiner with the harmonic mean of normalized complexity and churn. Log1p + min-max normalization (M4 decision in [scoring/context.md](../scoring/context.md)) is unchanged. Formula changes silently reorder rankings — a fragile area per [CONCERNS.md](../../codebase/CONCERNS.md).

## Goals

- [ ] Replace combiner with harmonic mean: `hotspotScore = 2ch / (c + h)`
- [ ] Zero guard: when `c + h === 0`, score is `0`
- [ ] Update scoring fixtures and unit tests with new expected rankings
- [ ] Record decision in STATE.md; sync CONCERNS.md, README, fragile-areas rule, pipeline-domain skill
- [ ] `pnpm build && pnpm test` passing after Execute

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| Change to `normalizeLogMinMax` | ROADMAP: "same normalization" |
| `couplingStrength` / `TemporalCouplingScorer` | M8 scope is hotspot combiner only |
| `--score-formula` flag / product-formula retrocompat | YAGNI; no ROADMAP requirement |
| Rich output raw metrics (M9), CI gate (M12) | Future milestones |
| Edit M4 scoring spec | M8 supersedes combiner only; M4 spec remains historical |

---

## User Stories

### P1: Harmonic combiner ⭐ MVP

**User Story**: As a pipeline consumer, I want `hotspotScore = 2 × complexityNormalized × churnNormalized / (complexityNormalized + churnNormalized)` so that files with balanced high complexity and churn rank above one-axis outliers.

**Why P1**: Core product signal change per ROADMAP M8; all downstream reporting depends on this formula.

**Acceptance Criteria**:

1. WHEN `createHotspotScorer().score(fileStats, complexity)` is called THEN it SHALL produce one `HotspotScore` per `ComplexityResult` entry
2. WHEN complexity and churn are normalized THEN `hotspotScore` SHALL equal `(2 × c × h) / (c + h)` where `c = complexityNormalized` and `h = churnNormalized`
3. WHEN output is produced THEN `complexityNormalized` and `churnNormalized` fields SHALL remain unchanged from M4 normalization
4. WHEN churn is sourced from `fileStats` THEN it SHALL still use raw `commitCount` (not `linesChanged`)

**Independent Test**: Fixed `FileChangeStats` map + `ComplexityResult[]` → assert per-file harmonic scores via `toBeCloseTo`.

**Requirements**: HOTSPOT-69

---

### P1: Zero guard ⭐ MVP

**User Story**: As a scoring module implementer, I want a zero guard when both normalized signals sum to zero so that degenerate inputs never produce `NaN` or `Infinity`.

**Why P1**: ROADMAP M8 explicit deliverable; covers zero churn, missing stats, and single-file degenerate normalization.

**Acceptance Criteria**:

1. WHEN `c + h === 0` THEN `hotspotScore` SHALL be `0`
2. WHEN `c === 0` and `h > 0` THEN `hotspotScore` SHALL be `0`
3. WHEN `h === 0` and `c > 0` THEN `hotspotScore` SHALL be `0`
4. WHEN scoring completes THEN no output entry SHALL contain `NaN` or `Infinity`

**Independent Test**: Inputs with zero churn, missing `fileStats`, and single-file scan → all scores `0`.

**Requirements**: HOTSPOT-70

---

### P1: Balanced beats spiky ⭐ MVP

**User Story**: As a developer prioritizing refactoring, I want a file with balanced normalized signals to rank above a file with one axis near zero and the other near one so that hotspot rankings reflect dual-signal maintenance risk.

**Why P1**: Validates the product motivation for harmonic mean over product; cannot be inferred from fixture alone.

**Acceptance Criteria**:

1. WHEN file A has `complexityNormalized ≈ churnNormalized` (both high) and file B has one normalized value near `0` and the other near `1` THEN file A SHALL rank above file B
2. WHEN the balanced-vs-spiky test runs THEN it SHALL use explicit normalized inputs (not depend on log-min-max of a multi-file set alone)

**Independent Test**: Dedicated unit test with controlled inputs demonstrating balanced file outranks spiky file.

**Requirements**: HOTSPOT-71

---

### P1: Ranking determinism ⭐ MVP

**User Story**: As a test author, I want hotspot results sorted by `hotspotScore` descending with deterministic tie-breaking so that fixture tests assert exact ordering after the formula change.

**Why P1**: CONCERNS.md — formula changes silently reorder rankings; M4 tie-break behavior must be preserved.

**Acceptance Criteria**:

1. WHEN multiple files are scored THEN results SHALL be sorted by `hotspotScore` descending
2. WHEN two files have equal `hotspotScore` THEN tie-break SHALL be `filePath` ascending (lexicographic)
3. WHEN the same inputs are scored twice THEN output order SHALL be identical

**Independent Test**: Fixture with tied scores → stable order by `filePath`.

**Requirements**: HOTSPOT-72

---

### P1: Fixture regression lock ⭐ MVP

**User Story**: As a CI maintainer, I want fixed scoring inputs with documented expected ranking order under the harmonic formula so that combiner regressions are caught before reporting.

**Why P1**: CONCERNS.md mandates fixed inputs and expected order; TESTING.md requires ≥80% on `src/scoring/**`.

**Acceptance Criteria**:

1. WHEN `tests/fixtures/scoring/hotspot-ranking.json` is scored THEN observed ordering SHALL match `expectedOrder` in the fixture
2. WHEN the fixture `_comment` is read THEN it SHALL document the harmonic formula and expected file order
3. WHEN fixture inputs include edge cases THEN they SHALL still cover: missing churn, zero churn, varied complexity/churn

**Independent Test**: Fixture-driven test in `hotspot-scorer.test.ts` asserting `expectedOrder`.

**Requirements**: HOTSPOT-73

---

### P1: Integration invariant ⭐ MVP

**User Story**: As an integration test author, I want the `small-ts` fixture to keep `src/high.ts` as the top hotspot so that end-to-end pipeline behavior remains stable for the primary integration fixture.

**Why P1**: `src/high.ts` dominates both complexity and churn in the fixture; harmonic mean should preserve top ranking.

**Acceptance Criteria**:

1. WHEN `runScan({ repoPath: small-ts })` completes THEN `hotspots[0].filePath` SHALL be `src/high.ts`
2. WHEN integration test runs THEN hotspot and coupling rankings SHALL remain non-empty

**Independent Test**: `src/scan.integration.test.ts` — adjust assertion only if harmonic reordering changes top file (expected: no change).

**Requirements**: HOTSPOT-74

---

### P1: Documentation sync ⭐ MVP

**User Story**: As a maintainer, I want all references to the product combiner updated so that docs, rules, and skills reflect the harmonic formula without reading source.

**Why P1**: ROADMAP M8 deliverable; workspace rule — significant scoring changes update `.specs/codebase/` and related docs.

**Acceptance Criteria**:

1. WHEN M8 Execute completes THEN [STATE.md](../../project/STATE.md) SHALL record the harmonic combiner decision with rationale
2. WHEN docs are synced THEN [CONCERNS.md](../../codebase/CONCERNS.md), [README.md](../../../README.md), [fragile-areas.mdc](../../../.cursor/rules/fragile-areas.mdc), [vitals-pipeline-domain/SKILL.md](../../../.cursor/skills/vitals-pipeline-domain/SKILL.md), and [PROJECT.md](../../project/PROJECT.md) SHALL reference `2ch / (c + h)` instead of `c × h`
3. WHEN planning completes THEN [ROADMAP.md](../../project/ROADMAP.md) M8 SHALL link to this spec

**Independent Test**: Doc review; grep for stale `×` product formula references in listed files.

**Requirements**: HOTSPOT-75

---

## Edge Cases

- WHEN scored file set has one file THEN both normalized values SHALL be 0 and `hotspotScore` SHALL be 0
- WHEN all files have identical complexity THEN `complexityNormalized` SHALL be 0 for all
- WHEN all files have identical churn THEN `churnNormalized` SHALL be 0 for all
- WHEN `ComplexityResult[]` is empty THEN `HotspotScorer` SHALL return empty array
- WHEN a `ComplexityResult.filePath` has no matching `fileStats` entry THEN churn SHALL be treated as 0 and `hotspotScore` SHALL be 0
- WHEN `c === h > 0` THEN `hotspotScore` SHALL equal `c` (harmonic mean property)
- WHEN normalized values are in `[0, 1]` THEN `hotspotScore` SHALL be in `[0, 1]`
- WHEN paths contain slashes and unicode THEN join and sort SHALL use exact string match on `filePath`

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-69 | P1: Harmonic combiner | Tasks T1 | Pending |
| HOTSPOT-70 | P1: Zero guard | Tasks T1 | Pending |
| HOTSPOT-71 | P1: Balanced beats spiky | Tasks T1 | Pending |
| HOTSPOT-72 | P1: Ranking determinism | Tasks T1 | Pending |
| HOTSPOT-73 | P1: Fixture regression lock | Tasks T2 | Pending |
| HOTSPOT-74 | P1: Integration invariant | Tasks T3 | Pending |
| HOTSPOT-75 | P1: Documentation sync | Tasks T4 | Pending |

**Coverage:** 7 total, 7 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] All P1 acceptance criteria verifiable via Vitest + fixtures (no human judgment)
- [ ] `pnpm build && pnpm test` passes after Execute
- [ ] `src/scoring/**` ≥80% line coverage per [TESTING.md](../../codebase/TESTING.md)
- [ ] `orchestrator-implementer` can execute T1–T4 without ambiguous scope
- [ ] No changes to `coupling-scorer.ts`, `normalize.ts`, `bin/`, or `src/report/` schema
