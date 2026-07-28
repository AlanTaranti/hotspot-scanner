# Milestone 51 — Scan Observability Specification

**Slug:** `scan-observability`  
**Priority:** High  
**Depth:** Large  
**IDs:** HOTSPOT-770–799  
**Context:** [context.md](./context.md)  
**Status:** Planned

## Problem Statement

Long scans can leave orphan git children or complexity workers when the operator hits Ctrl-C — M34 wired sibling abort on stage failure but explicitly left SIGINT/SIGTERM out of scope. JSON consumers cannot see per-stage cost without external timing. Human table/markdown reports list full warning lines (compare) or omit a rollup (scan summary), so operators cannot glance at warning volume by code. `doctor` is text-only, awkward for scripts. M38 omitted general `--verbose`; operators still need a narrow git argv trace for pathspec/spawn debugging.

## Goals

- [ ] SIGINT/SIGTERM abort the shared scan pipeline cleanly (no zombies; no partial rankings; locked exit codes)
- [ ] Additive `meta.timings` per stage under JSON `version: "1.0"`
- [ ] Warning count + by-code summary in scan and compare table/markdown executive summaries
- [ ] `doctor --format json` structured findings with unchanged exit policy
- [ ] `--verbose` emits git spawn argv on stderr only (quiet wins)

## Out of Scope

| Feature                               | Reason                          |
| ------------------------------------- | ------------------------------- |
| Doctor remount / shared scan prelude  | M52                             |
| Benchmark harness / CI perf budgets   | M49                             |
| Ranking, scores, coupling formulas    | Unrelated                       |
| General debug / AST verbose dumps     | Explicitly rejected — argv only |
| Fail-on-warning / `--strict` warnings | Not M51                         |
| New progress phases                   | Unneeded                        |

---

## User Stories

### P1: Clean cancel on SIGINT/SIGTERM ⭐ MVP

**User Story**: As an operator, I want Ctrl-C (or SIGTERM) to stop a scan without leaving git processes or worker threads behind and without printing a partial report, so that I can safely interrupt large repos.

**Why P1**: ROADMAP M51 primary bullet; closes M34 gap; CONCERNS overlap-abort risk.

**Acceptance Criteria**:

1. WHEN `scan` or `compare` is running and the process receives `SIGINT` THEN the system SHALL abort the shared scan `AbortSignal` and exit with code `130`
2. WHEN the process receives `SIGTERM` during scan/compare THEN the system SHALL abort and exit with code `143`
3. WHEN abort is signaled THEN git numstat and function-churn patch children SHALL be killed (best-effort) and complexity workers SHALL terminate / stop scheduling
4. WHEN cancel completes THEN the CLI SHALL NOT write a successful scan/compare report to stdout or `--output`
5. WHEN cancel completes THEN stderr SHALL include a single concise cancel line (no stack dump for clean cancel)
6. WHEN a stage fails for a non-signal reason THEN existing sibling-abort + original-error rethrow behavior SHALL remain unchanged

**Independent Test**: Unit — function-churn/numstat abort kill; scan unit with injected signal; CLI test with mocked abort path / exit code mapping. Integration smoke optional with short fixture + abort.

---

### P1: Additive `meta.timings` ⭐ MVP

**User Story**: As a JSON consumer, I want per-stage millisecond timings in `meta.timings` without a schema version bump so that I can profile scans and keep existing baseline files valid.

**Why P1**: ROADMAP additive timings + schema.

**Acceptance Criteria**:

1. WHEN a scan completes successfully THEN `ScanResult.meta.timings` SHALL be present with `gitMs`, `complexityMs`, and `totalMs` (non-negative numbers)
2. WHEN `granularity === "function"` THEN `meta.timings.functionChurnMs` SHALL be present; WHEN file mode THEN that key SHALL be omitted
3. WHEN JSON `version` is emitted THEN it SHALL remain `"1.0"` (additive under existing `ScanMeta.additionalProperties`)
4. WHEN `schemas/scan-result.json` is updated THEN `timings` SHALL be declared under `ScanMeta.properties` and contract tests SHALL pass
5. WHEN a baseline without `timings` is loaded for compare THEN `loadBaseline` SHALL still accept it

**Independent Test**: Unit scan asserts timings keys; contract schema tests; load-baseline fixture without timings still valid.

---

### P1: Warning summary in human reports ⭐ MVP

**User Story**: As an operator reading table or markdown, I want a one-line warning count and by-code breakdown in the executive summary so that I can gauge scan health at a glance.

**Why P1**: ROADMAP warning summary for scan + compare.

**Acceptance Criteria**:

1. WHEN scan `--format table` or `markdown` is rendered THEN the executive summary SHALL include a `Warnings:` line per [context.md](./context.md) (count + sorted code tallies; `(uncoded)` for missing codes)
2. WHEN compare table/markdown is rendered THEN the same line format SHALL summarize `CompareResult.meta.warnings` only
3. WHEN there are zero warnings THEN the line SHALL be `Warnings: 0`
4. WHEN `--format json` or `csv` THEN warning summary prose SHALL NOT be required (structured `meta.warnings` unchanged)

**Independent Test**: `summary.test.ts` + table/markdown/compare reporter unit asserts.

---

### P1: Doctor JSON format ⭐ MVP

**User Story**: As a script author, I want `doctor --format json` so that I can parse findings and exit intent without scraping text lines.

**Why P1**: ROADMAP doctor JSON.

**Acceptance Criteria**:

