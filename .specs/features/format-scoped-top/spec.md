# Milestone 16 — Format-Scoped Top Limit Specification

**Feature slug:** `format-scoped-top`  
**Milestone:** ROADMAP M16  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [TESTING.md](../../codebase/TESTING.md)  
**Context:** [`.specs/features/format-scoped-top/context.md`](./context.md)

## Problem Statement

M5 introduced `--top N` as a display limit applied at render time via `sliceScanResult` and `sliceCompareResult`. M10/M13 extended this to markdown and compare deltas. M17 added CSV export with `--top` ignored (full rankings). **JSON still slices** when `--top` is set — inconsistent with pipeline design (full ranked lists from `runScan()`) and with ARCHITECTURE.md (documented during M17 planning).

Data pipelines and baseline export (`--format json --output`) need complete ranked arrays. Human-readable formats (`table`, `markdown`) should keep the default `--top 20` row limit. M16 scopes `--top` to display formats only.

## Goals

- [x] `--top` limits output only for `--format table` and `--format markdown` (scan and compare)
- [x] `--format json` outputs full ranked arrays; `--top` is ignored (scan and compare)
- [x] `--format csv` behavior unchanged from M17 (`--top` ignored)
- [x] Compare classification uses full rankings; slicing applies only to table/markdown delta display
- [x] `pnpm build && pnpm test` passing after Execute

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| Separate `--top-hotspots` / `--top-coupling` flags | YAGNI |
| Slicing in `runScan()` pipeline | M5 D3 — reporter owns display limit |
| Changing `DEFAULT_TOP` (20) | Out of scope |
| CI fail thresholds | Milestone 12 — CI Gate |
| Altering `ScanResult` / `CompareResult` schema | Render-only change |
| Warning when `--top` combined with JSON/CSV | YAGNI — flag accepted, ignored silently |
| Updating historical M5 `reporter-cli/spec.md` | Superseded by M16; noted in context.md |

---

## User Stories

### P1: Scan JSON ignores `--top` ⭐ MVP

**User Story**: As a pipeline author exporting scan results, I want `--format json` to always include full ranked arrays so that downstream tools receive complete data without re-scanning.

**Why P1**: ROADMAP M16 primary deliverable; closes gap between docs and implementation.

**Acceptance Criteria**:

1. WHEN `createReporter().render(result, { format: "json", top: N })` runs THEN parsed output SHALL contain the same number of `hotspots` (or `functions` in function mode) and `coupling` entries as the input `ScanResult`
2. WHEN `meta.granularity` is `"function"` THEN full `functions` array SHALL be present (not sliced)
3. WHEN `meta.granularity` is `"file"` THEN full `hotspots` array SHALL be present (not sliced)
4. WHEN `top` is `undefined` THEN JSON output SHALL match pre-M16 full-array behavior (no regression)

**Independent Test**: `index.test.ts` — fixture with 3 hotspots, `top: 1` → JSON `hotspots.length === 3`.

**Requirements**: HOTSPOT-129

---

### P1: Compare JSON ignores `--top` ⭐ MVP

**User Story**: As a CI maintainer comparing baselines, I want compare JSON to include all classified delta entities so that automation can process full delta sets.

**Why P1**: ROADMAP M16 requires scan **and** compare JSON parity with CSV full-export behavior.

**Acceptance Criteria**:

1. WHEN `createReporter().renderCompare(result, { format: "json", top: N })` runs THEN all `new`, `removed`, and `rankChanged` arrays in each section SHALL match the unsliced `CompareResult`
2. WHEN `compareScanResults()` classifies entities THEN it SHALL use full rankings from baseline and current scans (unchanged from M13)
3. WHEN `top` is provided with JSON compare THEN classification logic SHALL NOT be affected (slice helpers not called before `renderCompareJson`)

**Independent Test**: `index.test.ts` — compare fixture with multiple `rankChanged` rows, `top: 1` → JSON contains all classified rows per section.

**Requirements**: HOTSPOT-130

---

### P1: Table and markdown retain slicing ⭐ MVP

**User Story**: As a developer reading terminal or PR output, I want `--top N` to limit visible rows in table and markdown so that reports stay concise.

**Why P1**: Preserve existing human-readable behavior from M5/M10/M11/M13.

**Acceptance Criteria**:

1. WHEN `format` is `table` or `markdown` THEN `sliceScanResult(result, top)` SHALL apply before render
2. WHEN `format` is `table` or `markdown` on compare THEN `sliceCompareResult(result, top)` SHALL apply before render
3. WHEN `meta.granularity` is `"function"` THEN slicing SHALL apply to `functions` (not `hotspots`)
4. WHEN `top` is omitted THEN default CLI value (`DEFAULT_TOP = 20`) SHALL still limit table/markdown rows
5. WHEN sliced entries are rendered THEN field values SHALL match full `HotspotScore` / `FunctionHotspotScore` / `CouplingPair` objects (no recomputation)

**Independent Test**: `index.test.ts` — `format: "table", top: 2` → output contains at most 2 hotspot rows; `format: "markdown", top: 2` → same.

**Requirements**: HOTSPOT-131

---

### P1: Reporter factory dispatch ⭐ MVP

**User Story**: As the CLI entry point, I want `createReporter()` to apply `--top` only for display formats so that format selection controls slicing policy in one place.

