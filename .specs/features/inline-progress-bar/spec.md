# Milestone 61 — Inline Progress Bar Specification

**Feature slug:** `inline-progress-bar`  
**Milestone:** M61  
**Priority:** Medium  
**Status:** Specs Planned  
**Depth:** Large  
**IDs:** HOTSPOT-1010–1029 (1026–1029 reserved)  
**Artifacts:** [context.md](./context.md) · [design.md](./design.md) · [tasks.md](./tasks.md)

---

## Problem Statement

M59 gave interactive scans a single ephemeral stderr progress line, but complexity still uses plain text counters (no fill bar), git wording is verbose, and — critically — `flushWarnings()` runs **before** scoring tail / render / write. Operators see the live line vanish during a silent “finalizing” gap even though work continues. CI needs the same honest counters with ASCII-safe bars on permanent `\n` lines.

## Goals

- [ ] Homegrown complexity fill bar (TTY block glyphs; non-TTY `#`/`-`) with honest `filesProcessed/totalFiles` (+ batch when known)
- [ ] Git indeterminate commit counter only (no bar / fake %)
- [ ] Explicit `Finalizing…` phase after git+complexity barrier through score / compare / render / write
- [ ] Defer `flushWarnings` until after stdout/file write (scan, compare, baseline)
- [ ] No new flags/config/schema; honor quiet / no-progress / M58 / injectable TTY
- [ ] Document progress UX in README + ARCHITECTURE

## Out of Scope

| Feature                                                       | Reason                                    |
| ------------------------------------------------------------- | ----------------------------------------- |
| ora / cli-progress / new runtime deps                         | Locked Option B — homegrown               |
| ETA / spinners                                                | YAGNI                                     |
| Fake overall 0–99% meter                                      | Locked — honest phase counters only       |
| Cap complexity file progress at 99%                           | Locked — show 100% of files then finalize |
| doctor / init / dry-run / completion progress                 | Different commands                        |
| Schema bump / ranking / JSON contract                         | Presentation + lifecycle only             |
| Multi-bar for overlap                                         | Last-writer-wins single line              |
| Change throttle intervals (except finalize always emits once) | YAGNI                                     |

---

## User Stories

### P1: Complexity fill bar (TTY + non-TTY) ⭐ MVP

**User Story:** As a CLI user, I want complexity progress to show a fill bar with honest file counts so I can see real analysis progress.

**Why P1:** Core product ask for M61.

**Acceptance Criteria:**

1. WHEN stderr is a TTY, progress is not suppressed, and `totalFiles` is known THEN complexity progress SHALL render an inline fill bar using filled `█` and empty `░` blocks plus `filesProcessed/totalFiles` (locale en-US) and, when known, batch `n/N` — e.g. `complexity [████████░░] 800/1,050 files · batch 16/21`.
2. WHEN stderr is not a TTY and `totalFiles` is known THEN the same counters SHALL use ASCII `#` / `-` fill on `\n`-terminated lines.
3. WHEN `totalFiles` is unknown THEN the system SHALL omit the bracketed bar and still show available file/batch counters.
4. WHEN `filesProcessed === totalFiles` THEN the bar SHALL render as fully filled (100% of files) — SHALL NOT freeze at 99%.
5. WHEN no overall scan percentage is requested THEN the system SHALL NOT emit a fake 0–99% overall meter.

**Independent Test:** Unit tests for formatter golden strings (0%, mid, 100% files) with injected TTY / columns; non-TTY ASCII variants.

**Requirements:** HOTSPOT-1010, HOTSPOT-1011, HOTSPOT-1012, HOTSPOT-1014

---

### P1: Git indeterminate counter ⭐ MVP

**User Story:** As a CLI user, I want git progress to show commit counts without a misleading percentage bar.

**Why P1:** Locked UX — git has no known total.

**Acceptance Criteria:**

