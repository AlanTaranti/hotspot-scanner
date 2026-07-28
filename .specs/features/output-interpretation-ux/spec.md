# Milestone 41 — Output Interpretation UX Specification

**Feature slug:** `output-interpretation-ux`  
**Milestone:** ROADMAP M41  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md) § Export formats / Reporter, [TESTING.md](../../codebase/TESTING.md)  
**Context:** [`.specs/features/output-interpretation-ux/context.md`](./context.md)  
**Sisters:** [reporter-cli](../reporter-cli/) (M5), [export-formats](../export-formats/) (M10), [format-scoped-top](../format-scoped-top/) (M16), [csv-bundle](../csv-bundle/) (M18), [enriched-coupling](../enriched-coupling/) (M14) / [coupling-enrichment](../coupling-enrichment/) (M27)  
**Deferred sister:** [explain-and-scan-feedback](../explain-and-scan-feedback/) (M42)

## Problem Statement

Operators can run a scan and get ranked tables, but column names (`Score`, `CpxN`, `StaticDep`, …) and dual-signal semantics are opaque without reading ARCHITECTURE. Markdown PR reports lack a “how to read” guide. There is no short executive summary of window / slice / coupling shape, no conservative triage cues, no way to emit only one section for a focused review, and no TTY-safe color cues on the default table. M41 closes that interpretation gap without changing rankings or machine-readable scores.

## Goals

- [x] Table footer glossary + markdown “How to read this” sharing one semantic SoT
- [x] Executive summary at top of table and markdown (scan + compare)
- [x] Conservative, documented triage hints (default ON for scan table/markdown; `--no-triage-hints`)
- [x] Repeatable `--only hotspots|coupling|functions` across formats; invalid → `CliUsageError`
- [x] TTY-aware table colors honoring `--no-color`, `NO_COLOR`, non-TTY, and `--output`
- [x] `pnpm build && pnpm test` green after Execute; scores/rankings/JSON contract unchanged for unfiltered scans

## Out of Scope

| Feature                                        | Reason                |
| ---------------------------------------------- | --------------------- |
| `--explain <file>`                             | M42                   |
| SARIF / fail-on thresholds                     | Deferred DX backlog   |
| Harmonic / normalization formula changes       | Closed (M8 / scoring) |
| Colorizing markdown, JSON, or CSV              | User lock             |
| ML or non-deterministic hints                  | User lock             |
| Config-file keys for `--only` / triage / color | CLI-only (context D7) |
| `FORCE_COLOR`                                  | YAGNI (context D6)    |
| Triage hints on compare reports                | Context D4            |
| New runtime color dependency                   | Context D6            |

---

## User Stories

### P1: Table legend / glossary ⭐ MVP

**User Story**: As an operator reading the default table, I want a short glossary after the tables so that I understand Score, Cpx/CpxN, Churn, StaticDep, and related columns without leaving the terminal.

**Why P1**: ROADMAP item 13/14 — primary interpretation gap.

**Acceptance Criteria**:

1. WHEN `--format table` (default) completes a scan or compare THEN the report string SHALL end with a glossary footer **after** all ranking tables (and after triage hints when present)
2. WHEN the glossary is rendered THEN it SHALL define at least: Score, Cpx, CpxN, Churn, ChurnN, Strength, Co-changes, StaticDep, Direction, Kinds (and Funcs/Authors/Lines where those columns appear)
3. WHEN the report is written with `--output` THEN the glossary SHALL be included in the file body (not stderr)
4. WHEN diagnostics are emitted THEN the glossary SHALL NOT be written to stderr

**Independent Test**: Unit — `table.test.ts` / `compare-table.test.ts` assert footer markers and key terms; CLI fixture run shows glossary on stdout only.

**Requirements**: HOTSPOT-510, HOTSPOT-511, HOTSPOT-512

---

### P1: Markdown “How to read this” ⭐ MVP

**User Story**: As someone pasting a markdown report into a PR, I want a “How to read this” section so that reviewers understand the metrics.

**Why P1**: ROADMAP item 14.

**Acceptance Criteria**:

1. WHEN `--format markdown` THEN the report SHALL include a `## How to read this` section
2. WHEN that section is rendered THEN its metric definitions SHALL match the table glossary semantics (shared content module)
3. WHEN section order is fixed THEN “How to read this” SHALL appear after the executive summary / title metadata and **before** ranking tables
4. WHEN compare markdown is rendered THEN it SHALL include the same section (wording may mention deltas)

**Independent Test**: Unit — `markdown.test.ts` / `compare-markdown.test.ts` assert heading and shared terms.

**Requirements**: HOTSPOT-513, HOTSPOT-514

---

### P1: Executive summary ⭐ MVP

**User Story**: As an operator, I want a short summary at the top of human reports so that I know the scan window, how much of the ranking is shown, and coupling shape at a glance.

