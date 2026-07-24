# Milestone 13 — Scan Compare Specification

**Feature slug:** `scan-compare`  
**Milestone:** ROADMAP M13  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [TESTING.md](../../codebase/TESTING.md)  
**Context:** [`.specs/features/scan-compare/context.md`](./context.md)

## Problem Statement

M1–M11 produce point-in-time scan reports. CI pipelines and PR workflows need to know **what changed** between runs — new hotspots, removed files from the ranking, rank shifts, and new coupling pairs — without manually diffing JSON. M10 enables baseline export via `--output`; M11 adds function granularity. M13 closes the loop with `scan --baseline <file>` to produce a structured delta report.

## Goals

- [ ] Flag `--baseline <file>` on existing `scan` command: `hotspot-scanner scan <path> --baseline baseline.json`
- [ ] Without `--baseline`: behavior identical to M11 (no regression)
- [ ] With `--baseline`: delta report with `new`, `removed`, `rankChanged` for hotspots/functions and coupling pairs
- [ ] Support `meta.granularity` file and function modes (hard error on mismatch)
- [ ] Delta output in table, json, markdown + `--output` (M10 transport pattern)
- [ ] `pnpm build && pnpm test` passing after Execute

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature                                            | Reason                                                |
| -------------------------------------------------- | ----------------------------------------------------- |
| Subcomando `compare`                               | User decision — apenas `scan --baseline`              |
| CI fail thresholds / exit codes on metric breach   | Not planned — removed from roadmap (see STATE.md)     |
| Score-delta without rank change                    | YAGNI — ROADMAP pede rank-changed, não score-changed  |
| Compare across different granularities             | Hard error — indefinido                               |
| Block compare on `meta.since` mismatch             | Warning only — janelas distintas são válidas em CI    |
| HTML, PDF, SARIF                                   | YAGNI                                                 |
| Alter `ScanResult` v1.0 schema or scoring formulas | M13 boundary — new `CompareResult` type               |
| `mkdir -p` / `--no-clobber` for output             | Herdar decisões M10                                   |
| Re-scan baseline repo from baseline JSON           | Baseline is data-only; current scan uses `<path>` arg |

---

## User Stories

### P1: Baseline JSON loader + validation ⭐ MVP

**User Story**: As a CLI user, I want the baseline file loaded and validated as a `ScanResult` so that malformed baselines fail fast with actionable errors.

**Why P1**: Foundation for all compare logic; new failure surface must be explicit.

**Acceptance Criteria**:

1. WHEN `loadBaseline(path)` runs on valid M11 JSON THEN it SHALL return a typed `ScanResult` with `version: "1.0"`
2. WHEN JSON is malformed THEN loader SHALL throw with a message identifying parse failure
3. WHEN `version` is not `"1.0"` THEN loader SHALL throw with a message identifying unsupported version
4. WHEN required top-level keys (`hotspots`, `functions`, `coupling`, `meta`) are missing THEN loader SHALL throw with a message identifying the missing field
5. WHEN `meta.granularity` is not `"file"` or `"function"` THEN loader SHALL throw with a clear error

**Independent Test**: Unit test with valid fixture, malformed JSON, wrong version, missing keys.

**Requirements**: HOTSPOT-103

---

### P1: Entity identity keys ⭐ MVP

**User Story**: As the compare engine, I want stable entity keys so that baseline and current results match correctly across runs.

**Why P1**: Incorrect keys produce false new/removed/rank-changed classifications.

**Acceptance Criteria**:

1. WHEN a file hotspot is keyed THEN key SHALL equal `filePath`
2. WHEN a function hotspot is keyed THEN key SHALL be a composite of `filePath`, `functionName`, and `line`
3. WHEN a coupling pair is keyed THEN key SHALL use canonical `(fileA, fileB)` where `fileA < fileB` lexicographically (same as `coupling-scorer.ts`)
4. WHEN two entities share a key THEN they SHALL be treated as the same entity regardless of score field differences

**Independent Test**: Unit test key functions with sample entities including swapped coupling pair order.

**Requirements**: HOTSPOT-104

---

### P1: Compare engine — hotspots/functions ⭐ MVP

**User Story**: As a developer reviewing a PR, I want to see which hotspots or functions are new, removed, or changed rank compared to a baseline so that I can prioritize review.

**Why P1**: ROADMAP M13 primary deliverable for hotspot/function deltas.

**Acceptance Criteria**:

1. WHEN `compareScanResults(baseline, current)` runs in file mode THEN it SHALL classify each baseline hotspot key as `removed` (absent from current full ranking), `rankChanged` (present with different 1-based rank), or unchanged (same rank)
2. WHEN a current hotspot key is absent from baseline keys THEN it SHALL appear in `new`
3. WHEN `compareScanResults` runs in function mode THEN it SHALL apply the same rules to `functions` using function entity keys
4. WHEN baseline rank is computed THEN it SHALL be 1-based index in the baseline saved array (`hotspots` or `functions`)
5. WHEN current rank is computed THEN it SHALL be 1-based index in the full current ranked array from `runScan()` (pre-slice)
6. WHEN an entity is `rankChanged` THEN output SHALL include `baselineRank`, `currentRank`, and `rankDelta` (`currentRank - baselineRank`; positive = moved down)
7. WHEN file mode is active THEN `functions` sections in `CompareResult` SHALL be empty; WHEN function mode THEN `hotspots` sections SHALL be empty

