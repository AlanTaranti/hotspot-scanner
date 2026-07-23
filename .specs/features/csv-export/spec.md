# Milestone 17 — CSV Export Specification

**Feature slug:** `csv-export`  
**Milestone:** ROADMAP M17  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [TESTING.md](../../codebase/TESTING.md)  
**Context:** [`.specs/features/csv-export/context.md`](./context.md)

## Problem Statement

M10 added markdown for PR-friendly reports and `--output` for file export. M13 added compare deltas in table, JSON, and markdown. Data pipelines (spreadsheets, BI tools, ad-hoc scripts) need **tabular CSV** with proper escaping for file paths containing commas or quotes. Shell redirect does not standardize RFC 4180 escaping; JSON requires a parser. M17 adds `--format csv` for scan and compare output.

## Goals

- [x] `--format csv` CLI option on `scan` (with and without `--baseline`)
- [x] `renderCsv()` and `renderCompareCsv()` in `src/report/`
- [x] RFC 4180 field escaping for paths and names
- [x] Works with `--output <path>` (M10 transport rules)
- [x] `--top` ignored for CSV (full rankings, parity with JSON / M16)
- [x] `pnpm build && pnpm test` passing after Execute

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| `--top` limiting CSV rows | M16 scopes `--top` to table/markdown only; CSV exports full data like JSON |
| CI fail thresholds | Milestone 12 — CI Gate |
| HTML, PDF, SARIF, Excel `.xlsx` | YAGNI |
| Auto-detect format from file extension | M10 decision — `--format` is source of truth |
| Alter scoring, normalization, or JSON schema | M17 boundary — new renderers only |
| `mkdir -p` / `--no-clobber` for output | Inherit M10 decisions |
| UTF-8 BOM for Excel | YAGNI — see context.md |
| Single flat CSV schema for all sections | Different column sets per section; multi-block layout |

---

## User Stories

### P1: RFC 4180 field escaping ⭐ MVP

**User Story**: As a data pipeline author, I want CSV fields escaped per RFC 4180 so that file paths with commas, quotes, or newlines parse correctly in standard tools.

**Why P1**: Core correctness for CSV export; paths are the primary failure mode.

**Acceptance Criteria**:

1. WHEN a field contains a comma THEN `escapeCsvField()` SHALL wrap the field in double quotes
2. WHEN a field contains a double quote THEN the field SHALL be quoted and internal quotes doubled (`""`)
3. WHEN a field contains CR, LF, or CRLF THEN the field SHALL be quoted
4. WHEN a field contains none of the above THEN it MAY be emitted unquoted
5. WHEN `formatCsvRow(fields)` runs THEN it SHALL join escaped fields with commas and no trailing comma

**Independent Test**: `csv-utils.test.ts` — matrix of plain, comma, quote, newline, combined, and unicode paths.

**Requirements**: HOTSPOT-121

---

### P1: Scan CSV renderer ⭐ MVP

**User Story**: As a developer exporting scan results to a spreadsheet, I want `--format csv` to produce tabular hotspots (or functions) and coupling sections so that I can analyze maintenance risk without JSON parsing.

**Why P1**: ROADMAP M17 primary scan deliverable.

**Acceptance Criteria**:

1. WHEN `renderCsv(result)` runs THEN output SHALL include a metadata block (`key,value` rows) with `scan_window`, `scanned_at`, and `granularity` when present
2. WHEN `meta.granularity` is `"file"` THEN output SHALL include a **Top Hotspots** section with columns per [design.md](./design.md) § Scan CSV Layout
3. WHEN `meta.granularity` is `"function"` THEN output SHALL include a **Top Functions** section instead of hotspots
4. WHEN coupling pairs exist THEN output SHALL include a **Top Coupling Pairs** section
5. WHEN a section has no rows THEN it SHALL render title + header rows with zero data rows (no throw)
6. WHEN numeric scores or normalized values are displayed THEN they SHALL use 4 decimal places; integer fields SHALL have no decimal places (match M9/M11)
7. WHEN file paths or function names contain special characters THEN cells SHALL use RFC 4180 escaping

**Independent Test**: `csv.test.ts` with `sample-result.json` fixture — assert block structure, headers, formatting, granularity branch.

**Requirements**: HOTSPOT-122

---

