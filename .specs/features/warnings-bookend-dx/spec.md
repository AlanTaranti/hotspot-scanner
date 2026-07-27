# Milestone 68 — Warnings Presentation DX Specification

**Feature slug:** `warnings-bookend-dx`  
**Milestone:** M68  
**Priority:** High  
**Status:** Specs Planned  
**Depth:** Large  
**IDs:** HOTSPOT-1230–1259 (1255–1259 reserved)  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [TESTING.md](../../codebase/TESTING.md), [CONCERNS.md](../../codebase/CONCERNS.md) § Diagnostics  
**Artifacts:** [context.md](./context.md) · [design.md](./design.md) · [tasks.md](./tasks.md)  
**Sisters:** cli-warnings-mode (M58), tty-ephemeral-progress (M59), inline-progress-bar (M61), feedback-copy-ux (M62), cli-surface-parity (M63)

---

## Problem Statement

After M61 deferred `flushWarnings` until **after** report write, operators still read docs and ROADMAP M58 prose that claim summary warnings appear **before** the Hotspots report. Compare table/markdown still dump every `formatScanWarning` line into the body while the executive summary already rolls up counts — triple surface with stderr. Summary mode also leaves a long silent stretch under `Finalizing…` with no short warning signal before the write.

## Goals

- [ ] Emit a short stderr teaser **before** write under `--warnings=summary`, then full flush **after** write (lock B)
- [ ] Keep `Finalizing…` until immediately before teaser; preserve M62 timing → explain after flush
- [ ] `--warnings=json`: one emission only at end; `--warnings=full`: stream during scan, no teaser, flush does not re-emit
- [ ] Remove compare body warning loops; keep exec-summary rollup only (lock K)
- [ ] Fix `docs/warning-codes.md` timing + document `json` mode (A+G)
- [ ] Align ROADMAP M58 historical notes + `AGENTS.md` exit table (L+E)
- [ ] `pnpm build && pnpm test` green after Execute

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Full warning lines in scan report body (item C) | Explicitly deferred |
| Fail-on-warning / CI gate on warning codes | Deferred horizon |
| npm publish / SARIF | Deferred horizon |
| Timing stderr on `baseline save` | Out of this batch |
| New CLI flags / config keys / schema bump | YAGNI |
| Thinning `meta.warnings` | M58 lock — full structured list stays |
| M69 write confirm / M70 Lines column | Separate milestones |

---

## User Stories

### P1: Stderr bookend lifecycle (B) ⭐ MVP

**User Story:** As an operator running a scan with default `--warnings=summary`, I want a short warning rollup on stderr before the report is written, then the detailed aggregated lines after the write, without losing `Finalizing…` until the teaser.

**Why P1:** Core UX fix for M61 flush deferral + silent finalize gap.

**Acceptance Criteria:**

1. WHEN a successful `scan` / compare / `baseline save` completes under `--warnings=summary` with buffered warnings THEN the system SHALL clear the live progress line, emit one teaser stderr line (`formatWarningSummaryLine` content), write the report/baseline, then call `flushWarnings` for aggregated detail lines
2. WHEN the summary buffer is empty THEN the system SHALL clear live progress, skip the teaser line, write, then flush (noop)
3. WHEN `--warnings=full` THEN the system SHALL omit the pre-write teaser; streamed lines during scan remain; post-write `flushWarnings` SHALL NOT re-emit full warning lines
4. WHEN `--warnings=json` THEN the system SHALL omit the teaser and emit exactly one JSON warnings document at post-write flush
5. WHEN timing and/or `--explain` are in play THEN they SHALL run after flush (M62 order unchanged)
6. WHEN `--quiet` is set THEN teaser and summary/json flush emissions SHALL still follow warning/error rules from M58 (info suppressed; warning/error still flush)

**Independent Test:** Unit/order tests in `bin/hotspot-scanner.test.ts` and diagnostics tests: finalize → teaser → write → flush → timing → explain.

**Requirements:** HOTSPOT-1230, HOTSPOT-1231, HOTSPOT-1232, HOTSPOT-1233, HOTSPOT-1234, HOTSPOT-1235, HOTSPOT-1236, HOTSPOT-1244

---

### P1: Compare report warning dedup (K) ⭐ MVP

**User Story:** As an operator reading a compare table or markdown report, I want warning detail only via the executive rollup + stderr — not a third dump of every warning line in the body.

**Why P1:** Eliminates triple surface; aligns compare with scan.

