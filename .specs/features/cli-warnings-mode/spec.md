# Milestone 58 — CLI Warnings Mode Specification

**Feature slug:** `cli-warnings-mode`  
**Milestone:** M58  
**Priority:** High  
**Status:** Specs Planned  
**Depth:** Large  
**IDs:** HOTSPOT-950–969 (960–969 reserved)  
**Artifacts:** [context.md](./context.md) · [design.md](./design.md) · [tasks.md](./tasks.md)

---

## Problem Statement

Rename-confidence and other multi-path diagnostics print **one stderr line per path or pair** before the Hotspots report. On repos with many ambiguous or unlinked renames, that spam obscures the report and slows triage. Operators need a default **summary** stderr mode while keeping full structured warnings in JSON / programmatic hooks, without overloading `--verbose` (M51 git-argv lock).

## Goals

- [ ] Add `--warnings summary|full` with default **`summary`** (intentional stderr UX break)
- [ ] Aggregate repeated same-code / rename sub-kind lines on **stderr only**
- [ ] Keep `meta.warnings` and programmatic `onWarning` payloads complete (no JSON contract change)
- [ ] Document quiet/verbose interaction; update help, completion, README, recipes, warning-codes

## Out of Scope

| Feature                                                             | Reason                                                   |
| ------------------------------------------------------------------- | -------------------------------------------------------- |
| Config key `warnings`                                               | CLI-only (M38 quiet parity) — [context.md](./context.md) |
| Overload `--verbose` for warning detail                             | M51 lock — git argv only                                 |
| Schema / JSON version bump                                          | Aggregation is presentation-only                         |
| Expand unlinked pairs in `meta.warnings` beyond today’s 5+remainder | YAGNI; stderr summary owns count                         |
| Executive summary redesign                                          | Already aggregates by code (M51)                         |
| Function-mode / function-churn product revival                      | M57 retired; file miner SoT                              |
| Fail-on-warning CI gates                                            | Deferred horizon                                         |

---

## User Stories

### P1: `--warnings` flag + default summary ⭐ MVP

**User Story:** As a CLI user, I want stderr warnings summarized by default so rename noise does not flood the terminal before the report.

**Why P1:** Core product ask; default change is the deliverable.

**Acceptance Criteria:**

1. WHEN `scan`, `compare`, or `baseline save` runs without `--warnings` THEN the CLI SHALL use mode **`summary`** for stderr warning/error presentation.
2. WHEN the user passes `--warnings summary` or `--warnings full` THEN the CLI SHALL apply that mode.
3. WHEN the user passes an invalid `--warnings` value THEN the CLI SHALL throw `CliUsageError` (exit **2**) listing allowed values `summary` and `full`.
4. WHEN `--warnings` is omitted from help THEN `scan --help` / `compare --help` SHALL document the flag, values, and default `summary`.
5. WHEN `.hotspot-scanner.json` contains a `warnings` key THEN the key SHALL be ignored as unknown (existing `UNKNOWN_CONFIG_KEY` warn-only) — **no** first-class config merge.

**Independent Test:** Unit-parse `--warnings`; CLI mock scan with many rename warnings; assert stderr line count under default vs `full`.

**Requirements:** HOTSPOT-950, HOTSPOT-951

---

### P1: Stderr aggregation vs full detail ⭐ MVP

**User Story:** As a CLI user, I want one summary line per warning category (with count), or full per-path detail when I opt in.

**Why P1:** Defines summary vs full behavior.

**Acceptance Criteria:**

1. WHEN mode is `summary` and multiple `RENAME_HISTORY_INCOMPLETE` ambiguous-path warnings exist THEN stderr SHALL emit **one** aggregated line for that sub-kind including a **count** and the shared next-step text (not one line per path).
2. WHEN mode is `summary` and unlinked-rename warnings exist THEN stderr SHALL emit **one** aggregated line with total pair **count** + next-step — **not** up to 5 samples + “… and N more”.
3. WHEN mode is `summary` and a since-truncation rename warning exists THEN stderr SHALL still emit that category (typically one line; may share aggregator path).
4. WHEN mode is `full` THEN stderr SHALL emit each structured warning as today (ambiguous: one per path; unlinked: up to 5 samples + remainder line when applicable).
5. WHEN mode is `summary` and multiple warnings share another code (e.g. many `READ_FAILED`) THEN stderr SHALL emit **one** line for that code with count + representative next-step / message gist.
6. WHEN a code already has a single instance (`EMPTY_SINCE_WINDOW`, `COMPARE_SINCE_MISMATCH`, …) THEN summary mode SHALL still emit that one line (no loss of signal).

**Independent Test:** Feed `createCliDiagnosticHandlers` a fixture `ScanWarning[]`; assert stderr under summary vs full.

**Requirements:** HOTSPOT-955, HOTSPOT-956, HOTSPOT-957

---

### P1: JSON / programmatic completeness unchanged ⭐ MVP

**User Story:** As a JSON/API consumer, I want the full warning list regardless of stderr mode.

**Why P1:** Locked non-regression for contract and library use.

**Acceptance Criteria:**

1. WHEN a scan completes under `--warnings summary` or `full` THEN `meta.warnings` SHALL contain the same full structured list the miner/pipeline produced (including today’s unlinked 5+remainder message shape).
2. WHEN a programmatic `onWarning` is supplied by a library caller (not the CLI sink) THEN each `ScanWarning` SHALL still be delivered one-by-one — CLI `warningsMode` SHALL NOT apply.
3. WHEN schemas / contract tests run THEN no `version` bump or `ScanWarning` shape change SHALL be required for this feature.

