# Milestone 10 — Export Formats Specification

**Feature slug:** `export-formats`  
**Milestone:** ROADMAP M10  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [TESTING.md](../../codebase/TESTING.md)  
**Context:** [`.specs/features/export-formats/context.md`](./context.md)

## Problem Statement

M1–M9 produce scan reports only on stdout (`table` or `json`). CI pipelines and PR workflows need a dedicated file output and a markdown format readable on GitHub/GitLab. Shell redirect (`--format json > report.json`) works for JSON but does not standardize I/O errors, does not support markdown, and relies on users remembering the stderr/stdout split for warnings.

M10 adds `--output <path>` for explicit file export (all formats) and `--format markdown` for PR-friendly reports. Behavior without `--output` remains identical to M9.

## Goals

- [x] `--output <path>` writes report to file for `table`, `json`, and `markdown`
- [x] `--format markdown` produces PR-friendly GFM output
- [x] Without `--output`, stdout behavior unchanged from M9
- [x] `pnpm build && pnpm test` passing after Execute

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| `scan compare` / baseline delta | Milestone 13 — Scan Compare |
| CI fail thresholds | Milestone 12 — CI Gate |
| `--granularity function` | Milestone 11 — Function Granularity |
| HTML, PDF, SARIF | YAGNI |
| Auto-detect format from file extension | `--format` is source of truth |
| `mkdir -p` for missing parent directories | YAGNI — fail fast with clear error |
| `--no-clobber` | YAGNI — overwrite is default |
| Alter JSON schema, scoring, or coupling output | M9 boundary |
| Per-function markdown sections | Milestone 11 |

---

## User Stories

### P1: `--output` file write ⭐ MVP

**User Story**: As a developer running scans in CI, I want `--output <path>` to write the report to a file so that I can archive or upload results without shell redirect.

**Why P1**: ROADMAP M10 primary deliverable; replaces ad-hoc `> file` redirect with explicit API and error handling.

**Acceptance Criteria**:

1. WHEN `--output <path>` is provided THEN the CLI SHALL write the rendered report to that path with UTF-8 encoding
2. WHEN `--output` is set THEN the report SHALL NOT be written to stdout (stderr diagnostics unchanged)
3. WHEN `--output` is omitted THEN behavior SHALL match M9 (report on stdout only)
4. WHEN `--output` is used with `--format table` THEN the file SHALL contain the same text as M9 table stdout output

**Independent Test**: CLI unit test with temp file — assert file contents match rendered output and stdout is empty for report.

**Requirements**: HOTSPOT-83

---

### P1: Output path validation ⭐ MVP

**User Story**: As a developer, I want clear errors when the output path is invalid so that CI failures are actionable.

**Why P1**: File I/O is new failure surface; must not silently succeed or crash.

**Acceptance Criteria**:

1. WHEN the parent directory of `<path>` does not exist THEN the CLI SHALL print an error to stderr and exit with code `!= 0`
2. WHEN `<path>` is an existing directory THEN the CLI SHALL print an error to stderr and exit with code `!= 0`
3. WHEN the write fails (permissions, disk full, etc.) THEN the CLI SHALL print an error to stderr and exit with code `!= 0`
4. WHEN `<path>` is empty string THEN the CLI SHALL reject with exit `!= 0`

**Independent Test**: Vitest with mocked `fs` or temp dirs — missing parent, directory target, permission error.

**Requirements**: HOTSPOT-84

---

### P1: `--format markdown` CLI ⭐ MVP

**User Story**: As a developer sharing scan results in a PR, I want `--format markdown` so that results render as tables on GitHub/GitLab.

**Why P1**: ROADMAP M10 second deliverable; extends CLI format enum.

**Acceptance Criteria**:

1. WHEN `--format markdown` is provided THEN `parseFormat()` and commander SHALL accept `markdown`
2. WHEN `--format` is not `table`, `json`, or `markdown` THEN the CLI SHALL print an error and exit with code `!= 0`
3. WHEN `--format markdown` is used without `--output` THEN markdown SHALL be written to stdout (same channel as table/json)
4. WHEN `--format` is omitted THEN default SHALL remain `table`

