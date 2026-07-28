# Milestone 62 — Feedback and Copy UX Context

**Feature slug:** `feedback-copy-ux`  
**Captured:** 2026-07-26  
**Trigger:** ROADMAP M62 + planner lock (parent session)  
**Depth:** Large (diagnostics progress prefix + report summary/compare copy + bin exit/hints/CSV confirm + README de-jargon)  
**IDs:** HOTSPOT-1030–1059 (1046–1059 reserved)

---

## Feature Boundary

Polish operator-facing **feedback and copy**: confirm CSV bundle writes, surface scan timings in human reports and a brief stderr line, remove milestone jargon from CLI help and README, prefix the first progress line with `since=…`, clarify empty compare deltas, map `BaselineError` to usage exit **2**, and point baseline path failures at `hotspot-scanner baseline save`.

**In scope:** `bin/scan-actions.ts` (`writeCsvBundle` confirm, baseline path hints, `executeScan`/`executeCompareAndRender` wiring), `bin/hotspot-scanner.ts` (help text, `main` exit mapping), `src/diagnostics/logger.ts` (first-progress `since=`), `src/report/summary.ts` (+ compare table/markdown empty-delta copy as needed), user-facing `README.md` sections, co-located unit tests.

**Out of scope:** JSON schema / contract bump; ranking / scoring changes; implementing M61 inline progress bar; new CLI flags or config keys; changing `--quiet` / `--no-progress` / `--warnings` semantics beyond composing with new stderr lines; resurrecting function-mode product claims; doctor/init/completion progress; rewriting `.specs/` historical milestone IDs.

**Sisters:** csv-bundle (M18), cli-surface-polish (M38), baseline-save (M40), scan-observability / timings (M51), compare-interpretation (M53), cli-warnings-mode (M58), tty-ephemeral-progress (M59), inline-progress-bar (M61 — **sister only; do not implement**).

---

## Decision: `BaselineError` → exit 2 (LOCKED)

**Question:** Should invalid/unreadable baseline content keep exit `1` (today’s `main` catch-all) or align with usage errors?

**Choice:** Map `BaselineError` to exit code **`2`** (same bucket as `CliUsageError` / `ConfigError` / `InitError`). Rationale: bad baseline path/content is an operator input/contract problem, not a scan pipeline failure. Update `main` in `bin/hotspot-scanner.ts` and any tests that assert exit `1` for `BaselineError`.

**Non-goals:** Do not change `ScanCancelExit` (`130`/`143`), doctor failure exits, or generic fatal scan errors (remain `1`). `--strict` since-mismatch compare failures stay as today unless already a dedicated type with its own code.

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-1038

---

## Decision: `since=` on first progress line only (LOCKED)

**Question:** How is the scan window shown during progress?

**Choice:**

| Rule                 | Behavior                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Prefix               | First **emitted** progress line (after throttle) is prefixed with `since=<effectiveSince> · ` (or equivalent separator) before the existing body |
| Later lines          | Subsequent progress writes (TTY `\r` overwrite **and** non-TTY `\n` lines) do **not** repeat the `since=` prefix                                 |
| Source               | Effective window = CLI > config > `DEFAULT_SINCE` — pass resolved string into `CliDiagnosticOptions.since`                                       |
| Quiet / no-progress  | No progress → no prefix                                                                                                                          |
| Missing since option | If handlers omit `since`, behave as today (no prefix) — CLI wiring always passes resolved since for scan/compare/baseline-save paths             |

**Compose with M59:** Live overwrite still replaces the whole line; only the **first** write includes `since=`. Later overwrites use the body without re-prefixing.

**Compose with M61 (do not implement M61):** If/when finalize phase lands later, `since=` remains **first progress emission of the scan only** — not re-applied on `finalize`. M62 must not add bars, finalize phase, or flush deferral.

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-1034, HOTSPOT-1035

---

## Decision: Timings — table/markdown vs stderr wording (LOCKED)

**Question:** How do human reports and stderr present `meta.timings` (already populated by M51)?

**Choice:**

