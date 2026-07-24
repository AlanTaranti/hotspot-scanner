# Milestone 9 — Rich Output Specification

**Feature slug:** `rich-output`  
**Milestone:** ROADMAP M9  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [TESTING.md](../../codebase/TESTING.md)  
**Supersedes:** M5 deferred raw metrics aspect of [HOTSPOT-42](../reporter-cli/spec.md) (JSON schema)

## Problem Statement

M1–M8 deliver ranked hotspots with normalized complexity and churn scores, but consumers cannot see the underlying raw signals without re-running the pipeline or reading source. M5 explicitly deferred `cyclomaticComplexity`, `commitCount`, `linesChanged`, `functionCount`, and `authors` from JSON output. Table output shows only normalized values, making it hard to triage whether a high score reflects genuine maintenance pressure or normalization artifacts.

M9 enriches hotspot output with raw metrics and bus-factor (`authorCount`) while keeping scoring formulas (M8 harmonic combiner) and coupling output unchanged. JSON `version` remains `"1.0"` — additive fields only.

## Goals

- [ ] `HotspotScore` includes raw `cyclomaticComplexity`, `commitCount`, `linesChanged`, `functionCount`, `authorCount`
- [ ] JSON hotspots serialize all raw fields alongside normalized scores
- [ ] Table output shows raw metrics alongside normalized scores
- [ ] `authorCount` derived from existing `FileChangeStats.authors` Set (bus factor)
- [ ] `pnpm build && pnpm test` passing after Execute

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| `authors: string[]` in JSON | ROADMAP requests `authorCount` only (bus factor) |
| Bump `version` to `"1.1"` | User decision — additive change under `"1.0"` |
| Coupling pair enrichment | M9 scope is hotspots only; coupling already has `coChangeCount` |
| `--format markdown` / `--output <path>` | Milestone 10 — Export Formats |
| Per-function granularity (`--granularity`) | Milestone 11 |
| CI fail thresholds / exit codes on metric breach | Not planned — removed from roadmap (see STATE.md) |
| Alter harmonic combiner or normalization | M8 boundary |
| Edit M5 reporter-cli spec | M9 supersedes deferred raw-metrics aspect only |

---

## User Stories

### P1: HotspotScore raw enrichment ⭐ MVP

**User Story**: As a pipeline consumer, I want each `HotspotScore` entry to carry raw complexity and git metrics so that downstream tools can reason about absolute values without re-parsing the repository.

**Why P1**: Core data contract change; reporters and JSON inherit fields from `HotspotScore`.

**Acceptance Criteria**:

1. WHEN `scoreHotspots(fileStats, complexity)` runs THEN each output entry SHALL include `cyclomaticComplexity` and `functionCount` from the matching `ComplexityResult`
2. WHEN `fileStats` has an entry for the file THEN `commitCount`, `linesChanged`, and `authorCount` SHALL come from `FileChangeStats`
3. WHEN `authorCount` is computed THEN it SHALL equal `authors.size` on the `FileChangeStats` entry
4. WHEN a `ComplexityResult.filePath` has no matching `fileStats` entry THEN `commitCount`, `linesChanged`, and `authorCount` SHALL be `0`
5. WHEN scoring completes THEN normalized fields (`complexityNormalized`, `churnNormalized`, `hotspotScore`) SHALL remain unchanged from M8 behavior

**Independent Test**: Fixed `FileChangeStats` map + `ComplexityResult[]` → assert per-file raw fields on `HotspotScore`.

**Requirements**: HOTSPOT-76

---

### P1: Scorer unit tests for raw fields ⭐ MVP

**User Story**: As a test author, I want unit tests verifying raw field population and missing-git defaults so that scorer regressions are caught before reporting.

**Why P1**: `src/scoring/**` requires ≥80% coverage per TESTING.md; raw enrichment lives in `scoreHotspots()`.

**Acceptance Criteria**:

1. WHEN scorer test runs with full `fileStats` THEN each hotspot SHALL expose all five raw fields with expected values
2. WHEN scorer test runs with missing `fileStats` for a complexity entry THEN git-side raw fields SHALL be `0`
3. WHEN `authors` Set has N entries THEN `authorCount` SHALL be `N`
4. WHEN scoring completes THEN no output entry SHALL contain `undefined` raw fields

**Independent Test**: `hotspot-scorer.test.ts` — raw field assertions + missing stats case.

**Requirements**: HOTSPOT-80

---

### P1: JSON schema enrichment ⭐ MVP

**User Story**: As a developer integrating with other tools, I want `--format json` hotspots to include raw metrics so that I can build dashboards without re-scanning.

**Why P1**: ROADMAP M9 primary deliverable; `renderJson()` is pass-through on `ScanResult`.

**Acceptance Criteria**:

1. WHEN reporter renders JSON THEN each hotspot object SHALL include `cyclomaticComplexity`, `commitCount`, `linesChanged`, `functionCount`, and `authorCount`
2. WHEN `version` is present THEN its value SHALL remain `"1.0"`
3. WHEN JSON is serialized THEN `authors` Set SHALL NOT appear (no `authors` key)
4. WHEN existing normalized fields are present THEN they SHALL remain: `filePath`, `complexityNormalized`, `churnNormalized`, `hotspotScore`
5. WHEN `coupling` is serialized THEN its schema SHALL be unchanged from M5

**Independent Test**: `json.test.ts` with updated `sample-result.json` fixture asserting all hotspot fields.

**Requirements**: HOTSPOT-77

---

### P1: Table raw columns ⭐ MVP

**User Story**: As a developer triaging maintenance risk in the terminal, I want raw complexity and churn values alongside normalized scores so that I can interpret rankings without switching to JSON.

