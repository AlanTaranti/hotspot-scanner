# Milestone 62 — Feedback and Copy UX Specification

**Feature slug:** `feedback-copy-ux`  
**Milestone:** M62  
**Priority:** High  
**Status:** Done  
**Depth:** Large  
**IDs:** HOTSPOT-1030–1059 (1046–1059 reserved)  
**Artifacts:** [context.md](./context.md) · [design.md](./design.md) · [tasks.md](./tasks.md)

---

## Problem Statement

Operators get incomplete or jargon-heavy feedback after scans: CSV writes are silent, timings live only in JSON `meta.timings`, progress lines omit the active `--since` window, empty compare reports look like opaque zeros, baseline failures exit like pipeline errors, and help/README still cite internal milestone IDs (`M34`, `M41`, …). Clarity should come from copy and small presentation hooks — not new flags or schema changes.

## Goals

- [x] Confirm CSV bundle paths on stderr after a successful write
- [x] Show timings in table/markdown executive summary **and** a brief stderr line (from existing `meta.timings`)
- [x] Remove milestone jargon from CLI help and user-facing README
- [x] Prefix `since=…` on the **first** progress line only (compose with M59; do not implement M61)
- [x] Clear empty-compare copy including “No rank changes” (or equivalent)
- [x] Map `BaselineError` → exit **2**; baseline path hints mention `hotspot-scanner baseline save`

## Out of Scope

| Feature                                                | Reason                                     |
| ------------------------------------------------------ | ------------------------------------------ |
| JSON schema / `version` bump                           | Presentation-only; timings already in meta |
| Ranking / scoring / NCLOC changes                      | Unrelated                                  |
| Implement M61 progress bar / finalize / flush deferral | Sister only — [context.md](./context.md)   |
| New CLI flags or config keys                           | YAGNI                                      |
| Changing `--warnings` aggregation rules                | M58 Done; compose only                     |
| Doctor / init / completion progress UX                 | Out of this milestone                      |
| Rewriting `.specs/` milestone IDs                      | Specs remain historical SoT                |

---

## User Stories

### P1: CSV bundle write confirmation ⭐ MVP

**User Story:** As a CLI user exporting `--format csv`, I want stderr to list the files written so I know the bundle paths without guessing stem suffixes.

**Why P1:** Locked adoption feedback for multi-file CSV (M18).

**Acceptance Criteria:**

1. WHEN `writeCsvBundle` completes successfully THEN the CLI SHALL write a stderr confirmation that lists each written path (stem + bundle key suffixes).
2. WHEN `--quiet` is set THEN the CSV confirmation SHALL be suppressed.
3. WHEN confirmation is emitted THEN it SHALL NOT be written to stdout.

**Independent Test:** Unit/CLI test of `writeCsvBundle` / `writeRenderedOutput` capturing stderr path list.

**Requirements:** HOTSPOT-1030

---

### P1: Timings in summary + stderr ⭐ MVP

**User Story:** As an operator, I want to see how long git vs NCLOC vs total took in the human report and a short stderr line after the scan.

**Why P1:** `meta.timings` exists (M51) but is invisible in table/markdown and has no brief stderr echo.

**Acceptance Criteria:**

1. WHEN a successful scan has `meta.timings` and format is `table` or `markdown` THEN the executive summary SHALL include a Timing line with total and stage breakdown (user-facing wording; no milestone IDs).
2. WHEN compare table/markdown runs and **current** scan meta includes timings THEN the compare executive summary SHALL include an equivalent Timing line sourced from current timings.
3. WHEN a successful scan/compare produces timings and `--quiet` is not set THEN stderr SHALL include a **brief** one-line timing message (shorter than the executive-summary line per [context.md](./context.md)).
4. WHEN `--quiet` is set THEN the stderr timing line SHALL be omitted.
5. WHEN `meta.timings` is absent THEN table/markdown SHALL omit the Timing line (no fabricated zeros).
6. WHEN format is `json` or `csv` THEN stdout/file payloads SHALL remain unchanged regarding timings (already in meta / meta.json).