| Surface                                | When                                                                                  | Wording (lock intent; exact ms/s formatting implementer discretion within tests)                                                                                                                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Table / markdown executive summary** | Successful scan (and compare using **current** scan timings when present)             | One summary line with **total** + stage breakdown, e.g. `Timing: total 1.2s (git 800ms, complexity 900ms)`. May note that under overlap stage sums can exceed total (user-facing wording — **no** “M34”). Omit line when `meta.timings` absent (legacy baseline-only edge). |
| **stderr**                             | After successful scan/compare pipeline that produced timings; **not** under `--quiet` | **Brief** one-liner, shorter than the summary line — e.g. `timing: total 1234ms` (optional short stage gist). Must not dump a multi-line block.                                                                                                                             |
| **JSON / CSV**                         | Unchanged payloads                                                                    | Timings already in `meta` / `meta.json`; no new stdout fields for this milestone                                                                                                                                                                                            |

Do **not** invent new timing fields. Do **not** print stderr timings for doctor/init/completion.

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-1031, HOTSPOT-1032

---

## Decision: CSV bundle path confirmation (LOCKED)

**Question:** How does the operator know which files were written for `--format csv`?

**Choice:** After `writeCsvBundle` successfully writes all files, emit a **stderr** confirmation listing each written path (stem + suffix keys, e.g. `…/out.hotspots.csv`, `…/out.meta.json`). Prefer a short header + one path per line. Suppress under `--quiet`. Do not write confirmation to stdout (preserves pipe/CI stdout purity for non-csv; csv already requires `--output`).

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-1030

---

## Decision: Empty compare deltas copy (LOCKED)

**Question:** What should table/markdown show when compare hotspot deltas are empty?

**Choice:** When total hotspot deltas (`new + removed + rankChanged`) is **0**, replace the opaque `Hotspot deltas: showing 0 of 0 (new 0, removed 0, rank changed 0)` executive-summary line with a clear message that includes the phrase **`No rank changes`** (or equivalent stable string containing that meaning), e.g. `Hotspot deltas: No rank changes (no new, removed, or rank-changed hotspots)`. Empty section bodies may keep `(none)` / `_No results._` **or** use clearer per-section labels — implementer discretion if summary line alone satisfies acceptance; prefer at least the summary line change for table **and** markdown (shared `buildCompareExecutiveSummary`).

JSON/CSV compare payloads unchanged.

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-1036, HOTSPOT-1037

---

## Decision: Baseline path / content hints mention `baseline save` (LOCKED)

**Question:** What Hint text for missing or invalid baseline paths?

**Choice:** Update operator-facing hints so missing file, directory-as-path, and invalid/unreadable baseline messaging mentions **`hotspot-scanner baseline save`** as the preferred way to create a baseline (alongside or instead of only `--format json --output` where that is today’s sole hint). Keep existing re-scan / JSON contract language for structural `BaselineError` validation failures; add or adjust so operators discover the save verb.

Targets today: `BASELINE_JSON_HINT` in `bin/scan-actions.ts` (`validateBaselinePath`), and `BaselineError` hint helpers in `src/compare/load-baseline.ts` / presentation path as needed — without weakening validation.

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-1039, HOTSPOT-1040

---

## Decision: Help + README — no milestone jargon (LOCKED)

**Question:** May user-facing help/README keep `M34`, `M41`, …?

**Choice:**

| Surface                               | Rule                                                                                                                                           |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `bin/hotspot-scanner.ts` help strings | Replace milestone jargon (e.g. “disables M34 stage overlap”) with user-facing wording (e.g. concurrent git + NCLOC / lower peak memory)        |
| User-facing **README** sections       | Strip milestone IDs (`M30`, `M34`, `M40`, `M41`, `M51`, `M53`, `M57`, …) from prose and flag tables; describe behavior without ROADMAP numbers |
| `.specs/`                             | Keep milestone IDs (historical SoT)                                                                                                            |

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-1033, HOTSPOT-1041

---

## Open items

_None._ All gray areas closed by parent mission lock + planner confirmation above.
