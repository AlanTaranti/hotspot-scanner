# Milestone 61 — Inline Progress Bar Context

**Feature slug:** `inline-progress-bar`  
**Captured:** 2026-07-26  
**Trigger:** ROADMAP M61 + approved plan lock (parent session)  
**Depth:** Large (diagnostics formatters + finalize phase + CLI flush lifecycle + docs)  
**IDs:** HOTSPOT-1010–1029 (1026–1029 reserved)

---

## Feature Boundary

Extend M59’s single live stderr progress line with an **honest complexity fill bar** and a post-barrier **`Finalizing…`** phase so the line does not disappear during scoring / compare / render. Git stays an indeterminate counter (no fake %). Homegrown presentation only — no progress libraries, no new flags/config/schema.

**In scope:** Formatters + TTY/non-TTY bars in `src/diagnostics/logger.ts`; `"finalize"` on `ScanProgressPhase`; emit finalize at post-barrier in `src/scan.ts`; defer `flushWarnings` until after stdout/file write in scan + compare (+ baseline) paths; unit tests; living docs.

**Out of scope:** ora / cli-progress / new runtime deps; ETA / spinners; fake overall 0–99% meter; freezing complexity at 99% of files; doctor / init / dry-run / completion progress; schema bump; ranking/JSON changes; multi-bar for overlap; changing throttle intervals unless required for finalize (finalize bypasses throttle once).

**Sisters:** tty-ephemeral-progress (M59), cli-warnings-mode (M58), explain-and-scan-feedback (M42), cli-surface-polish (M38 quiet/no-progress).

**Slug note:** Locked as `inline-progress-bar` (alternative considered: `scan-progress-bar-finalize`).

---

## Decision: Homegrown Option B (LOCKED)

**Question:** Progress bar library vs hand-rolled?

**Choice:** **Homegrown Option B** inside the existing M59 diagnostics sink (`createCliDiagnosticHandlers` / `logger.ts`). **No** `ora`, `cli-progress`, or other new runtime dependencies.

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-1024

---

## Decision: Complexity progress UX (LOCKED)

**Question:** What does complexity progress look like on TTY vs non-TTY?

**Choice:**

| Stream | Behavior |
| ------ | -------- |
| **TTY** | Inline fill bar using block glyphs (`█` filled / `░` empty) + honest `filesProcessed/totalFiles` (and batch `n/N` when known). Example: `complexity [████████░░] 800/1,050 files · batch 16/21`. |
| **Non-TTY** | Same semantics with ASCII fill (`#` / `-`) on `\n`-terminated lines (CI-safe). |
| **Total unknown** | Omit the bar brackets; keep file/batch counters when present. |

Do **not** invent an overall scan percentage. Do **not** cap/freeze file progress at 99%.

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-1010, HOTSPOT-1011, HOTSPOT-1012, HOTSPOT-1014

---

## Decision: Git progress UX (LOCKED)

**Question:** Does git get a bar or percentage?

**Choice:** **Indeterminate counter only** — no fake %, no bar. Example: `git 12,000 commits…`.

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-1013

---

## Decision: Finalize phase (LOCKED)

**Question:** What happens after git + complexity complete while scoring / compare / render run?

**Choice:**

1. Add `"finalize"` to `ScanProgressPhase` (or equivalent).
2. Emit `onProgress({ phase: "finalize", commitsProcessed: 0 })` **once** when both mine + analyze complete (start of post-barrier in `src/scan.ts`, before/around score).
3. Body: `Finalizing…`.
4. Keep one live line through scoring + compare (if any) + render/write; clear via existing M59 teardown (`flushWarnings` / clear-before-diagnostic).
5. Quiet / `--no-progress`: no finalize writes.

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-1015, HOTSPOT-1016, HOTSPOT-1017, HOTSPOT-1020

---

## Decision: Defer flushWarnings (LOCKED) — critical wiring

**Question:** When does progress clear relative to report write?

**Problem today:** `executeScan` in `bin/scan-actions.ts` calls `flushWarnings()` **before** returning; bin then render + write. Compare path flushes **before** `renderCompare` / write. Progress disappears during the silent scoring/render tail.

**Choice:**

| Path | Target lifecycle |
| ---- | ---------------- |
| Scan | Keep live line through finalize → score → render → `writeRenderedOutput`; call `flushWarnings` **after** write. |
| Compare | Same: flush **after** `writeRenderedOutput` (not before render). |
| Baseline save | Flush **after** `writeBaselineJson`. |
| Explain | Clear live line before explain stderr writes (M59 clear-before-info). Typically flush already ran after write; if explain runs while a line is open, clear first. |
| M58 | Still clear before warning/error/info writes; summary flush still clears at `flushWarnings()`. |

`executeScan` / compare wiring must **return or expose** `flushWarnings` so the bin (or compare helper) clears after write.

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-1018, HOTSPOT-1019

---

## Decision: Flags / surface unchanged (LOCKED)

**Question:** New flags, config, or schema?

**Choice:** **No new CLI flags / config / JSON schema.** Honor `--quiet` / `--no-progress`, M58 `--warnings` compose, injectable `stderrIsTTY`.

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-1023

---

## Decision: Width + overlap (LOCKED)

**Question:** Bar width and concurrent git/complexity ticks?

**Choice:**

- Derive bar width from `process.stderr.columns` (injectable for tests, e.g. `stderrColumns`), clamp to a documented min/max.
- Prefer **clear-to-EOL** (`\x1b[2K`) over pad-to-width (M59).
- Overlap: **last-writer-wins** on one line; prefer complexity bar when both tick; finalize replaces the line after both stages complete.

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-1021, HOTSPOT-1022

---

## Open items

_None._ All gray areas closed by approved plan lock above.