**Independent Test:** Unit tests on `buildScanExecutiveSummary` / `buildCompareExecutiveSummary`; CLI test asserts stderr timing under non-quiet mock scan.

**Requirements:** HOTSPOT-1031, HOTSPOT-1032

---

### P1: Help text without milestone jargon ⭐ MVP

**User Story:** As a new CLI user, I want `--help` to describe behavior in plain language without internal milestone codes.

**Why P1:** Locked copy UX for `bin/hotspot-scanner.ts`.

**Acceptance Criteria:**

1. WHEN `scan --help` / related option help is shown THEN strings that currently cite `M34` (or similar milestone IDs) SHALL use user-facing wording instead (e.g. sequential vs concurrent git + NCLOC, peak memory).
2. WHEN help text is updated THEN behavior described SHALL remain accurate (sequential disables overlap; rankings unchanged).

**Independent Test:** Unit assert help/option description strings do not match `/\bM\d+\b/`.

**Requirements:** HOTSPOT-1033

---

### P1: First-progress `since=` prefix ⭐ MVP

**User Story:** As an operator watching progress, I want the first progress line to show which `--since` window is active without repeating it on every update.

**Why P1:** Locked diagnostics UX; composes with M59 overwrite.

**Acceptance Criteria:**

1. WHEN progress is enabled and handlers receive a resolved `since` THEN the **first** emitted progress line SHALL be prefixed with `since=<value>` (plus a clear separator before the existing body).
2. WHEN subsequent progress lines are emitted (TTY overwrite or non-TTY `\n`) THEN they SHALL NOT repeat the `since=` prefix.
3. WHEN `--quiet` or `--no-progress` is set THEN no progress (and thus no prefix) SHALL be emitted.
4. WHEN wiring scan/compare/baseline-save CLI paths THEN the **effective** since (CLI > config > default) SHALL be passed into diagnostic handlers per [context.md](./context.md).
5. WHEN M61 is later implemented THEN M62 behavior SHALL remain first-emission-only (documented compose; M61 not implemented here).

**Independent Test:** Unit tests on `createCliDiagnosticHandlers` with `stderrIsTTY` true/false; assert first vs second write.

**Requirements:** HOTSPOT-1034, HOTSPOT-1035

---

### P1: Empty compare deltas — clear copy ⭐ MVP

**User Story:** As a user comparing against a baseline with no hotspot movement, I want a clear “No rank changes” (or equivalent) message instead of opaque zero counts.

**Why P1:** Locked compare interpretation copy.

**Acceptance Criteria:**

1. WHEN compare hotspot deltas total `new + removed + rankChanged === 0` THEN table and markdown executive summaries SHALL use a clear empty-deltas message that conveys **No rank changes** (stable substring acceptable for tests).
2. WHEN deltas are non-zero THEN existing `showing N of M (new …, removed …, rank changed …)` wording SHALL remain.
3. WHEN format is json/csv THEN compare payloads SHALL be unchanged by this copy change.

**Independent Test:** Unit tests on `buildCompareExecutiveSummary` and smoke asserts in compare-table / compare-markdown tests.

**Requirements:** HOTSPOT-1036, HOTSPOT-1037

---

### P1: `BaselineError` exit 2 + baseline save hints ⭐ MVP

**User Story:** As a CLI user with a missing or invalid baseline, I want exit code 2 and a hint that points me to `hotspot-scanner baseline save`.

**Why P1:** Aligns usage-class failures; improves baseline adoption (M40).

**Acceptance Criteria:**

1. WHEN `main` catches a `BaselineError` THEN the process SHALL exit with code **2** (not 1).
2. WHEN `--baseline` path is missing or is a directory THEN the usage error Hint SHALL mention `hotspot-scanner baseline save`.
3. WHEN baseline content fails validation (`BaselineError`) THEN the presented Hint/message SHALL mention `hotspot-scanner baseline save` (and may keep re-scan / JSON contract language).
4. WHEN other fatal non-usage errors occur THEN exit code **1** SHALL remain (cancel codes unchanged).