**Why P1**: ROADMAP item 15.

**Acceptance Criteria**:

1. WHEN table or markdown scan output is rendered THEN an executive summary SHALL appear at the top (before ranking tables)
2. WHEN `--top` slices the ranking THEN the summary SHALL report shown vs total for the active ranking array and for coupling (totals from the **unsliced** result)
3. WHEN coupling exists THEN the summary SHALL include total coupling count and the count of pairs with `hasStaticDependency === false` (full array)
4. WHEN compare table/markdown is rendered THEN a delta-oriented summary SHALL appear (shown vs total on sliced deltas + classification totals per context D3)
5. WHEN format is json or csv THEN no executive-summary prose block SHALL be added

**Independent Test**: Unit — summary builder with fixture totals; table/markdown include “showing N of M” when top &lt; total.

**Requirements**: HOTSPOT-515, HOTSPOT-516, HOTSPOT-517, HOTSPOT-518, HOTSPOT-519

---

### P1: Conservative triage hints ⭐ MVP

**User Story**: As an operator triaging maintenance risk, I want optional, rule-based hints so that I know which rows deserve a closer look — without the tool inventing rankings.

**Why P1**: ROADMAP item 16.

**Acceptance Criteria**:

1. WHEN scan table/markdown renders and triage is enabled (default) THEN matching rows SHALL be listed under a triage section using exactly the three rules in context D4
2. WHEN `--no-triage-hints` is set THEN the triage section SHALL be omitted
3. WHEN no rows match THEN the triage section SHALL be omitted (no empty placeholder)
4. WHEN hints are shown THEN they SHALL NOT alter sort order, scores, or JSON/CSV field values
5. WHEN format is json or csv OR mode is compare THEN triage hints SHALL NOT appear (compare: flag accepted as no-op)
6. WHEN matches exceed the cap THEN at most 3 matches per rule SHALL be shown (highest score/strength first)

**Independent Test**: Unit — `triage.test.ts` with crafted rows for each rule, cap, and disable path; JSON fixture equality regression without `--only`.

**Requirements**: HOTSPOT-520, HOTSPOT-521, HOTSPOT-522, HOTSPOT-523, HOTSPOT-524

---

### P1: `--only` section filter ⭐ MVP

**User Story**: As an operator, I want `--only hotspots|coupling|functions` (repeatable) so that I can emit just the section I need for a review or script.

**Why P1**: ROADMAP item 17.

**Acceptance Criteria**:

1. WHEN `--only <section>` is passed THEN `<section>` SHALL be one of `hotspots`, `coupling`, `functions`
2. WHEN an invalid value is passed THEN the CLI SHALL throw `CliUsageError` before scan work (exit 2)
3. WHEN multiple `--only` values are passed THEN the report SHALL include the **union** of those sections and omit others
4. WHEN table/markdown omits a section THEN no header/placeholder for that section SHALL appear
5. WHEN json omits a section THEN the corresponding top-level key SHALL be absent; WHEN csv omits a section THEN that data file SHALL be absent from the bundle (`meta.json` retained)
6. WHEN an included section is empty THEN existing empty rendering SHALL apply (table `(none)` / markdown `_No results._` / JSON `[]` / CSV header-only)
7. WHEN `--only` is used with `--format json` THEN docs/help SHALL warn that filtered JSON is not a valid baseline / not schema-complete
8. WHEN compare is used THEN `--only` SHALL filter compare sections analogously

**Independent Test**: Unit — filter helper + reporter tests; CLI — invalid `--only foo` exits 2; `--only coupling --format json` lacks `hotspots` key.

**Requirements**: HOTSPOT-525, HOTSPOT-526, HOTSPOT-527, HOTSPOT-528, HOTSPOT-529, HOTSPOT-530, HOTSPOT-531

---

### P1: TTY-aware table colors ⭐ MVP

**User Story**: As a terminal user, I want subtle color on the table so that high scores and static-dep flags are easier to scan — without breaking pipes, files, or CI logs.

**Why P1**: ROADMAP item 19.

**Acceptance Criteria**:

1. WHEN `--format table`, stdout is a TTY, no `--output`, no `--no-color`, and `NO_COLOR` unset THEN score/strength/StaticDep cells SHALL use the ANSI bands in context D6
2. WHEN any disable condition in context D6 holds THEN output SHALL be identical to an uncolored table (no ANSI)
3. WHEN format is markdown, json, or csv THEN no ANSI color SHALL be applied
4. WHEN implementing color THEN the project SHALL NOT add a new runtime dependency for coloring
5. WHEN tests assert layout THEN strip-ANSI plain text SHALL match the uncolored table for the same fixture

**Independent Test**: Unit — color helper + table tests with injected `color: true|false`; CLI/unit — `--no-color` / `NO_COLOR` / `--output` disable path.