**Independent Test**: Fixed baseline + current fixtures → assert `new`, `removed`, `rankChanged` arrays and rank fields.

**Requirements**: HOTSPOT-105

---

### P1: Compare engine — coupling pairs ⭐ MVP

**User Story**: As a developer, I want coupling pair deltas so that new hidden dependencies surface in PR review.

**Why P1**: ROADMAP M13 requires coupling delta alongside hotspots.

**Acceptance Criteria**:

1. WHEN `compareScanResults` runs THEN coupling SHALL be compared using canonical pair keys regardless of `meta.granularity`
2. WHEN a baseline coupling key is absent from current full coupling ranking THEN it SHALL appear in `coupling.removed`
3. WHEN a current coupling key is absent from baseline keys THEN it SHALL appear in `coupling.new`
4. WHEN a pair exists in both with different rank THEN it SHALL appear in `coupling.rankChanged` with rank fields per HOTSPOT-105
5. WHEN coupling compare completes THEN ranking source SHALL be full `coupling` arrays (pre-slice)

**Independent Test**: Unit test with swapped `fileA`/`fileB` order in baseline vs current — same canonical key.

**Requirements**: HOTSPOT-106

---

### P1: Granularity and metadata guards ⭐ MVP

**User Story**: As a CLI user, I want clear errors and warnings for incompatible baselines so that compare results are trustworthy.

**Why P1**: Prevents silent nonsense from granularity mismatch; informs on window differences.

**Acceptance Criteria**:

1. WHEN `baseline.meta.granularity !== current.meta.granularity` THEN compare SHALL throw before producing output
2. WHEN `baseline.meta.since !== current.meta.since` THEN compare SHALL add a warning string to `CompareResult.meta.warnings` and continue
3. WHEN compare succeeds THEN `CompareResult.meta` SHALL include both `baseline` and `current` `ScanMeta` objects
4. WHEN baseline file path does not exist THEN CLI SHALL exit `!= 0` before scan
5. WHEN baseline path is a directory THEN CLI SHALL exit `!= 0` with clear error

**Independent Test**: Unit test granularity mismatch throw; `since` mismatch warning in result; CLI test missing baseline file.

**Requirements**: HOTSPOT-107

---

### P1: CLI `scan --baseline` flag ⭐ MVP

**User Story**: As a CI maintainer, I want `scan --baseline <file>` so that I can diff the current repo against a saved JSON baseline using familiar scan flags.

**Why P1**: ROADMAP M13 user-facing entry point.

**Acceptance Criteria**:

1. WHEN `--baseline <file>` is provided THEN CLI SHALL load baseline, run `runScan()`, compare, and render delta (not normal scan report)
2. WHEN `--baseline` is omitted THEN behavior SHALL match M11 exactly
3. WHEN `--baseline` is combined with `--format`, `--output`, and `--top` THEN delta report SHALL respect those flags
4. WHEN `--baseline` is empty string THEN CLI SHALL reject with exit `!= 0`
5. WHEN compare completes without errors THEN exit code SHALL be `0` regardless of delta content
6. WHEN scan emits warnings/progress THEN they SHALL appear on stderr regardless of `--baseline` or `--output`

**Independent Test**: `bin/hotspot-scanner.test.ts` — `validateBaselinePath`, action branch; integration with fixture baseline.

**Requirements**: HOTSPOT-108

---

### P1: Delta reporters (table/json/markdown) ⭐ MVP

**User Story**: As a developer sharing PR results, I want delta reports in table, JSON, and markdown so that rank changes are visible in my preferred format.

**Why P1**: Consistent with M5/M10/M11 multi-format output.

**Acceptance Criteria**:

1. WHEN `meta.granularity` is `"file"` THEN table/markdown SHALL include **New Hotspots**, **Removed Hotspots**, **Rank Changed Hotspots** sections per [design.md](./design.md) § Table Layout
2. WHEN `meta.granularity` is `"function"` THEN table/markdown SHALL include equivalent **Functions** sections
3. WHEN coupling deltas exist THEN all formats SHALL include **Coupling** delta sections (new / removed / rank changed)
4. WHEN a section has no rows THEN it SHALL render an explicit empty indicator without throwing
5. WHEN `renderCompareJson` runs THEN output SHALL be valid JSON matching `CompareResult` schema
6. WHEN paths or function names contain pipe `|` characters THEN markdown cells SHALL escape them for valid GFM

**Independent Test**: Reporter unit tests with compare fixtures for file and function modes.

**Requirements**: HOTSPOT-109

---

### P1: Reporter factory dispatch ⭐ MVP

**User Story**: As the CLI entry point, I want `createReporter().renderCompare()` so that compare format selection stays out of `bin/`.

**Why P1**: Existing M5/M10 factory pattern; compare is a second render path.