**Acceptance Criteria:**

1. WHEN `renderCompareTable` / `renderCompareMarkdown` run THEN they SHALL NOT loop `formatScanWarning` over `result.meta.warnings` into the body
2. WHEN compare executive summary is built THEN it SHALL still include `formatWarningSummaryLine` rollup (`Warnings: N total (CODE: n)`)
3. WHEN compare JSON/CSV is rendered THEN `meta.warnings` SHALL remain the full structured list (unchanged)

**Independent Test:** Update `compare-table.test.ts` / `compare-markdown.test.ts` — assert no full warning message lines in body; rollup still present.

**Requirements:** HOTSPOT-1237, HOTSPOT-1238

---

### P2: Docs truth (A + G + L + E)

**User Story:** As an operator or agent reading docs, I want warning timing, `json` mode, ROADMAP M58 notes, and AGENTS exit codes to match shipped behavior.

**Why P2:** Prevents regressing to “before Hotspots report” mental model.

**Acceptance Criteria:**

1. WHEN reading `docs/warning-codes.md` THEN it SHALL document real timing: summary/json post-write flush; summary pre-write teaser; full during scan; bookend order; and `--warnings=json` mode
2. WHEN reading ROADMAP M58 Done prose (and any living note that still says warnings appear before the Hotspots report) THEN it SHALL be corrected or annotated with a pointer to M61+M68 lifecycle
3. WHEN reading `AGENTS.md` exit-code table THEN it SHALL list `0` / `1` / `2` / `130` / `143` aligned with README

**Independent Test:** Docs review in Execute; no runtime gate beyond full project gate.

**Requirements:** HOTSPOT-1239, HOTSPOT-1240, HOTSPOT-1241, HOTSPOT-1242, HOTSPOT-1243

---

## Edge Cases

- WHEN `--warnings=summary` and zero warnings THEN no teaser line; flush clears live only
- WHEN `--warnings=full` and no warnings during scan THEN flush after write is silent (no re-emit)
- WHEN stdout-only table write (no `--output`) THEN bookend still applies around `writeRenderedOutput`
- WHEN CSV bundle write confirms on stderr (M62) THEN bookend order remains: teaser → write (incl. CSV confirm inside write) → flush → timing
- WHEN cancel (`SIGINT`/`SIGTERM`) THEN no report and no teaser/flush (M51 unchanged)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-1230 | P1: Teaser API / clear-live helper | Design | Pending |
| HOTSPOT-1231 | P1: Order finalize → teaser → write → flush | Design | Pending |
| HOTSPOT-1232 | P1: summary teaser + post-write aggregated flush | Design | Pending |
| HOTSPOT-1233 | P1: full — no teaser; flush no re-emit | Design | Pending |
| HOTSPOT-1234 | P1: json — one emission at end only | Design | Pending |
| HOTSPOT-1235 | P1: quiet compose with teaser/flush | Design | Pending |
| HOTSPOT-1236 | P1: scan + compare + baseline save paths | Design | Pending |
| HOTSPOT-1237 | P1: remove compare `formatScanWarning` loops | Design | Pending |
| HOTSPOT-1238 | P1: compare exec summary rollup only | Design | Pending |
| HOTSPOT-1239 | P2: warning-codes.md timing truth | Design | Pending |
| HOTSPOT-1240 | P2: document `json` mode in warning-codes | Design | Pending |
| HOTSPOT-1241 | P2: ROADMAP M58 / historical “before report” notes | Design | Pending |
| HOTSPOT-1242 | P2: AGENTS.md exit codes `0/1/2/130/143` | Design | Pending |
| HOTSPOT-1243 | P2: ARCHITECTURE/README lifecycle note if needed | Design | Pending |
| HOTSPOT-1244 | P1: order tests (teaser/write/flush/timing/explain) | Design | Pending |
| HOTSPOT-1245–1254 | — | — | Unassigned (buffer) |
| HOTSPOT-1255–1259 | — | — | Reserved |

**Coverage:** 15 mapped P1/P2 IDs; 1255–1259 reserved; 1245–1254 buffer.

---

## Success Criteria

- [ ] Default summary bookend visible and tested on scan/compare/baseline save
- [ ] full/json modes match locked table; no double emission
- [ ] Compare table/markdown bodies have no full-warning loops
- [ ] Docs + AGENTS + ROADMAP M58 notes match reality
- [ ] Gate green: `pnpm build && pnpm test`