### P1: `--format csv` CLI ⭐ MVP

**User Story**: As a CLI user, I want `--format csv` accepted on `scan` so that I can select CSV output explicitly.

**Why P1**: User-facing format enum extension.

**Acceptance Criteria**:

1. WHEN `--format csv` is provided THEN `parseFormat()` and commander SHALL accept `csv`
2. WHEN `--format` is not `table`, `json`, `markdown`, or `csv` THEN the CLI SHALL print an error and exit with code `!= 0`
3. WHEN `--format csv` is used without `--output` THEN CSV SHALL be written to stdout (same channel as other formats)
4. WHEN `--format` is omitted THEN default SHALL remain `table`
5. WHEN commander help is shown THEN `csv` SHALL appear in the format option description

**Independent Test**: `bin/hotspot-scanner.test.ts` — `parseFormat("csv")` succeeds; invalid format error lists `csv`.

**Requirements**: HOTSPOT-123

---

### P1: Compare CSV renderer ⭐ MVP

**User Story**: As a CI maintainer comparing baselines, I want compare deltas in CSV so that rank changes can be loaded into spreadsheet or BI tools.

**Why P1**: ROADMAP M17 requires scan **and** compare CSV support.

**Acceptance Criteria**:

1. WHEN `renderCompareCsv(result)` runs in file mode THEN output SHALL include sections: **New Hotspots**, **Removed Hotspots**, **Rank Changed Hotspots**, and coupling delta sections per [design.md](./design.md) § Compare CSV Layout
2. WHEN `result.granularity` is `"function"` THEN output SHALL include equivalent **Functions** sections instead of hotspot sections
3. WHEN a compare section has no rows THEN it SHALL render title + header with zero data rows
4. WHEN `rankChanged` rows are rendered THEN columns SHALL include `baselineRank`, `currentRank`, `rankDelta` plus entity fields
5. WHEN `removed` rows are rendered THEN `rank` column SHALL be present but empty
6. WHEN `meta.warnings` is non-empty THEN metadata block SHALL include a `warnings` row (semicolon-joined) or one row per warning per design

**Independent Test**: `compare-csv.test.ts` with compare fixtures for file and function modes.

**Requirements**: HOTSPOT-124

---

### P1: Reporter factory dispatch ⭐ MVP

**User Story**: As the CLI entry point, I want `createReporter()` to dispatch CSV rendering so that format selection stays out of `bin/`.

**Why P1**: Existing M5/M10 factory pattern; CSV is a fourth renderer.

**Acceptance Criteria**:

1. WHEN `createReporter().render(result, { format: "csv", top })` is called THEN it SHALL return a CSV string from **unsliced** `result` (`top` ignored)
2. WHEN `createReporter().renderCompare(result, { format: "csv", top })` is called THEN it SHALL return CSV from **unsliced** `CompareResult` (`top` ignored)
3. WHEN `format` is `table`, `json`, or `markdown` THEN `render()` and `renderCompare()` behavior SHALL be unchanged from M13
4. WHEN `format` is `table` or `markdown` THEN `top` SHALL still apply via slice helpers (unchanged until M16)

**Independent Test**: `index.test.ts` — csv dispatch; assert row count unchanged when `top: 1` with `format: "csv"`.

**Requirements**: HOTSPOT-125

---

### P1: `--output` with CSV ⭐ MVP

**User Story**: As a CI maintainer, I want `--output report.csv --format csv` to write the CSV file using M10 transport rules.

**Why P1**: File export is the primary CSV use case.

**Acceptance Criteria**:

1. WHEN `--output <path> --format csv` is provided THEN the CLI SHALL write UTF-8 CSV to that path
2. WHEN `--output` is set THEN report SHALL NOT be written to stdout (stderr diagnostics unchanged)
3. WHEN `--output` path validation fails THEN behavior SHALL match M10 (`validateOutputPath`)
4. WHEN an existing file is at `<path>` THEN it SHALL be overwritten without error
5. WHEN scan emits warnings/progress THEN they SHALL appear on stderr regardless of `--output`

**Independent Test**: CLI unit test with mocked `writeFile`; integration test writes temp `.csv` file.

**Requirements**: HOTSPOT-126

---

### P1: Tests ⭐ MVP

**User Story**: As a CI maintainer, I want unit and integration tests for CSV export so that regressions are caught before release.