1. WHEN phase is `git` and progress is not suppressed THEN the body SHALL be an indeterminate counter of the form `git {commitsProcessed} commits…` (en-US grouping) with **no** fill bar and **no** percentage.
2. WHEN throttle skips a tick THEN no write SHALL occur (existing `PROGRESS_LOG_INTERVAL`).

**Independent Test:** Golden string for git body; assert absence of `[` bar brackets and `%`.

**Requirements:** HOTSPOT-1013

---

### P1: Finalize phase through write ⭐ MVP

**User Story:** As a CLI user, I want a live `Finalizing…` line after mining/analysis until the report is written so the terminal does not look stuck or idle.

**Why P1:** Fixes the silent-tail gap; critical wiring.

**Acceptance Criteria:**

1. WHEN both git mine and complexity analyze have completed THEN `runScan` SHALL emit exactly one `onProgress({ phase: "finalize", commitsProcessed: 0 })` at the start of the post-barrier work (before/around score).
2. WHEN that finalize progress is handled and progress is not suppressed THEN the body SHALL be `Finalizing…` (TTY overwrite or non-TTY `\n` per M59).
3. WHEN scoring, optional compare, render, and write run after that emit THEN the live finalize line SHALL remain until teardown clear / `flushWarnings`.
4. WHEN `--quiet` or `--no-progress` is set THEN no finalize progress write SHALL occur.

**Independent Test:** Unit/integration: spy `onProgress` for one finalize after both stages; handler tests for body + quiet suppression; deferred-flush ordering tests.

**Requirements:** HOTSPOT-1015, HOTSPOT-1016, HOTSPOT-1017, HOTSPOT-1020

---

### P1: Defer flushWarnings after write ⭐ MVP

**User Story:** As a CLI user, I want warnings flushed and the progress line cleared only after the report (or baseline) is written.

**Why P1:** Critical wiring change vs today’s pre-return flush.

**Acceptance Criteria:**

1. WHEN a normal scan completes THEN `flushWarnings` SHALL run **after** `writeRenderedOutput` (not inside `executeScan` before return).
2. WHEN a compare path completes THEN `flushWarnings` SHALL run **after** compare render write (not before `renderCompare`).
3. WHEN `baseline save` writes JSON THEN `flushWarnings` SHALL run **after** `writeBaselineJson`.
4. WHEN a warning / error / info diagnostic is about to write to stderr via the CLI sink THEN any open live line SHALL still be cleared first (M59 preserved).
5. WHEN `--explain` writes to stderr THEN the live line SHALL be cleared before that write (flush-after-write normally already cleared; clear-before-write remains the safety rule).

**Independent Test:** Bin / scan-actions unit tests asserting call order: write then flush; compare path same; clear before explain when needed.

**Requirements:** HOTSPOT-1018, HOTSPOT-1019

---

### P1: Width, overlap, no new surface ⭐ MVP

**User Story:** As a maintainer, I want injectable column width, last-writer-wins overlap, and no new CLI/config/schema surface.

**Why P1:** Testability + YAGNI + compose with M59/M58.

**Acceptance Criteria:**

1. WHEN computing bar width THEN the system SHALL derive width from `process.stderr.columns` (injectable, e.g. `stderrColumns`), clamp to documented min/max, and prefer clear-to-EOL over pad-to-width.
2. WHEN git and complexity both tick under overlap THEN one line SHALL remain (last-writer-wins); complexity bar preferred when both update; finalize replaces after both stages complete.
3. WHEN the feature ships THEN there SHALL be no new CLI flags, config keys, or JSON schema changes; M58 warnings compose unchanged; `stderrIsTTY` remains injectable.
4. WHEN implementing the bar THEN the solution SHALL be homegrown in diagnostics — no new progress runtime dependencies.

**Independent Test:** Inject columns; overlap last-write assertions; package.json unchanged for progress libs; help/docs invent no flags.

**Requirements:** HOTSPOT-1021, HOTSPOT-1022, HOTSPOT-1023, HOTSPOT-1024

