# Milestone 73 — Top-only Summary Rollups Specification

**Feature slug:** `top-only-rollups`  
**Milestone:** M73  
**Priority:** Medium  
**Status:** Specs Planned  
**Depth:** Medium  
**IDs:** HOTSPOT-1500–1519 (1515–1519 reserved)  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [TESTING.md](../../codebase/TESTING.md), [CONCERNS.md](../../codebase/CONCERNS.md) § Diagnostics  
**Artifacts:** [context.md](./context.md) · [design.md](./design.md) · [tasks.md](./tasks.md)  
**Sisters:** warnings-bookend-dx (M68), feedback-copy-ux (M62), inline-progress-bar (M61), cli-warnings-mode (M58)

---

## Problem Statement

Default `scan` table output surfaces the same Warnings rollup twice (stderr pre-write teaser + executive summary) and Timing twice (rich summary line + brief `timing: total Nms` on stderr). Operators reading an interactive TTY see duplicated bookends that add noise without new information. M68 introduced the teaser for a silent `Finalizing…` gap; that gap is no longer worth a second rollup when the report already opens with Warnings/Timing.

## Goals

- [ ] Remove the pre-write stderr warning teaser under `--warnings=summary`
- [ ] Remove the brief post-flush stderr timing line (`timing: total Nms`)
- [ ] Keep Warnings + Timing rollups only in the table/markdown executive summary
- [ ] Keep post-write aggregated `warning:` detail lines via `flushWarnings()`
- [ ] Preserve `--warnings=full` / `json`, `--quiet`, write confirm, and `--explain` order after flush
- [ ] Sync living docs to the new lifecycle
- [ ] `pnpm build && pnpm test` green after Execute

## Out of Scope

| Feature                                                                    | Reason                                                            |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| New CLI flags / config keys                                                | YAGNI                                                             |
| Schema / ranking / `meta.warnings` / `meta.timings` changes                | Unrelated; payloads stay full                                     |
| Bottom-only (strip exec-summary Warnings/Timing)                           | Rejected — report must stay self-contained for `--output` / pipes |
| Moving actionable `warning:` detail into the report body (item C)          | Deferred horizon                                                  |
| Changing `--warnings=full` stream-during-scan or `json` post-write payload | Sister modes unchanged                                            |
| Reviving compare/baseline                                                  | M71 hard cut                                                      |

---

## Locked decision

| Item                 | Lock                                                                                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Top-only rollups** | Keep `Warnings:` and `Timing:` only in the human report executive summary. Drop M68 pre-write teaser and M62 brief stderr timing. Keep post-write `flushWarnings` detail for `--warnings=summary`. |

**Supersedes (presentation only):** M68 lock B pre-write teaser half; M62 dual-surface brief stderr timing. Historical Done sister specs stay historical — do not reopen their tasks.md to Done→edit.

---

## User Stories

### P1: No duplicate Warnings rollup on stderr ⭐ MVP

**User Story:** As an operator running `hotspot-scanner scan` with default `--warnings=summary`, I want a single Warnings rollup in the report header — not a second identical line on stderr before the table.

**Why P1:** Removes the most visible duplicate in interactive output.

**Acceptance Criteria:**

1. WHEN a successful `scan` completes under `--warnings=summary` with buffered warnings THEN the system SHALL NOT emit a pre-write stderr teaser equal to `formatWarningSummaryLine`
2. WHEN the report format is `table` or `markdown` THEN the executive summary SHALL still include `formatWarningSummaryLine` (including `Warnings: 0` when empty)
3. WHEN post-write `flushWarnings` runs under `summary` with buffered warnings THEN aggregated `warning:` detail lines SHALL still appear on stderr after the report write
4. WHEN `--warnings=full` THEN streamed lines during the scan SHALL remain; there SHALL be no pre-write teaser; flush SHALL NOT re-emit full lines
5. WHEN `--warnings=json` THEN there SHALL be no teaser; exactly one JSON warnings document SHALL emit at post-write flush

**Independent Test:** Bin order tests — assert no teaser call/string before write; exec summary still has `Warnings:`; flush still emits after write.

**Requirements:** HOTSPOT-1500, HOTSPOT-1501, HOTSPOT-1502, HOTSPOT-1503, HOTSPOT-1504

---

### P1: No duplicate Timing on stderr ⭐ MVP