1. WHEN `doctor --format json` runs THEN stdout SHALL be a JSON object with `version: "1.0"`, `findings` (array of `{ id, status, message }`), and `exitCode`
2. WHEN `doctor` runs without `--format` or with `--format text` THEN output SHALL remain the existing text lines
3. WHEN an invalid doctor format is passed THEN the CLI SHALL exit `2` (`CliUsageError`)
4. WHEN findings include hard failures THEN process exit code SHALL still follow M39 doctor policy (unchanged)

**Independent Test**: CLI / doctor unit tests for json + text + invalid format.

---

### P1: Narrow `--verbose` (git argv) ⭐ MVP

**User Story**: As an operator debugging pathspecs or git invocation, I want `--verbose` to print each git spawn argv on stderr without flooding AST/debug noise.

**Why P1**: ROADMAP + STATE narrow reopen of M38.

**Acceptance Criteria**:

1. WHEN `scan --verbose` (or `compare --verbose`) runs THEN stderr SHALL include `verbose: git …` lines for each git spawn (numstat and, in function mode, patch)
2. WHEN `--verbose` is absent THEN those lines SHALL NOT appear
3. WHEN `--quiet` is set THEN verbose lines SHALL be suppressed even if `--verbose` is also set
4. WHEN `--verbose` is used THEN it SHALL NOT dump AST, scoring, or general debug traces
5. WHEN config files are loaded THEN there SHALL be no `verbose` config key

**Independent Test**: Spawn unit with `onSpawnArgv` / CLI test asserting stderr pattern; quiet precedence.

---

### P2: Living docs

**User Story**: As a maintainer, I want ARCHITECTURE/README/CONCERNS updated for cancel, timings, doctor JSON, and verbose so that operators know the contracts.

**Why P2**: Living docs rule; not blocking core behavior if code is correct.

**Acceptance Criteria**:

1. WHEN docs are updated THEN they SHALL document SIGINT/SIGTERM exit codes, `meta.timings` (incl. overlap note), doctor `--format`, and `--verbose` argv-only scope
2. WHEN CONCERNS overlap-abort is mentioned THEN it SHALL note user-cancel via signal in addition to sibling failure

**Independent Test**: Doc review checklist in docs task; no ranking docs changes.

---

## Edge Cases

- WHEN SIGINT arrives after scan success but before process exit THEN handlers SHOULD already be removed (no spurious 130)
- WHEN abort races natural stage completion THEN no partial `ScanResult` SHALL be returned to the reporter
- WHEN function mode never spawns patch (empty allowlist) THEN verbose SHALL not invent a patch argv line; timings omit or skip `functionChurnMs` work consistently (0 ms only if stage ran as no-op — prefer omit key when spawn skipped / file mode)
- WHEN all warnings lack codes THEN summary SHALL use `(uncoded): N` only inside parentheses with `Warnings: N total`
- WHEN doctor `--format json` and exit ≠ 0 THEN JSON SHALL still be written to stdout before non-zero exit (machine-readable findings)

---

## Requirement Traceability

| Requirement ID | Story                                                   | Phase | Status  |
| -------------- | ------------------------------------------------------- | ----- | ------- |
| HOTSPOT-770    | P1: Signal listeners + AbortSignal into runScan         | Tasks | Pending |
| HOTSPOT-771    | P1: Exit 130 / 143; no partial report                   | Tasks | Pending |
| HOTSPOT-772    | P1: Abort kills numstat git child                       | Tasks | Pending |
| HOTSPOT-773    | P1: Abort terminates complexity pool                    | Tasks | Pending |
| HOTSPOT-774    | P1: Function-churn spawn honors AbortSignal             | Tasks | Pending |
| HOTSPOT-775    | P1: Cancel stderr line; no stack dump                   | Tasks | Pending |
| HOTSPOT-776    | P1: Sibling-failure abort unchanged                     | Tasks | Pending |
| HOTSPOT-780    | P1: `meta.timings` shape + always on success            | Tasks | Pending |
| HOTSPOT-781    | P1: functionChurnMs only in function mode               | Tasks | Pending |
| HOTSPOT-782    | P1: Keep JSON version `1.0`; schema declare timings     | Tasks | Pending |
| HOTSPOT-783    | P1: Baselines without timings still load                | Tasks | Pending |
| HOTSPOT-786    | P1: Scan executive summary Warnings line                | Tasks | Pending |
| HOTSPOT-787    | P1: Compare executive summary Warnings line             | Tasks | Pending |
| HOTSPOT-790    | P1: doctor `--format json` payload                      | Tasks | Pending |
| HOTSPOT-791    | P1: doctor text default + invalid format                | Tasks | Pending |
| HOTSPOT-794    | P1: `--verbose` git argv stderr                         | Tasks | Pending |
| HOTSPOT-795    | P1: `--quiet` suppresses verbose                        | Tasks | Pending |
| HOTSPOT-798    | P2: Living docs (cancel, timings, doctor JSON, verbose) | Tasks | Pending |
| HOTSPOT-799    | P2: Full quality gate                                   | Tasks | Pending |

**Coverage:** 19 requirements mapped; IDs 777–779, 784–785, 788–789, 792–793, 796–797 reserved for task split / implementer sub-criteria.

---

## Success Criteria

- [ ] Ctrl-C during fixture scan exits 130 with no orphan git/workers and no report body
- [ ] JSON scan includes `meta.timings` under `version: "1.0"`; contract tests green
- [ ] Table/markdown scan + compare show `Warnings:` summary line
- [ ] `doctor --format json` parses; exit policy unchanged
- [ ] `--verbose` shows git argv only; `--quiet` silences it
- [ ] `pnpm build && pnpm test` green