**Why P1**: New `src/report/csv*.ts` modules require ≥80% coverage per TESTING.md.

**Acceptance Criteria**:

1. WHEN `csv-utils.test.ts` runs THEN it SHALL cover RFC 4180 escaping edge cases
2. WHEN `csv.test.ts` runs THEN it SHALL cover scan sections, granularity branches, and empty sections
3. WHEN `compare-csv.test.ts` runs THEN it SHALL cover file and function compare modes
4. WHEN `index.test.ts` runs THEN it SHALL cover csv dispatch and `--top` ignored behavior
5. WHEN integration test runs `--format csv --output` on `small-ts` THEN CLI SHALL exit `0` and file SHALL contain metadata and section headers
6. WHEN integration test runs `--baseline ... --format csv` THEN CLI SHALL exit `0` and file SHALL contain compare section headers
7. WHEN `--top 1 --format csv` runs on a fixture with multiple hotspots THEN output SHALL contain **all** hotspot rows (not sliced)

**Independent Test**: Per-file Vitest gates in tasks.md.

**Requirements**: HOTSPOT-127

---

### P1: Documentation sync ⭐ MVP

**User Story**: As a maintainer, I want docs updated so that `--format csv` is discoverable without reading source.

**Why P1**: Workspace rule — significant CLI changes update `.specs/codebase/` and README.

**Acceptance Criteria**:

1. WHEN M17 Execute completes THEN [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md) SHALL document `--format csv` and CSV reporters
2. WHEN docs are synced THEN [STRUCTURE.md](../../codebase/STRUCTURE.md) SHALL list `src/report/csv.ts`, `csv-utils.ts`, `compare-csv.ts`
3. WHEN [README.md](../../../README.md) is read THEN CLI flags table SHALL include `csv` format option
4. WHEN [vitals-cli-validation](../../../.cursor/skills/vitals-cli-validation/SKILL.md) is read THEN validation examples SHALL include CSV export
5. WHEN planning completes THEN [ROADMAP.md](../../project/ROADMAP.md) M17 SHALL link to this spec with `**Specs:** Done`

**Independent Test**: Doc review; grep for `csv` in listed files.

**Requirements**: HOTSPOT-128

---

## Edge Cases

- WHEN a path contains comma, double quote, or newline THEN CSV cell SHALL be valid RFC 4180
- WHEN rankings are empty THEN valid CSV file SHALL still be written with metadata and empty section headers
- WHEN `--output` is set with CSV THEN file SHALL contain only rendered CSV (no stderr text)
- WHEN `granularity=function` THEN hotspots section SHALL be omitted; functions section SHALL be present
- WHEN `--top N` is combined with `--format csv` THEN CSV SHALL contain full rankings (scan and compare)
- WHEN compare `removed` entities are rendered THEN rank column SHALL be empty, not omitted
- WHEN unicode appears in paths THEN UTF-8 encoding SHALL preserve characters (no BOM)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-121 | P1: RFC 4180 field escaping | Tasks T1 | Planned |
| HOTSPOT-122 | P1: Scan CSV renderer | Tasks T1 | Planned |
| HOTSPOT-123 | P1: `--format csv` CLI | Tasks T3 | Planned |
| HOTSPOT-124 | P1: Compare CSV renderer | Tasks T2 | Planned |
| HOTSPOT-125 | P1: Reporter factory dispatch | Tasks T3 | Planned |
| HOTSPOT-126 | P1: `--output` with CSV | Tasks T3 | Planned |
| HOTSPOT-127 | P1: Tests | Tasks T1, T2, T3, T4 | Planned |
| HOTSPOT-128 | P1: Documentation sync | Tasks T5 | Planned |

**Coverage:** 8 total, 8 mapped to tasks, 0 unmapped

---

## Success Criteria

- [x] All P1 acceptance criteria verifiable via Vitest + fixtures (no human judgment)
- [x] `pnpm build && pnpm test` passes after Execute
- [x] `src/report/csv*.ts` ≥80% line coverage per [TESTING.md](../../codebase/TESTING.md)
- [x] `orchestrator-implementer` can execute T1–T5 without ambiguous scope
- [x] No changes to scoring, normalization, coupling scorer, or JSON/CompareResult schemas
