# Milestone 59 — Ephemeral TTY Scan Progress Context

**Feature slug:** `tty-ephemeral-progress`  
**Captured:** 2026-07-26  
**Trigger:** ROADMAP M59 + planner lock (parent session)  
**Depth:** Large (diagnostics progress sink + M58 compose + docs)  
**IDs:** HOTSPOT-970–989 (981–989 reserved)

---

## Feature Boundary

While a scan runs on an interactive terminal, stderr progress should occupy **one live updating line** that is **cleared** when progress is no longer needed. Piped/CI (non-TTY) keeps today’s permanent newline logs. No new flags, no schema/config changes.

**In scope:** TTY overwrite (`\r` + clear-to-EOL) for remaining `ScanProgress` phases (`git`, `complexity`); clear triggers; compose with M58 `--warnings`; keep `--quiet` / `--no-progress`; living docs.

**Out of scope:** Percentage bars, ETA, spinner glyphs, config key, new CLI flags, changing throttle intervals (`PROGRESS_LOG_INTERVAL` / `COMPLEXITY_PROGRESS_LOG_INTERVAL`), function-churn progress revival (M57 retired), JSON/schema/contract changes.

**Sisters:** perf-diagnostics-ux (M28), cli-surface-polish (M38 quiet/no-progress), explain-and-scan-feedback (M42 complexity progress format), cli-warnings-mode (M58).

---

## Decision: Phases covered (LOCKED)

**Question:** Which `ScanProgressPhase` values get ephemeral TTY progress?

**Choice:** Both remaining phases — **`git`** and **`complexity`**.  
`ScanProgressPhase` in `src/types/domain.ts` is already `"git" | "complexity"` (function-churn phase retired with M57).

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-970, HOTSPOT-978

---

## Decision: TTY vs non-TTY rendering (LOCKED)

**Question:** How do interactive vs piped runs differ?

**Choice:**

| Stream                                                          | Behavior                                                                                                                                                                                                                                            |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TTY** (`process.stderr.isTTY === true`, injectable for tests) | Write progress with `\r` + clear-to-EOL overwrite (e.g. `\x1b[2K\r` before/with the line). **No** spinners, bars, or ETA. Same human-readable text as today (git commit / complexity batch lines), without a trailing permanent newline while live. |
| **Non-TTY** (piped/CI)                                          | Keep current `\n`-terminated lines (permanent log).                                                                                                                                                                                                 |

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-970, HOTSPOT-971, HOTSPOT-979

---

## Decision: Clear triggers (LOCKED)

**Question:** When is the live line removed?

**Choice:** Clear the live progress line when:

1. **Scan completes / handlers tear down** — at least once before the command moves on (report / exit). Prefer clearing inside `flushWarnings()` always (even when warning flush is a no-op under `warnings=full`), since `executeScan` / `executeCompareAndRender` already call it.
2. **Before writing a warning / error / info line on stderr** — so detail lines are not overwritten by a lingering carriage-return line.
3. **When switching phases** — if a live line from `git` would linger into `complexity` (or the reverse), clear first so the previous phase line does not remain.

Clear is a no-op when no live line is open (non-TTY path never opens one).

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-972, HOTSPOT-973, HOTSPOT-974

---

## Decision: Flags unchanged (LOCKED)

**Question:** New flags or quiet/progress behavior change?

**Choice:** **No new flags.** `--quiet` and `--no-progress` continue to suppress progress entirely (unchanged M38). No config key. No JSON/schema change.

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-975

---

## Decision: M58 warnings compose (LOCKED)

**Question:** How does ephemeral progress interact with `--warnings`?

**Choice:**

| Mode                         | Compose rule                                                                                                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `warnings=summary` (default) | Warnings buffer during scan → **clear live progress at `flushWarnings()`** (and before report). Progress may run uninterrupted while warnings are buffered. |
| `warnings=full`              | **Clear live progress before each `logWarning`** so per-path / per-pair detail lines are not overwritten by `\r` updates.                                   |

Progress throttle intervals and message text stay as today.

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-976, HOTSPOT-977

---

## Decision: Verbose / other stderr (LOCKED for M59)

**Question:** Clear before `--verbose` git argv lines?

**Choice:** **YAGNI for M59.** Verbose argv is a separate handler (M51). Document as a known risk if verbose and progress interleave on TTY; do not expand scope to wrap every stderr writer. Clear triggers remain the locked set above (complete / warning·error·info via diagnostic handlers / phase switch).

**Status:** **Confirmed — planner locked** (out of scope stretch)

---

## Open items

_None._ All gray areas closed by user lock + planner confirmation above.