**Requirements**: HOTSPOT-532, HOTSPOT-533, HOTSPOT-534, HOTSPOT-535, HOTSPOT-536, HOTSPOT-537, HOTSPOT-538

---

### P2: Living docs sync

**User Story**: As a maintainer, I want ARCHITECTURE / README / `--help` to document the new flags and interpretation UX so that operators discover them.

**Why P2**: Keeps Design SoT honest; required before Done.

**Acceptance Criteria**:

1. WHEN M41 ships THEN ARCHITECTURE § Reporter/export SHALL mention legend, summary, triage, `--only`, and color policy
2. WHEN `scan --help` is shown THEN `--only`, `--no-triage-hints`, and `--no-color` SHALL appear with short descriptions
3. WHEN README documents output THEN it SHALL briefly point to glossary/summary/triage and warn that `--only` JSON is not a baseline

**Independent Test**: Doc review checklist in docs task; help text unit/CLI assertion.

**Requirements**: HOTSPOT-539

---

## Edge Cases

- WHEN `--only functions` with `--granularity file` THEN only the functions section is requested (typically empty) — no hard error
- WHEN `--only hotspots` with `--granularity function` THEN only hotspots section (typically empty) — no hard error
- WHEN `--top` ≥ full length THEN summary SHALL NOT claim a partial slice (show totals only, or “showing N of N”)
- WHEN `NO_COLOR=""` (empty) THEN treat as unset (color allowed if other conditions pass) — presence of non-empty value disables
- WHEN triage matches on sliced rows only THEN evaluate hints on the **sliced** display set (hints describe what the user sees), while summary totals remain full-corpus
- WHEN both `--only coupling` and triage enabled THEN hotspot rules produce no matches; coupling rules may still fire

---

## Requirement Traceability

| Requirement ID | Story                    | Phase | Status |
| -------------- | ------------------------ | ----- | ------ |
| HOTSPOT-510    | P1: Table legend         | Tasks | Done   |
| HOTSPOT-511    | P1: Table legend         | Tasks | Done   |
| HOTSPOT-512    | P1: Table legend         | Tasks | Done   |
| HOTSPOT-513    | P1: Markdown how-to-read | Tasks | Done   |
| HOTSPOT-514    | P1: Markdown how-to-read | Tasks | Done   |
| HOTSPOT-515    | P1: Executive summary    | Tasks | Done   |
| HOTSPOT-516    | P1: Executive summary    | Tasks | Done   |
| HOTSPOT-517    | P1: Executive summary    | Tasks | Done   |
| HOTSPOT-518    | P1: Executive summary    | Tasks | Done   |
| HOTSPOT-519    | P1: Executive summary    | Tasks | Done   |
| HOTSPOT-520    | P1: Triage hints         | Tasks | Done   |
| HOTSPOT-521    | P1: Triage hints         | Tasks | Done   |
| HOTSPOT-522    | P1: Triage hints         | Tasks | Done   |
| HOTSPOT-523    | P1: Triage hints         | Tasks | Done   |
| HOTSPOT-524    | P1: Triage hints         | Tasks | Done   |
| HOTSPOT-525    | P1: `--only`             | Tasks | Done   |
| HOTSPOT-526    | P1: `--only`             | Tasks | Done   |
| HOTSPOT-527    | P1: `--only`             | Tasks | Done   |
| HOTSPOT-528    | P1: `--only`             | Tasks | Done   |
| HOTSPOT-529    | P1: `--only`             | Tasks | Done   |
| HOTSPOT-530    | P1: `--only`             | Tasks | Done   |
| HOTSPOT-531    | P1: `--only`             | Tasks | Done   |
| HOTSPOT-532    | P1: Colors               | Tasks | Done   |
| HOTSPOT-533    | P1: Colors               | Tasks | Done   |
| HOTSPOT-534    | P1: Colors               | Tasks | Done   |
| HOTSPOT-535    | P1: Colors               | Tasks | Done   |
| HOTSPOT-536    | P1: Colors               | Tasks | Done   |
| HOTSPOT-537    | P1: Colors               | Tasks | Done   |
| HOTSPOT-538    | P1: Colors               | Tasks | Done   |
| HOTSPOT-539    | P2: Docs                 | Tasks | Done   |

**Coverage:** 30 total (HOTSPOT-510–539), mapped in tasks.md.

---

## Success Criteria

- [x] Default table/markdown on `small-ts` shows summary + glossary; triage appears only when rules match
- [x] `--only coupling --format json` omits other ranking keys; invalid `--only` exits 2
- [x] `--no-color`, `NO_COLOR=1`, and `--output` produce ANSI-free table
- [x] Unfiltered JSON still validates against `schemas/scan-result.json`
- [x] Rankings and scores bitwise-equal to pre-M41 for the same scan fixture (no scoring drift)