**Independent Test:** CLI `--format json` with rename fixture; assert `meta.warnings.length` matches full mode expectation under both `--warnings` values.

**Requirements:** HOTSPOT-952, HOTSPOT-953

---

### P1: Quiet / verbose interaction ⭐ MVP

**User Story:** As an operator, I want clear composition of `--quiet`, `--verbose`, and `--warnings`.

**Why P1:** Prevents regressions against M38/M51 locks.

**Acceptance Criteria:**

1. WHEN `--verbose` is set THEN it SHALL continue to mean git spawn argv trace only — it SHALL NOT expand warning stderr detail.
2. WHEN `--warnings=full` is set THEN per-path/per-pair warning stderr SHALL expand regardless of `--verbose`.
3. WHEN `--quiet` is set THEN progress and `info` SHALL remain suppressed; `warning`/`error` SHALL still emit according to `--warnings` mode.
4. WHEN both `--quiet` and `--warnings=full` are set THEN quiet SHALL win for progress/info; warning/error SHALL emit in **full**.

**Independent Test:** CLI unit tests composing flags; assert stderr contents.

**Requirements:** HOTSPOT-954

---

### P1: Diagnostic sink + flush wiring ⭐ MVP

**User Story:** As the CLI, I need a single place that buffers and flushes summary lines after all warnings for a command are known.

**Why P1:** Correct ordering relative to report stdout and compare meta warnings.

**Acceptance Criteria:**

1. WHEN `createCliDiagnosticHandlers({ warningsMode: "summary" })` is used THEN `onWarning` for warning/error SHALL buffer for stderr aggregation (info still subject to quiet rules).
2. WHEN `flushWarnings()` is called THEN summary lines SHALL be written to stderr and the buffer cleared.
3. WHEN mode is `full` THEN `onWarning` SHALL log immediately and `flushWarnings()` SHALL be a no-op (or empty flush).
4. WHEN `executeScan` / `executeCompareAndRender` complete their warning emission THEN they SHALL call `flushWarnings()` before returning (compare: after compare `meta.warnings` loop).
5. WHEN `baseline save` runs a scan via `executeScan` THEN it SHALL honor the same `--warnings` mode and flush.

**Independent Test:** Unit tests on handlers; CLI tests that flush occurred (summary lines appear once after scan, not duplicated).

**Requirements:** HOTSPOT-958, HOTSPOT-959

---

### P1: Docs + completion ⭐ MVP

**User Story:** As a new user, I want docs and shell completion to expose `--warnings`.

**Why P1:** Adoption surface for a default-behavior change.

**Acceptance Criteria:**

1. WHEN reading README / recipes / `docs/warning-codes.md` THEN `--warnings` default `summary`, `full` opt-in, quiet/verbose interaction, and “JSON stays full” SHALL be documented.
2. WHEN completion scripts are generated THEN `--warnings` SHALL appear for `scan` / `compare` (and baseline save shared flags as applicable).
3. WHEN ARCHITECTURE diagnostics section is read THEN stderr summary sink SHALL be noted (presentation-only).

**Independent Test:** Doc review + completion unit string contains `--warnings`.

**Requirements:** HOTSPOT-960, HOTSPOT-961, HOTSPOT-962

---

## Edge Cases

- WHEN zero warnings THEN summary flush SHALL emit nothing (no empty “0 warnings” spam on stderr; stdout exec summary may still say `Warnings: 0`).
- WHEN only `info` warnings exist under `--quiet` THEN stderr SHALL omit them; flush SHALL not resurrect them.
- WHEN `--output` writes the report to a file THEN summarized/full warnings SHALL still go to stderr (existing transport rules).
- WHEN `--format json` prints to stdout THEN stderr summary SHALL not corrupt JSON stdout.
- WHEN cancel / hard error occurs before flush THEN best-effort: flush buffered warnings only if bin reaches a path that calls flush; do not invent new cancel UX (M51 cancel unchanged).

---

## Requirement Traceability

| Requirement ID  | Story                                     | Phase | Status  |
| --------------- | ----------------------------------------- | ----- | ------- |
| HOTSPOT-950     | P1: Flag + default                        | Tasks | Pending |
| HOTSPOT-951     | P1: Invalid value exit 2                  | Tasks | Pending |
| HOTSPOT-952     | P1: meta.warnings full                    | Tasks | Pending |
| HOTSPOT-953     | P1: Programmatic onWarning full           | Tasks | Pending |
| HOTSPOT-954     | P1: Quiet / verbose interaction           | Tasks | Pending |
| HOTSPOT-955     | P1: Rename ambiguous summary              | Tasks | Pending |
| HOTSPOT-956     | P1: Rename unlinked summary               | Tasks | Pending |
| HOTSPOT-957     | P1: Other multi-code collapse + full mode | Tasks | Pending |
| HOTSPOT-958     | P1: Diagnostic sink API                   | Tasks | Pending |
| HOTSPOT-959     | P1: Bin flush wiring                      | Tasks | Pending |
| HOTSPOT-960     | P1: Living docs                           | Tasks | Pending |
| HOTSPOT-961     | P1: Completion scripts                    | Tasks | Pending |
| HOTSPOT-962     | P1: Help text                             | Tasks | Pending |
| HOTSPOT-963–969 | Reserved                                  | —     | Unused  |

**Coverage:** 13 mapped IDs (950–962); 7 reserved.

---

## Success Criteria

- [ ] Default scan stderr no longer prints one line per ambiguous rename path when N>1
- [ ] `--warnings=full` restores today’s per-path stderr detail
- [ ] JSON `meta.warnings` identical in count/content across modes for the same scan
- [ ] `pnpm build && pnpm test` green after Execute
