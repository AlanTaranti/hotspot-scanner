# Milestone 18 — CSV Bundle Export Specification

**Feature slug:** `csv-bundle`  
**Milestone:** ROADMAP M18  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [TESTING.md](../../codebase/TESTING.md)  
**Context:** [`.specs/features/csv-bundle/context.md`](./context.md)  
**Supersedes layout:** M17 [csv-export](../csv-export/spec.md) multi-block single-file CSV (historical; leave Done)

## Problem Statement

M17 shipped `--format csv` as one multi-block file (title rows + blank-line joins). That layout breaks strict RFC 4180 consumers (pandas `read_csv`, many Excel imports) and cannot represent incompatible column schemas cleanly. Pipelines and spreadsheets need a **multi-file bundle**: one schema per file, metadata in a JSON sidecar, and stable paths for compare deltas — including empty sections as header-only files.

## Goals

- [ ] `--format csv` emits a **stem-derived multi-file bundle** (not a single multi-block CSV)
- [ ] Metadata only in `{stem}.meta.json` (never inside CSV data files)
- [ ] Scan: ranking CSV + coupling CSV + meta; compare: always 6 data CSVs + meta
- [ ] `--format csv` **requires** `--output`; else `CliUsageError`
- [ ] Breaking replace of M17 layout — no legacy flag
- [ ] Reporter stays pure; CLI expands stem and writes N files
- [ ] `pnpm build && pnpm test` passing after Execute

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| Zip / archive of bundle | YAGNI |
| UTF-8 BOM | YAGNI — keep M17 UTF-8 without BOM |
| Wide / single flat CSV for all sections | Dual-consumer layout forbids |
| Legacy multi-block flag or dual layout | Breaking replace — locked |
| Emit-only-nonempty (skip empty files) | Always emit stable paths — locked |
| `--top` limiting CSV rows | Parity with M16/M17 — ignored for csv |
| CI fail thresholds | Milestone 12 |
| HTML, PDF, SARIF, Excel `.xlsx` | YAGNI |
| Auto-detect format from extension | M10 — `--format` is source of truth |
| Alter scoring, normalization, or JSON schema | M18 boundary — report/CLI only |
| `mkdir -p` / `--no-clobber` | Inherit M10 |
| Change `csv-utils.ts` escaping rules | Keep existing helpers |

---

## User Stories

### P1: CsvBundle reporter contract ⭐ MVP

**User Story**: As a library consumer of `src/report/`, I want CSV renderers to return a **`CsvBundle`** (suffix → content map) so that the CLI can write multiple files without putting `fs` in the reporter.

**Why P1**: Architectural pivot from M17 string → single write.

**Acceptance Criteria**:

1. WHEN `renderCsv(result)` runs THEN it SHALL return a `CsvBundle` (not a single multi-block string)
2. WHEN `renderCompareCsv(result)` runs THEN it SHALL return a `CsvBundle`
3. WHEN `createReporter().render(..., { format: "csv" })` runs THEN it SHALL return a `CsvBundle`
4. WHEN `createReporter().renderCompare(..., { format: "csv" })` runs THEN it SHALL return a `CsvBundle`
5. WHEN format is `table`, `json`, or `markdown` THEN `render` / `renderCompare` SHALL continue to return `string`
6. WHEN CSV modules run THEN they SHALL NOT import `node:fs` or perform I/O

**Independent Test**: Unit tests assert `CsvBundle` keys and string contents; no `fs` in report modules.

**Requirements**: HOTSPOT-135

---

### P1: Scan CSV bundle layout ⭐ MVP

**User Story**: As a data analyst, I want `scan --format csv --output out/report.csv` to write separate ranking and coupling CSVs plus a meta sidecar so that I can open each table in Excel or pandas without multi-block parsing.

**Why P1**: Primary scan deliverable for M18.

**Acceptance Criteria**:

1. WHEN `--output out/report.csv --format csv` succeeds THEN the CLI SHALL write `out/report.meta.json`, `out/report.coupling.csv`, and either `out/report.hotspots.csv` or `out/report.functions.csv`
2. WHEN `meta.granularity` is `"file"` (default) THEN the ranking file SHALL be `{stem}.hotspots.csv` and SHALL NOT write `{stem}.functions.csv`
3. WHEN `meta.granularity` is `"function"` THEN the ranking file SHALL be `{stem}.functions.csv` and SHALL NOT write `{stem}.hotspots.csv`
4. WHEN each data CSV is written THEN it SHALL contain a header row and zero or more data rows — **no** section title row
5. WHEN a ranking or coupling section has no rows THEN the file SHALL still be written as header-only
6. WHEN metadata is needed THEN it SHALL appear only in `{stem}.meta.json` (not as CSV rows)
7. WHEN numeric scores are rendered THEN they SHALL use 4 decimal places; integers SHALL have no decimals (M9/M11/M17 parity)
8. WHEN paths contain commas/quotes/newlines THEN cells SHALL use existing `csv-utils` RFC 4180 escaping
9. WHEN `--top N` is set with `--format csv` THEN CSV files SHALL contain **full** rankings (`top` ignored)

