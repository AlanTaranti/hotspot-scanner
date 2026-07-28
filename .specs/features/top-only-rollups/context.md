# Milestone 73 — Top-only Summary Rollups Context

**Feature slug:** `top-only-rollups`  
**Captured:** 2026-07-27  
**Trigger:** Operator feedback — Warnings/Timing duplicated at top and bottom of default scan output; prior Ask-mode recommendation locked to top-only rollups  
**Depth:** Medium (bin lifecycle + diagnostics API cleanup + tests + docs)  
**IDs:** HOTSPOT-1500–1519 (1515–1519 reserved)

---

## Feature Boundary

Remove duplicated human rollups for Warnings and Timing so they appear **only** in the table/markdown executive summary. Keep actionable post-write stderr `warning:` detail under `--warnings=summary`. Do not change machine payloads or warning mode semantics beyond dropping the teaser.

**In scope:**

| Item                         | Scope                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| Drop M68 pre-write teaser    | Stop calling / remove `emitWarningTeaser` from scan write lifecycle                      |
| Drop M62 brief stderr timing | Remove `emitBriefTimingStderr` (and call sites)                                          |
| Keep exec summary            | `formatWarningSummaryLine` + `formatTimingSummaryLine` in `buildScanExecutiveSummary`    |
| Keep detail flush            | `flushWarnings()` after write (summary/full/json semantics unchanged except teaser gone) |
| Docs                         | `docs/warning-codes.md`, README, ARCHITECTURE diagnostics notes                          |

**Out of scope:** New flags; schema; bottom-only; item C (body warning dumps); compare/baseline; changing `full`/`json` emission semantics beyond teaser absence.

**Sisters:** warnings-bookend-dx (M68), feedback-copy-ux (M62), inline-progress-bar (M61), cli-warnings-mode (M58), write-confirm-ux (M69 — confirm stays between write and flush).

---

## Decision: Top-only rollups (LOCKED)

**Question:** Where should Warnings and Timing rollups appear for default human scan output?

**Choice:** **Top only** — executive summary in the report body.

| Surface                                              | Keep?   | Notes                                         |
| ---------------------------------------------------- | ------- | --------------------------------------------- |
| Exec summary `Warnings: N total (…)`                 | **Yes** | Self-contained for `--output` / pipes         |
| Exec summary `Timing: total … (git…, complexity…)`   | **Yes** | Stage breakdown lives here                    |
| Pre-write stderr teaser (`formatWarningSummaryLine`) | **No**  | M68 bookend half — supersede for presentation |
| Brief stderr `timing: total Nms`                     | **No**  | M62 dual surface — supersede                  |
| Post-write aggregated `warning:` lines               | **Yes** | Actionable detail, not a rollup duplicate     |
| `--warnings=full` during-scan stream                 | **Yes** | Unchanged                                     |
| `--warnings=json` post-write document                | **Yes** | Unchanged; still no teaser                    |

**Rejected alternatives:**

| Alternative                                      | Why rejected                                           |
| ------------------------------------------------ | ------------------------------------------------------ |
| Bottom-only (strip exec-summary Warnings/Timing) | Saved reports and stdout pipes lose context            |
| Drop detail flush under summary                  | Loses next-step guidance; rollup alone is insufficient |
| New flag to toggle bookend                       | YAGNI — default should be clean                        |

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-1500–1510

---

## Decision: Supersede M68 teaser / M62 brief timing (LOCKED)

**Question:** Reopen Done sister specs?

**Choice:** **No.** Leave M68/M62 `tasks.md` Status Done and historical. STATE + this context record the presentation supersession. Implement against current trunk APIs (`emitWarningTeaser`, `emitBriefTimingStderr`, bin order tests).

**Status:** **Confirmed — planner locked**

---

## Composition locks (carry forward)

| Sister  | Constraint after M73                                                                           |
| ------- | ---------------------------------------------------------------------------------------------- |
| M59     | Clear live before diagnostic stderr / at `flushWarnings`                                       |
| M61     | `Finalizing…` through write; `flushWarnings` **after** write (no teaser inserted before write) |
| M62     | Explain **after** flush; **omit** brief timing stderr                                          |
| M69     | Write confirm still after successful `--output` write, before flush                            |
| M58/M63 | `meta.warnings` / `onWarning` full; `--warnings` CLI-only; no schema bump                      |

**New scan order:**

```
runScan → render → write (optional confirm) → flushWarnings → optional --explain
```

---

## Notes for Execute

- Prefer deleting dead exports (`emitBriefTimingStderr`, `emitWarningTeaser` return surface) over leaving no-op stubs — YAGNI.
- Invert bin tests that assert teaser→write→flush→timing; keep finalize/write/flush/explain coverage.
- Do not thin `meta.warnings` or change JSON Timing fields.