**User Story:** As an operator reading a successful scan table/markdown report, I want Timing only in the executive summary — not a second brief `timing: total Nms` line after the flush.

**Why P1:** Timing dual surface is pure duplication; the summary line already includes stage breakdown.

**Acceptance Criteria:**

1. WHEN a successful `scan` has `meta.timings` and format is `table` or `markdown` THEN the executive summary SHALL still include `formatTimingSummaryLine`
2. WHEN a successful `scan` completes (any format) THEN the CLI SHALL NOT write `timing: total ${totalMs}ms` (or equivalent brief stderr timing) after flush
3. WHEN `--quiet` is set THEN behavior for timing SHALL remain: no brief stderr timing (already suppressed) and exec summary still rendered to the report destination when applicable

**Independent Test:** Bin tests that previously asserted `timing: total` on stderr inverted; summary Timing line still present in table/markdown fixtures.

**Requirements:** HOTSPOT-1505, HOTSPOT-1506, HOTSPOT-1507

---

### P2: Docs truth for the new lifecycle

**User Story:** As an operator or agent reading docs, I want warning/timing presentation docs to match shipped behavior (no bookend teaser; no brief stderr timing).

**Why P2:** Prevents regressing to the M68/M62 dual-surface mental model.

**Acceptance Criteria:**

1. WHEN reading `docs/warning-codes.md` THEN it SHALL document summary mode as: buffer during scan → write report → post-write aggregated flush (no pre-write teaser)
2. WHEN reading README timing/warnings prose THEN it SHALL not claim a brief stderr timing echo after successful scans
3. WHEN reading ARCHITECTURE diagnostics notes that mention the bookend teaser THEN they SHALL be updated to the M73 lifecycle

**Independent Test:** Docs review in Execute; no runtime gate beyond full project gate.

**Requirements:** HOTSPOT-1508, HOTSPOT-1509, HOTSPOT-1510

---

## Edge Cases

- WHEN summary buffer is empty THEN no teaser (already), write, flush noop — unchanged except teaser path is gone entirely
- WHEN `--output` writes a file THEN write confirm (M69) still emits between write success and flush; no teaser before write
- WHEN `--explain` is set THEN explain still runs after flush (M62 order minus timing)
- WHEN JSON/CSV formats run THEN no human exec-summary Timing/Warnings lines on stdout; still no brief stderr timing; warnings still follow `--warnings` mode at flush
- WHEN `trend` or other non-scan commands run THEN this milestone does not change their stderr (scan-path only for teaser/timing removal)

## Requirement Traceability

| Requirement ID    | Story                                           | Phase | Status   |
| ----------------- | ----------------------------------------------- | ----- | -------- |
| HOTSPOT-1500      | P1: no pre-write teaser                         | Tasks | Pending  |
| HOTSPOT-1501      | P1: keep exec-summary Warnings                  | Tasks | Pending  |
| HOTSPOT-1502      | P1: keep post-write flush detail                | Tasks | Pending  |
| HOTSPOT-1503      | P1: full mode unchanged (no teaser, no re-emit) | Tasks | Pending  |
| HOTSPOT-1504      | P1: json mode unchanged (no teaser, one flush)  | Tasks | Pending  |
| HOTSPOT-1505      | P1: keep exec-summary Timing                    | Tasks | Pending  |
| HOTSPOT-1506      | P1: remove brief stderr timing                  | Tasks | Pending  |
| HOTSPOT-1507      | P1: quiet compose                               | Tasks | Pending  |
| HOTSPOT-1508      | P2: warning-codes.md                            | Tasks | Pending  |
| HOTSPOT-1509      | P2: README                                      | Tasks | Pending  |
| HOTSPOT-1510      | P2: ARCHITECTURE                                | Tasks | Pending  |
| HOTSPOT-1511–1514 | (unassigned buffer)                             | —     | Reserved |
| HOTSPOT-1515–1519 | (reserved)                                      | —     | Reserved |

## Success Criteria

- [ ] Default interactive scan: one Warnings rollup + one Timing line in the report header; no teaser; no `timing: total` stderr; detail `warning:` lines still after the table when warnings exist
- [ ] `--warnings=full` / `json` behavior preserved aside from teaser absence (full never had teaser)
- [ ] Living docs match
- [ ] `pnpm build && pnpm test` green