**Independent Test**: Unit tests on `renderCsv` bundle keys/headers; integration writes temp stem and asserts files.

**Requirements**: HOTSPOT-136, HOTSPOT-140, HOTSPOT-141, HOTSPOT-142

---

### P1: Compare CSV bundle layout ⭐ MVP

**User Story**: As a CI maintainer, I want compare CSV export to always produce six stable data files plus meta so that scripts can load fixed paths for new/removed/rank-changed hotspots (or functions) and coupling.

**Why P1**: ROADMAP M18 compare deliverable; breaking redesign of M17 compare CSV.

**Acceptance Criteria**:

1. WHEN compare runs with `--format csv --output out/compare.csv` THEN the CLI SHALL write `{stem}.meta.json` and **exactly six** data CSVs with hierarchical names per [design.md](./design.md) § File layout
2. WHEN granularity is `file` THEN ranking trio SHALL use `.hotspots.{new,removed,rank-changed}.csv` (not `.functions.*`)
3. WHEN granularity is `function` THEN ranking trio SHALL use `.functions.{new,removed,rank-changed}.csv` (not `.hotspots.*`)
4. WHEN coupling deltas exist or are empty THEN trio `.coupling.{new,removed,rank-changed}.csv` SHALL always be written
5. WHEN a section has zero rows THEN that file SHALL be header-only (still created)
6. WHEN `rankChanged` rows are rendered THEN columns SHALL include `baselineRank`, `currentRank`, `rankDelta` plus entity fields (reuse M17 column sets)
7. WHEN `removed` rows are rendered THEN `rank` column SHALL be present but empty
8. WHEN `--top N` is set THEN compare CSV files SHALL remain unsliced

**Independent Test**: `compare-csv.test.ts` asserts six keys + meta; empty sections header-only.

**Requirements**: HOTSPOT-137, HOTSPOT-140, HOTSPOT-141, HOTSPOT-142

---

### P1: CLI requires `--output` and multi-write ⭐ MVP

**User Story**: As a CLI user, I want `--format csv` to require `--output` and expand that path into a file bundle so that multi-file export is unambiguous.

**Why P1**: Stdout cannot represent a multi-file bundle.

**Acceptance Criteria**:

1. WHEN `--format csv` is used **without** `--output` THEN the CLI SHALL throw `CliUsageError` and exit `!= 0` (exit `2`)
2. WHEN `--format csv --output <path>` is provided THEN the CLI SHALL derive stem by stripping a trailing `.csv` from `<path>` if present; otherwise use `<path>` as stem
3. WHEN writing the bundle THEN each file path SHALL be `{stem}.{suffix}` where `suffix` comes from the `CsvBundle` keys
4. WHEN `--output` parent directory is missing or path is a directory THEN behavior SHALL match M10 `validateOutputPath` applied to the user-supplied `--output` path (fail fast; no `mkdir -p`)
5. WHEN bundle files already exist THEN they SHALL be overwritten without error
6. WHEN writing succeeds THEN report content SHALL NOT be written to stdout (stderr diagnostics unchanged)
7. WHEN format is not `csv` THEN existing single-string stdout/`--output` behavior SHALL be unchanged
8. WHEN commander help is shown THEN CSV SHALL document that `--output` is required for `--format csv`

**Independent Test**: `bin/hotspot-scanner.test.ts` — missing `--output` throws; stem expansion writes expected filenames.

**Requirements**: HOTSPOT-138, HOTSPOT-139

---

### P1: Column sets reuse M17 (no title rows) ⭐ MVP

**User Story**: As a spreadsheet user, I want CSV column headers to match the M17 data columns (without title rows) so that existing column documentation remains valid after the layout break.

**Why P1**: Reduces migration pain; only container format changes.

**Acceptance Criteria**:

1. WHEN scan hotspots CSV is rendered THEN columns SHALL match M17 hotspots columns from [csv-export/design.md](../csv-export/design.md) § Scan CSV Layout (minus title row)
2. WHEN scan functions CSV is rendered THEN columns SHALL match M17 functions columns
3. WHEN scan/compare coupling CSVs are rendered THEN columns SHALL match M17 coupling columns
4. WHEN compare new/removed/rank-changed sections are rendered THEN columns SHALL match M17 compare column sets
5. WHEN any CSV file starts THEN the first line SHALL be the header row (not a section title)

**Independent Test**: Header-row assertions in unit tests against design tables.

**Requirements**: HOTSPOT-141

---

### P1: Tests ⭐ MVP

**User Story**: As a CI maintainer, I want unit and integration tests for the CSV bundle so that the breaking change does not regress escaping, granularity XOR, or empty-file guarantees.