---

### P1: Living docs ⭐ MVP

**User Story:** As an operator/maintainer, I want README and ARCHITECTURE to describe the bar, finalize, and deferred flush behavior.

**Why P1:** Living documentation rule.

**Acceptance Criteria:**

1. WHEN reading README Advanced progress notes THEN TTY bar vs non-TTY ASCII, git counter, `Finalizing…`, and clear-after-write SHALL be documented.
2. WHEN reading ARCHITECTURE diagnostics THEN progress phases SHALL include `finalize` and note deferred flush lifecycle.
3. WHEN docs are updated THEN they SHALL NOT invent flags or config keys.

**Independent Test:** Doc review checklist in docs task.

**Requirements:** HOTSPOT-1025

---

## Edge Cases

- WHEN `totalFiles` is 0 or missing THEN omit bar; do not divide-by-zero.
- WHEN `filesProcessed > totalFiles` (defensive) THEN clamp fill to bar width (full bar).
- WHEN terminal columns are missing/invalid THEN use a documented fallback column budget for bar width.
- WHEN finalize is emitted more than once (bug) THEN handler may overwrite the same body; `runScan` SHALL emit once.
- WHEN `warnings=full` emits a warning during post-barrier before finalize THEN clear then write warning; subsequent finalize may reopen the live line.
- WHEN scan throws before write THEN best-effort clear is Agent’s Discretion (match existing success-path flush; no new global finally required unless easy).
- WHEN throttle intervals apply to git/complexity THEN finalize SHALL bypass throttle (always emit the single finalize tick when not suppressed).

---

## Requirement Traceability

| Requirement ID    | Story                                  | Phase | Status   |
| ----------------- | -------------------------------------- | ----- | -------- |
| HOTSPOT-1010      | P1: Complexity TTY bar                 | Tasks | Pending  |
| HOTSPOT-1011      | P1: Complexity non-TTY ASCII           | Tasks | Pending  |
| HOTSPOT-1012      | P1: Omit bar when total unknown        | Tasks | Pending  |
| HOTSPOT-1013      | P1: Git indeterminate counter          | Tasks | Pending  |
| HOTSPOT-1014      | P1: No overall % / no 99% freeze       | Tasks | Pending  |
| HOTSPOT-1015      | P1: Finalize body                      | Tasks | Pending  |
| HOTSPOT-1016      | P1: Emit finalize once                 | Tasks | Pending  |
| HOTSPOT-1017      | P1: Keep line through write            | Tasks | Pending  |
| HOTSPOT-1018      | P1: Defer flush after write            | Tasks | Pending  |
| HOTSPOT-1019      | P1: Clear before diagnostics / explain | Tasks | Pending  |
| HOTSPOT-1020      | P1: Quiet / no-progress                | Tasks | Pending  |
| HOTSPOT-1021      | P1: Width from columns                 | Tasks | Pending  |
| HOTSPOT-1022      | P1: Overlap last-writer-wins           | Tasks | Pending  |
| HOTSPOT-1023      | P1: No new surface                     | Tasks | Pending  |
| HOTSPOT-1024      | P1: Homegrown Option B                 | Tasks | Pending  |
| HOTSPOT-1025      | P1: Living docs                        | Tasks | Pending  |
| HOTSPOT-1026–1029 | —                                      | —     | Reserved |

**Coverage:** 16 mapped requirements + reserved band; all P1 mapped to tasks.

---

## Success Criteria

- [ ] Interactive complexity progress shows a fill bar with honest file counts; git shows counter only
- [ ] After mine+analyze, `Finalizing…` remains until report/baseline write completes
- [ ] `flushWarnings` runs after write on scan / compare / baseline paths
- [ ] Quiet / no-progress / M58 regressions green; no new flags or deps
- [ ] `pnpm build && pnpm test` passes
- [ ] README + ARCHITECTURE describe bar + finalize + deferred flush