**Independent Test:** CLI unit tests for exit mapping and hint strings; update any outdated exit-1 expectations for `BaselineError`.

**Requirements:** HOTSPOT-1038, HOTSPOT-1039, HOTSPOT-1040

---

### P1: README without milestone IDs ⭐ MVP

**User Story:** As a README reader, I want product docs without ROADMAP milestone numbers.

**Why P1:** Locked user-facing docs cleanup.

**Acceptance Criteria:**

1. WHEN reading user-facing README sections that currently cite `M30`, `M34`, `M40`, `M41`, `M51`, `M53`, `M57`, etc. THEN those milestone IDs SHALL be removed or rephrased to behavior-only language.
2. WHEN `.specs/` docs mention milestones THEN they MAY keep IDs (unchanged by this requirement).

**Independent Test:** Doc review / optional grep gate that README user sections lack `\bM\d+\b` (allow links into `.specs/features/` if needed without embedding bare milestone codes in prose).

**Requirements:** HOTSPOT-1041

---

## Edge Cases

- WHEN CSV bundle write fails mid-way THEN no success confirmation SHALL be claimed for the full bundle (existing error propagation; no partial “success” banner).
- WHEN overlap makes `gitMs + complexityMs > totalMs` THEN summary Timing wording MAY note concurrent stages without milestone jargon.
- WHEN progress throttle skips early ticks THEN “first emitted” means first line that actually writes — prefix still applies once.
- WHEN compare has new/removed but zero rankChanged THEN empty-deltas special message SHALL **not** replace the normal non-zero summary line (only when total deltas === 0).
- WHEN `--output` redirects the report THEN stderr confirmations/timings/progress still go to stderr.

---

## Requirement Traceability

| Requirement ID    | Story                                         | Phase | Status  |
| ----------------- | --------------------------------------------- | ----- | ------- |
| HOTSPOT-1030      | P1: CSV confirmation                          | Tasks | Pending |
| HOTSPOT-1031      | P1: Timings summary                           | Tasks | Pending |
| HOTSPOT-1032      | P1: Timings stderr                            | Tasks | Pending |
| HOTSPOT-1033      | P1: Help de-jargon                            | Tasks | Pending |
| HOTSPOT-1034      | P1: since= first progress                     | Tasks | Pending |
| HOTSPOT-1035      | P1: since= M59/M61 compose                    | Tasks | Pending |
| HOTSPOT-1036      | P1: Empty compare summary                     | Tasks | Pending |
| HOTSPOT-1037      | P1: Empty compare table/md smoke              | Tasks | Pending |
| HOTSPOT-1038      | P1: BaselineError exit 2                      | Tasks | Pending |
| HOTSPOT-1039      | P1: Missing path baseline save hint           | Tasks | Pending |
| HOTSPOT-1040      | P1: Invalid baseline save hint                | Tasks | Pending |
| HOTSPOT-1041      | P1: README strip milestone IDs                | Tasks | Pending |
| HOTSPOT-1042–1045 | Stretch / docs living sync if needed in tasks | Tasks | Pending |
| HOTSPOT-1046–1059 | Reserved                                      | —     | Unused  |

**Coverage:** 12 mapped core IDs (1030–1041); 1042–1045 available for living-docs/ARCHITECTURE notes in tasks; 1046–1059 reserved.

---

## Success Criteria

- [x] CSV export prints written paths on stderr (unless quiet)
- [x] Table/markdown show Timing from `meta.timings`; brief stderr timing when not quiet
- [x] First progress line shows `since=…`; later lines do not repeat it
- [x] Empty compare deltas read clearly (“No rank changes” or equivalent)
- [x] `BaselineError` → exit 2; baseline hints mention `baseline save`
- [x] Help + README free of user-facing milestone jargon
- [x] `pnpm build && pnpm test` green after Execute