**Why P1**: Report + CLI coverage thresholds per TESTING.md.

**Acceptance Criteria**:

1. WHEN `csv.test.ts` runs THEN it SHALL assert scan `CsvBundle` keys, headers, granularity XOR, empty header-only files, and no title rows
2. WHEN `compare-csv.test.ts` runs THEN it SHALL assert six data keys + `meta.json`, file/function modes, empty header-only, removed empty rank
3. WHEN `index.test.ts` runs THEN it SHALL assert csv returns `CsvBundle`, `--top` ignored, other formats still return strings
4. WHEN `bin/hotspot-scanner.test.ts` runs THEN it SHALL assert `CliUsageError` without `--output` for csv and multi-file write for scan/compare
5. WHEN integration tests run on `small-ts` THEN `--format csv --output` SHALL exit `0` and create expected stem files; compare likewise
6. WHEN `--top 1 --format csv --output` runs THEN ranking CSV SHALL still contain all hotspot rows when fixture has multiple

**Independent Test**: Per-task Vitest gates in tasks.md.

**Requirements**: HOTSPOT-143

---

### P1: Documentation sync ⭐ MVP

**User Story**: As a maintainer, I want docs to describe the CSV bundle and the breaking change so that users do not expect M17 multi-block output.

**Why P1**: Workspace rule — significant CLI changes update `.specs/codebase/` and README.

**Acceptance Criteria**:

1. WHEN M18 Execute completes THEN [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md) SHALL document CSV bundle layout, `--output` required for csv, and `CsvBundle`
2. WHEN docs are synced THEN [STRUCTURE.md](../../codebase/STRUCTURE.md) SHALL reflect any new report helpers (e.g. bundle types / write helper location)
3. WHEN [README.md](../../../README.md) is read THEN CSV format docs SHALL describe multi-file bundle + required `--output`
4. WHEN [vitals-cli-validation](../../../.cursor/skills/vitals-cli-validation/SKILL.md) is read THEN examples SHALL use CSV bundle paths
5. WHEN planning completes THEN [ROADMAP.md](../../project/ROADMAP.md) M18 SHALL link this spec with `**Specs:** Planned` (implementation checkboxes unchecked until Execute Done)
6. WHEN ROADMAP M17 is read THEN an optional one-line note MAY state multi-block layout is superseded by M18

**Independent Test**: Doc review; grep for bundle / `meta.json` / requires `--output`.

**Requirements**: HOTSPOT-144

---

## Edge Cases

- WHEN `--format csv` without `--output` THEN `CliUsageError` (not silent stdout)
- WHEN rankings/coupling/compare sections are empty THEN header-only files still written
- WHEN `--output out/report` (no `.csv` suffix) THEN stem is `out/report` and files are `out/report.hotspots.csv`, etc.
- WHEN `--output out/report.csv` THEN stem is `out/report` (trailing `.csv` stripped once)
- WHEN granularity is function THEN no `.hotspots.*` files are created (and vice versa)
- WHEN paths contain special characters THEN `csv-utils` escaping applies
- WHEN unicode appears in paths THEN UTF-8 without BOM
- WHEN `--top N` combines with csv THEN full rankings still exported
- WHEN existing bundle files exist THEN overwrite each without error
- WHEN `--output` parent missing THEN fail fast per M10 (no mkdir)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-135 | P1: CsvBundle reporter contract | Tasks T1–T3 | Planned |
| HOTSPOT-136 | P1: Scan CSV bundle layout | Tasks T1, T3, T4 | Planned |
| HOTSPOT-137 | P1: Compare CSV bundle layout | Tasks T2, T3, T4 | Planned |
| HOTSPOT-138 | P1: CLI requires `--output` | Tasks T3, T4 | Planned |
| HOTSPOT-139 | P1: Stem expansion + multi-write | Tasks T3, T4 | Planned |
| HOTSPOT-140 | P1: Granularity XOR | Tasks T1, T2, T4 | Planned |
| HOTSPOT-141 | P1: No title rows; header-only empty; M17 columns | Tasks T1, T2 | Planned |
| HOTSPOT-142 | P1: `--top` ignored for csv | Tasks T1–T4 | Planned |
| HOTSPOT-143 | P1: Tests | Tasks T1–T4 | Planned |
| HOTSPOT-144 | P1: Documentation sync | Tasks T5 | Planned |

**Coverage:** 10 total, 10 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] All P1 acceptance criteria verifiable via Vitest + fixtures (no human judgment)
- [ ] `pnpm build && pnpm test` passes after Execute
- [ ] Report/CLI modules meet coverage thresholds per [TESTING.md](../../codebase/TESTING.md)
- [ ] `orchestrator-implementer` can execute T1–T5 without ambiguous scope
- [ ] No changes to scoring, normalization, coupling scorer, or ScanResult/CompareResult schemas
- [ ] M17 left Done/historical; M18 owns the breaking CSV redesign