**Why P1**: Single dispatch point; mirrors M17 CSV bypass pattern.

**Acceptance Criteria**:

1. WHEN `format` is `json` or `csv` THEN `render()` SHALL NOT call `sliceScanResult`
2. WHEN `format` is `json` or `csv` THEN `renderCompare()` SHALL NOT call `sliceCompareResult`
3. WHEN `format` is `table` or `markdown` THEN slice helpers SHALL be called with `options.top` before the matching renderer
4. WHEN `format` is `table`, `json`, `markdown`, or `csv` THEN renderer functions themselves SHALL remain unchanged (no format logic inside `renderJson`, `renderTable`, etc.)
5. WHEN `sliceScanResult` and `sliceCompareResult` are used THEN their internal logic SHALL be unchanged from M11/M13

**Independent Test**: `index.test.ts` — dispatch matrix for all four formats × scan and compare paths.

**Requirements**: HOTSPOT-132

---

### P1: Tests ⭐ MVP

**User Story**: As a CI maintainer, I want unit and integration tests for format-scoped `--top` so that JSON full-export and table slicing regressions are caught.

**Why P1**: Behavior change in `index.ts`; existing tests assert JSON slicing and must be updated.

**Acceptance Criteria**:

1. WHEN `index.test.ts` runs THEN JSON scan with `top: 2` on 3-hotspot fixture SHALL assert `hotspots.length === 3`
2. WHEN `index.test.ts` runs THEN compare JSON with `top: 2` SHALL assert unsliced delta section lengths
3. WHEN `index.test.ts` runs THEN table/markdown with `top: 2` SHALL assert sliced behavior unchanged
4. WHEN `index.test.ts` runs THEN CSV with `top: 1` SHALL still export all rows (M17 regression guard)
5. WHEN integration test runs `--top 1 --format json` on `small-ts` THEN output JSON SHALL contain more than one hotspot when fixture has multiple
6. WHEN integration test runs `--baseline ... --top 1 --format json` THEN compare JSON SHALL contain full delta sections

**Independent Test**: Per-file Vitest gates in tasks.md.

**Requirements**: HOTSPOT-133

---

### P1: CLI help and documentation sync ⭐ MVP

**User Story**: As a maintainer, I want docs and CLI help to state that `--top` applies only to table/markdown so that users discover the correct semantics without reading source.

**Why P1**: Workspace rule — significant CLI behavior changes update `.specs/codebase/` and README.

**Acceptance Criteria**:

1. WHEN commander help is shown THEN `--top` description SHALL indicate table/markdown-only scope
2. WHEN M16 Execute completes THEN [STATE.md](../../project/STATE.md) SHALL record format-scoped `--top` decision and JSON breaking change
3. WHEN [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md) is read THEN `--top` sections SHALL consistently state table/markdown-only slicing (no ambiguous “render time” without format qualifier)
4. WHEN [README.md](../../../README.md) flags table is read THEN `--top` SHALL document table/markdown scope
5. WHEN [vitals-cli-validation](../../../.cursor/skills/vitals-cli-validation/SKILL.md) is read THEN examples SHALL show JSON full export with `--top` ignored
6. WHEN planning completes THEN [ROADMAP.md](../../project/ROADMAP.md) M16 SHALL link to this spec with `**Specs:** Done`

**Independent Test**: Doc review; grep for `--top` in listed files; `bin/hotspot-scanner.test.ts` help text assertion if applicable.

**Requirements**: HOTSPOT-134

---

## Edge Cases

- WHEN `--top N` is combined with `--format json` THEN CLI SHALL exit `0` and output full arrays (no warning)
- WHEN `--top N` is combined with `--format csv` THEN behavior SHALL remain full export (M17 unchanged)
- WHEN baseline was saved with `--format json --top N` (pre-M16) THEN compare against that baseline SHALL still work (baseline-as-truth with N entities per M13)
- WHEN `granularity=function` and `format=table` THEN `--top` slices `functions` and `coupling` only
- WHEN compare has empty delta sections THEN JSON SHALL emit empty arrays; table/markdown SHALL show empty indicators (unchanged)
- WHEN rankings have fewer items than `top` THEN slice helpers SHALL return all available items (unchanged partial slice)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-129 | P1: Scan JSON ignores `--top` | Tasks T1 | Done |
| HOTSPOT-130 | P1: Compare JSON ignores `--top` | Tasks T1 | Done |
| HOTSPOT-131 | P1: Table/markdown retain slicing | Tasks T1 | Done |
| HOTSPOT-132 | P1: Reporter factory dispatch | Tasks T1 | Done |
| HOTSPOT-133 | P1: Tests | Tasks T1, T2 | Done |
| HOTSPOT-134 | P1: CLI help and documentation sync | Tasks T2, T3 | Done |

**Coverage:** 6 total, 6 mapped to tasks, 0 unmapped

---

## Success Criteria

- [x] All P1 acceptance criteria verifiable via Vitest + fixtures (no human judgment)
- [x] `pnpm build && pnpm test` passes after Execute
- [x] `src/report/index.ts` behavior matches ARCHITECTURE.md format-scoped `--top` policy
- [x] `orchestrator-implementer` can execute T1–T4 without ambiguous scope
- [x] No changes to scoring, normalization, compare engine, or JSON/CompareResult schemas