**Independent Test**: `bin/hotspot-scanner.test.ts` — `parseFormat("markdown")` succeeds; invalid format throws.

**Requirements**: HOTSPOT-85

---

### P1: Markdown renderer ⭐ MVP

**User Story**: As a developer reviewing a PR, I want a markdown report with hotspot and coupling tables so that maintenance risk is visible without running the CLI.

**Why P1**: Core renderer for the new format; consumed by CLI and `createReporter()`.

**Acceptance Criteria**:

1. WHEN `renderMarkdown(result)` runs THEN output SHALL include a title, scan metadata (`since`, `scannedAt`), **Top Hotspots** section, and **Top Coupling Pairs** section per [design.md](./design.md) § Markdown Layout
2. WHEN hotspots exist THEN the hotspots table SHALL include columns: rank, file, score, cpx, cpxN, churn, churnN, funcs, authors, lines (`linesChanged`)
3. WHEN coupling pairs exist THEN the coupling table SHALL include columns: rank, fileA, fileB, strength, co-changes
4. WHEN a section has no rows THEN it SHALL render an explicit empty indicator (e.g., `_No results._`) without throwing
5. WHEN numeric values are displayed THEN scores and normalized fields SHALL use 4 decimal places; integer fields SHALL have no decimal places (match M9)
6. WHEN file paths contain pipe `|` characters THEN cells SHALL escape them for valid GFM tables

**Independent Test**: `markdown.test.ts` with `sample-result.json` fixture — assert GFM structure, columns, formatting.

**Requirements**: HOTSPOT-86

---

### P1: Reporter factory dispatch ⭐ MVP

**User Story**: As the CLI entry point, I want `createReporter()` to dispatch markdown rendering so that format selection stays out of `bin/`.

**Why P1**: Existing M5 factory pattern; markdown is a third renderer alongside table and JSON.

**Acceptance Criteria**:

1. WHEN `createReporter().render(result, { format: "markdown", top })` is called THEN it SHALL return a markdown string
2. WHEN `format` is `table` or `json` THEN behavior SHALL be unchanged from M9
3. WHEN `top` is provided THEN `sliceScanResult` SHALL apply before markdown render (same as table/json)

**Independent Test**: `index.test.ts` — render all three formats from fixture.

**Requirements**: HOTSPOT-87

---

### P1: `--output` with all formats ⭐ MVP

**User Story**: As a CI maintainer, I want `--output` to work with every format so that I can archive table, JSON, or markdown artifacts consistently.

**Why P1**: ROADMAP states `--output` supports table/json/markdown.

**Acceptance Criteria**:

1. WHEN `--output report.md --format markdown` THEN the file SHALL contain valid GFM markdown
2. WHEN `--output report.json --format json` THEN the file SHALL contain valid JSON matching M9 schema (`version`, `hotspots`, `coupling`, `meta`)
3. WHEN `--output report.txt --format table` THEN the file SHALL contain M9 CLI table text
4. WHEN an existing file is at `<path>` THEN it SHALL be overwritten without error

**Independent Test**: Integration test on `small-ts` fixture — write temp files for markdown and JSON; parse/assert.

**Requirements**: HOTSPOT-88

---

### P1: Diagnostics channel invariant ⭐ MVP

**User Story**: As a developer, I want warnings and progress on stderr whether or not I use `--output` so that diagnostics never pollute the report file.

**Why P1**: M5 established stderr for diagnostics; M10 must preserve this invariant.

**Acceptance Criteria**:

1. WHEN scan emits warnings THEN they SHALL appear on stderr regardless of `--output`
2. WHEN scan emits progress THEN it SHALL appear on stderr regardless of `--output`
3. WHEN `--output` is set THEN the report file SHALL contain only rendered report content (no warning/progress lines)