**Why P1**: ROADMAP M9 table deliverable; primary human-readable output.

**Acceptance Criteria**:

1. WHEN reporter renders table format THEN the **Top Hotspots** section SHALL include raw and normalized columns per [design.md](./design.md) § Table Layout
2. WHEN integer raw values are displayed (`cyclomaticComplexity`, `commitCount`, `linesChanged`, `functionCount`, `authorCount`) THEN they SHALL use integer formatting (no decimal places)
3. WHEN normalized values and `hotspotScore` are displayed THEN they SHALL use 4 decimal places (M5 `SCORE_DECIMALS`)
4. WHEN file paths exceed column width THEN truncation behavior SHALL match M5 (24-char pad/truncate)
5. WHEN hotspots array is empty THEN section SHALL still render `(none)` without throwing
6. WHEN coupling section renders THEN it SHALL be unchanged from M5

**Independent Test**: `table.test.ts` asserting column headers and raw integer values in output.

**Requirements**: HOTSPOT-78

---

### P1: Reporter fixture and tests ⭐ MVP

**User Story**: As a CI maintainer, I want the shared reporter fixture updated with raw fields so that JSON and table tests stay in sync.

**Why P1**: `sample-result.json` is the single fixture for both `json.test.ts` and `table.test.ts`.

**Acceptance Criteria**:

1. WHEN `tests/fixtures/report/sample-result.json` is loaded THEN each hotspot SHALL include all five raw fields with documented values
2. WHEN `_comment` is read THEN it SHALL document M9 raw field additions
3. WHEN `json.test.ts` and `table.test.ts` run THEN they SHALL assert presence of raw fields on fixture data

**Independent Test**: Both reporter test files pass with updated fixture.

**Requirements**: HOTSPOT-79

---

### P1: Integration invariant ⭐ MVP

**User Story**: As an integration test author, I want the `small-ts` fixture scan to produce JSON hotspots with positive raw values on the top file so that end-to-end enrichment is verified.

**Why P1**: Confirms pipeline wiring from git + complexity through scorer to `ScanResult`.

**Acceptance Criteria**:

1. WHEN `runScan({ repoPath: small-ts })` completes THEN `hotspots[0]` SHALL include all five raw fields
2. WHEN top hotspot is `src/high.ts` THEN `cyclomaticComplexity`, `commitCount`, and `authorCount` SHALL be greater than `0`
3. WHEN integration test runs THEN hotspot and coupling rankings SHALL remain non-empty

**Independent Test**: `scan.integration.test.ts` — assert raw fields on top hotspot.

**Requirements**: HOTSPOT-81

---

### P1: Documentation sync ⭐ MVP

**User Story**: As a maintainer, I want docs and cross-references updated so that the enriched `HotspotScore` schema is discoverable without reading source.

**Why P1**: Workspace rule — significant schema changes update `.specs/codebase/` and related docs.

**Acceptance Criteria**:

1. WHEN M9 Execute completes THEN [STATE.md](../../project/STATE.md) SHALL record `authorCount` exposure decision with rationale (bus factor)
2. WHEN docs are synced THEN [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md) SHALL document enriched `HotspotScore` / JSON hotspot fields
3. WHEN [path-scoping/spec.md](../path-scoping/spec.md) Out of Scope is read THEN rich-output reference SHALL point to M9 (not M8) and export formats to M10
4. WHEN planning completes THEN [ROADMAP.md](../../project/ROADMAP.md) M9 SHALL link to this spec with `**Specs:** Done`

**Independent Test**: Doc review; grep for stale M5-only hotspot schema references in listed files.

**Requirements**: HOTSPOT-82

---

## Edge Cases

- WHEN `ComplexityResult[]` is empty THEN scorer SHALL return empty array (no raw fields to emit)
- WHEN `authors` Set is empty on a `FileChangeStats` entry THEN `authorCount` SHALL be `0`
- WHEN file has complexity but zero commits in scan window THEN `commitCount`, `linesChanged`, `authorCount` SHALL be `0` while complexity raw fields reflect AST analysis
- WHEN `cyclomaticComplexity` is `0` (empty file) THEN it SHALL serialize as `0` in JSON and table
- WHEN `functionCount` is `0` THEN it SHALL serialize as `0`
- WHEN paths contain slashes and unicode THEN join and display SHALL use exact string match on `filePath`
- WHEN `--top N` slices results THEN raw fields on sliced entries SHALL match full `HotspotScore` values (no recomputation at render)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-76 | P1: HotspotScore raw enrichment | Tasks T1 | Done |
| HOTSPOT-77 | P1: JSON schema enrichment | Tasks T2 | Done |
| HOTSPOT-78 | P1: Table raw columns | Tasks T3 | Done |
| HOTSPOT-79 | P1: Reporter fixture and tests | Tasks T2, T3 | Done |
| HOTSPOT-80 | P1: Scorer unit tests | Tasks T1 | Done |
| HOTSPOT-81 | P1: Integration invariant | Tasks T4 | Done |
| HOTSPOT-82 | P1: Documentation sync | Tasks T4 | Done |

**Coverage:** 7 total, 7 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] All P1 acceptance criteria verifiable via Vitest + fixtures (no human judgment)
- [ ] `pnpm build && pnpm test` passes after Execute
- [ ] `src/scoring/**` and `src/report/**` ≥80% line coverage per [TESTING.md](../../codebase/TESTING.md)
- [ ] `orchestrator-implementer` can execute T1–T4 without ambiguous scope
- [ ] No changes to coupling scorer, normalization, harmonic combiner, or CLI flags
