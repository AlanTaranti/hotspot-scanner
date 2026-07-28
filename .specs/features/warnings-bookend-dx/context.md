# Milestone 68 — Warnings Presentation DX Context

**Feature slug:** `warnings-bookend-dx`  
**Captured:** 2026-07-27  
**Trigger:** ROADMAP M68 + locked product decisions B/K (parent session)  
**Depth:** Large (diagnostics teaser + bin lifecycle + compare report dedup + docs sync)  
**IDs:** HOTSPOT-1230–1259 (1255–1259 reserved)

---

## Feature Boundary

Fix warnings **presentation DX** so stderr timing matches the M61 post-write flush reality, operators get a short pre-write teaser under summary mode, compare reports stop triple-surfacing full warning lines, and living docs / AGENTS exit table stay accurate.

**In scope:**

| Item      | Scope                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------ |
| **B**     | Pre-write short teaser + post-write full flush lifecycle in `bin/` + `src/diagnostics/`                      |
| **K**     | Remove `formatScanWarning` body loops from compare table/markdown; keep exec-summary rollup                  |
| **A + G** | Fix/expand `docs/warning-codes.md` (real timing + `json` mode)                                               |
| **L**     | Align ROADMAP M58 (and related historical notes) that still say “before Hotspots report”; pointer to M61+M68 |
| **E**     | Align `AGENTS.md` exit-code table with README (`0/1/2/130/143`)                                              |

**Out of scope:** Item C (full warning lines in scan report body); fail-on-warning; npm/SARIF; timing on `baseline save`; new CLI flags; schema bump; thinning `meta.warnings`; changing M62 timing/explain order after flush.

**Sisters:** cli-warnings-mode (M58), tty-ephemeral-progress (M59), inline-progress-bar (M61), feedback-copy-ux (M62), cli-surface-parity (M63 `--warnings=json`).

---

## Decision: B — stderr bookend (LOCKED)

**Question:** When do summary/json warning lines appear relative to report write and `Finalizing…`?

**Choice:**

| Step | Behavior                                                                                                                  |
| ---- | ------------------------------------------------------------------------------------------------------------------------- |
| 1    | Keep live `Finalizing…` through score / compare / render until immediately before teaser                                  |
| 2    | Clear live line → **pre-write teaser** (short rollup) → **write** report/baseline → **flushWarnings** (complete emission) |
| 3    | Preserve M62 order after flush: timing stderr → explain (when requested)                                                  |

**Per `--warnings` mode:**

| Mode                | Pre-write teaser                                                                                                        | During scan                                                  | Post-write `flushWarnings`                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `summary` (default) | **Yes** — short rollup via `formatWarningSummaryLine` (or equivalent) of buffered warnings; skip line when buffer empty | Buffer only (unchanged)                                      | Full aggregated per-group lines (current `flushWarningSummary`)                 |
| `full`              | **Omit**                                                                                                                | Stream each line (unchanged M58/M59 clear-before-diagnostic) | Clear live / no-op only — **must NOT re-emit** full lines                       |
| `json`              | **Omit**                                                                                                                | Buffer only                                                  | **One** JSON document emission only at end (unchanged M63 semantics; no teaser) |

**Applies to:** `scan`, `scan --baseline` / `executeCompareAndRender`, and `baseline save` (same flush lifecycle as M61).

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-1230–1236, HOTSPOT-1244

---

## Decision: K — compare warning dedup (LOCKED)

**Question:** Should compare table/markdown still loop full `formatScanWarning` lines into the report body?

**Choice:** **No.** Align compare to scan:

- Executive summary keeps only the rollup: `Warnings: N total (CODE: n)` via `formatWarningSummaryLine`
- **Remove** the `for (const warning of result.meta.warnings) { formatScanWarning(...) }` loops from `src/report/compare-table.ts` and `src/report/compare-markdown.ts`
- Detail stays on stderr via `--warnings` (summary/full/json)

Eliminates triple surface (exec summary + body lines + stderr).

**Unchanged:** `meta.warnings` full structured list in JSON/CSV compare payloads; scan report body (no item C).

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-1237–1238

---

## Decision: Teaser content (LOCKED — agent discretion within B)

**Question:** Exact teaser string?

**Choice:** Reuse `formatWarningSummaryLine(bufferedWarnings)` from `src/report/summary.ts` (or a thin diagnostics wrapper that produces the same string). Write as a single stderr line ending in `\n` after clear-live. Do **not** invent a second rollup format.

When buffer is empty under `summary`: clear live, skip teaser line, proceed to write → flush (noop).

**Status:** **Confirmed — planner locked (discretion on helper location)**

**Applies to:** HOTSPOT-1230, HOTSPOT-1232

---

## Composition locks (carry forward)

| Sister  | Constraint                                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------------- |
| M59     | Clear live before any diagnostic stderr write                                                                 |
| M61     | `Finalizing…` through write; `flushWarnings` after write (extended: teaser inserted immediately before write) |
| M62     | `emitBriefTimingStderr` and explain **after** flush                                                           |
| M58/M63 | `meta.warnings` / programmatic `onWarning` stay full; no schema bump; `--warnings` CLI-only                   |

---

## Gray areas

_None unresolved._ Product locks B/K supplied by parent session. Teaser string reuse is locked above.

---

## Non-goals reminder

- Do not add full warning lines to scan table/markdown body (item C)
- Do not add fail-on-warning / npm / SARIF
- Do not change JSON contract `version: "3.0"`
- Do not implement M69 write confirm or M70 Lines column in this feature