**Acceptance Criteria**:

1. WHEN `createReporter().renderCompare(result, { format, top })` is called THEN it SHALL dispatch to table, json, or markdown compare renderers
2. WHEN `top` is provided THEN `sliceCompareResult` SHALL apply before render (same pattern as `sliceScanResult`)
3. WHEN `format` is `table`, `json`, or `markdown` THEN behavior for normal `render()` SHALL be unchanged from M11

**Independent Test**: `index.test.ts` — renderCompare all three formats from fixture.

**Requirements**: HOTSPOT-110

---

### P1: Tests + fixtures ⭐ MVP

**User Story**: As a CI maintainer, I want unit and integration tests for scan compare so that regressions are caught before release.

**Why P1**: New module `src/compare/` and CLI branch require ≥80% coverage per TESTING.md.

**Acceptance Criteria**:

1. WHEN `compare.test.ts` runs THEN it SHALL cover new/removed/rankChanged for hotspots, functions, and coupling
2. WHEN compare reporter tests run THEN they SHALL use fixtures under `tests/fixtures/report/compare-*.json`
3. WHEN `bin/hotspot-scanner.test.ts` runs THEN it SHALL cover `validateBaselinePath` and `--baseline` branch
4. WHEN integration test runs on `small-ts` with `--baseline` THEN CLI SHALL exit `0` and produce parseable delta JSON
5. WHEN integration test runs `scan` without `--baseline` THEN behavior SHALL match pre-M13 (regression guard)

**Independent Test**: Per-file Vitest gates in tasks.md.

**Requirements**: HOTSPOT-111

---

### P1: Documentation sync ⭐ MVP

**User Story**: As a maintainer, I want docs updated so that `--baseline` and compare output are discoverable without reading source.

**Why P1**: Workspace rule — significant CLI changes update `.specs/codebase/` and README.

**Acceptance Criteria**:

1. WHEN M13 Execute completes THEN [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md) SHALL document `--baseline` and compare data flow
2. WHEN docs are synced THEN [STRUCTURE.md](../../codebase/STRUCTURE.md) SHALL list `src/compare/` and compare reporter modules
3. WHEN [README.md](../../../README.md) is read THEN CLI flags table SHALL include `--baseline`
4. WHEN [vitals-cli-validation](../../../.cursor/skills/vitals-cli-validation/SKILL.md) is read THEN validation examples SHALL include baseline compare workflow
5. WHEN planning completes THEN [ROADMAP.md](../../project/ROADMAP.md) M13 SHALL link to this spec with `**Specs:** Done`

**Independent Test**: Doc review; grep for `--baseline` in listed files.

**Requirements**: HOTSPOT-112

---

## Edge Cases

- WHEN baseline has empty `hotspots`/`functions`/`coupling` arrays THEN compare SHALL produce valid delta with all current entities as `new`
- WHEN baseline was saved with `--top N` THEN compare tracks exactly those N baseline entities (baseline-as-truth)
- WHEN an entity exists in both scans at the same rank THEN it SHALL NOT appear in `new`, `removed`, or `rankChanged`
- WHEN an entity is removed from repo entirely THEN it SHALL appear in `removed` (absent from current full ranking)
- WHEN `--top` slices delta output THEN classification logic SHALL still use full rankings (pre-slice)
- WHEN JSON delta is written to file via `--output` THEN file SHALL NOT contain stderr warning or progress text
- WHEN `scan` runs without `--baseline` THEN output schema and behavior SHALL be unchanged from M11

---

## Requirement Traceability

| Requirement ID | Story                                   | Phase        | Status  |
| -------------- | --------------------------------------- | ------------ | ------- |
| HOTSPOT-103    | P1: Baseline JSON loader + validation   | Tasks T1     | Planned |
| HOTSPOT-104    | P1: Entity identity keys                | Tasks T1     | Planned |
| HOTSPOT-105    | P1: Compare engine — hotspots/functions | Tasks T2     | Planned |
| HOTSPOT-106    | P1: Compare engine — coupling pairs     | Tasks T2     | Planned |
| HOTSPOT-107    | P1: Granularity and metadata guards     | Tasks T1, T2 | Planned |
| HOTSPOT-108    | P1: CLI `scan --baseline` flag          | Tasks T4     | Planned |
| HOTSPOT-109    | P1: Delta reporters                     | Tasks T3     | Planned |
| HOTSPOT-110    | P1: Reporter factory dispatch           | Tasks T3     | Planned |
| HOTSPOT-111    | P1: Tests + fixtures                    | Tasks T5     | Planned |
| HOTSPOT-112    | P1: Documentation sync                  | Tasks T6     | Planned |

**Coverage:** 10 total, 10 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] All P1 acceptance criteria verifiable via Vitest + fixtures (no human judgment)
- [ ] `pnpm build && pnpm test` passes after Execute
- [ ] `src/compare/**` and compare reporter files ≥80% line coverage per [TESTING.md](../../codebase/TESTING.md)
- [ ] `orchestrator-implementer` can execute T1–T6 without ambiguous scope
- [ ] `scan` without `--baseline` behavior unchanged from M11