**Independent Test**: CLI test with mocked `onWarning` — assert stderr called, file/stdout clean.

**Requirements**: HOTSPOT-89

---

### P1: Tests ⭐ MVP

**User Story**: As a CI maintainer, I want unit and integration tests for export formats so that regressions are caught before release.

**Why P1**: `src/report/**` requires ≥80% coverage per TESTING.md; new CLI surface needs tests.

**Acceptance Criteria**:

1. WHEN `markdown.test.ts` runs THEN it SHALL cover GFM output, empty sections, and pipe escaping
2. WHEN `index.test.ts` runs THEN it SHALL cover markdown dispatch
3. WHEN `bin/hotspot-scanner.test.ts` runs THEN it SHALL cover `parseFormat`, `--output`, and path validation
4. WHEN integration test runs on `small-ts` THEN `--output` with markdown and JSON SHALL exit `0` and produce parseable files

**Independent Test**: Per-file Vitest gates in tasks.md.

**Requirements**: HOTSPOT-90

---

### P1: Documentation sync ⭐ MVP

**User Story**: As a maintainer, I want docs updated so that `--output` and `--format markdown` are discoverable without reading source.

**Why P1**: Workspace rule — significant CLI changes update `.specs/codebase/` and README.

**Acceptance Criteria**:

1. WHEN M10 Execute completes THEN [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md) SHALL document `--output` and markdown format
2. WHEN docs are synced THEN [STRUCTURE.md](../../codebase/STRUCTURE.md) SHALL list `src/report/markdown.ts`
3. WHEN [README.md](../../../README.md) is read THEN CLI flags table SHALL include `--output` and `markdown` format option
4. WHEN [vitals-cli-validation](../../../.cursor/skills/vitals-cli-validation/SKILL.md) is read THEN validation examples SHALL include file export
5. WHEN planning completes THEN [ROADMAP.md](../../project/ROADMAP.md) M10 SHALL link to this spec with `**Specs:** Done`

**Independent Test**: Doc review; grep for `--output` and `markdown` in listed files.

**Requirements**: HOTSPOT-91

---

## Edge Cases

- WHEN `--output` is set and rankings are empty THEN a valid report file SHALL still be written with empty sections
- WHEN an existing file is at the output path THEN it SHALL be overwritten
- WHEN paths contain spaces or unicode THEN write and read SHALL preserve exact path strings
- WHEN `--top N` slices results THEN exported content SHALL reflect sliced arrays (no recomputation at write)
- WHEN JSON is written to file THEN the file SHALL NOT contain stderr warning or progress text
- WHEN `--format markdown` is combined with `--top 1` THEN markdown tables SHALL show at most one row per section

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-83 | P1: `--output` file write | Tasks T2 | Done |
| HOTSPOT-84 | P1: Output path validation | Tasks T2 | Done |
| HOTSPOT-85 | P1: `--format markdown` CLI | Tasks T2 | Done |
| HOTSPOT-86 | P1: Markdown renderer | Tasks T1 | Done |
| HOTSPOT-87 | P1: Reporter factory dispatch | Tasks T1 | Done |
| HOTSPOT-88 | P1: `--output` with all formats | Tasks T2, T3 | Done |
| HOTSPOT-89 | P1: Diagnostics channel invariant | Tasks T2 | Done |
| HOTSPOT-90 | P1: Tests | Tasks T1, T2, T3 | Done |
| HOTSPOT-91 | P1: Documentation sync | Tasks T4 | Done |

**Coverage:** 9 total, 9 mapped to tasks, 0 unmapped

---

## Success Criteria

- [x] All P1 acceptance criteria verifiable via Vitest + fixtures (no human judgment)
- [x] `pnpm build && pnpm test` passes after Execute
- [x] `src/report/**` ≥80% line coverage per [TESTING.md](../../codebase/TESTING.md)
- [x] `orchestrator-implementer` can execute T1–T4 without ambiguous scope
- [x] No changes to scoring, normalization, coupling scorer, or JSON schema beyond format dispatch
