# Milestone 59 — Ephemeral TTY Scan Progress Specification

**Feature slug:** `tty-ephemeral-progress`  
**Milestone:** M59  
**Priority:** High  
**Status:** Specs Planned  
**Depth:** Large  
**IDs:** HOTSPOT-970–989 (981–989 reserved)  
**Artifacts:** [context.md](./context.md) · [design.md](./design.md) · [tasks.md](./tasks.md)

---

## Problem Statement

Every progress tick in `src/diagnostics/logger.ts` ends with `\n`, so complexity (and git) scans leave **~N permanent stderr lines** (`Processing complexity batch 1/21…`, etc.). On an interactive TTY that floods the terminal; operators want a **single live line** that updates in place and disappears when progress is done, while CI/piped runs keep newline logs for greppable permanence.

## Goals

- [ ] On TTY stderr, overwrite one live progress line for `git` and `complexity` phases (no bars/ETA/spinners)
- [ ] Clear the live line on teardown, before diagnostic stderr lines, and on phase switch
- [ ] Non-TTY keeps `\n` progress lines unchanged
- [ ] Compose with M58 `--warnings summary|full`; leave `--quiet` / `--no-progress` unchanged
- [ ] Document TTY vs non-TTY progress UX in README / ARCHITECTURE (and recipes if progress is mentioned)

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Percentage bars / ETA / spinner glyphs | Locked UX — overwrite text only |
| New CLI flags or config key | Presentation polish only; M38 pattern |
| JSON / schema / contract change | Presentation-only |
| Change throttle intervals | YAGNI — keep `PROGRESS_LOG_INTERVAL` / `COMPLEXITY_PROGRESS_LOG_INTERVAL` |
| Function-churn progress revival | M57 retired; phases are `git` \| `complexity` only |
| Wrap `--verbose` git argv for clear | YAGNI — known risk; see [context.md](./context.md) |

---

## User Stories

### P1: TTY live overwrite for git + complexity ⭐ MVP

**User Story:** As a CLI user on an interactive terminal, I want scan progress to update one line in place so stderr does not fill with batch ticks.

**Why P1:** Core product ask.

**Acceptance Criteria:**

1. WHEN stderr is a TTY and progress is not suppressed THEN each emitted progress update for phase `git` SHALL overwrite the previous live progress line (carriage-return / clear-to-EOL) rather than appending a new permanent line.
2. WHEN stderr is a TTY and progress is not suppressed THEN each emitted progress update for phase `complexity` SHALL likewise overwrite one live line.
3. WHEN a progress line is written on TTY THEN the human-readable text SHALL match today’s wording (git: `Processing git commit N...`; complexity: batch/files format from M42) — no bars, ETA, or spinner glyphs.
4. WHEN throttle rules skip an update (`maybeLogProgress` returns false) THEN no extra clear/write SHALL be required beyond existing throttle behavior.

**Independent Test:** Unit tests with injected `stderrIsTTY: true`; spy `stderr.write`; assert `\r` / clear-to-EOL (or equivalent overwrite) and absence of trailing permanent `\n` on the live payload (or clear+overwrite pattern per design).

**Requirements:** HOTSPOT-970, HOTSPOT-978

---

### P1: Non-TTY keeps newline logs ⭐ MVP

**User Story:** As a CI / pipe consumer, I want progress lines to remain permanent newline-delimited logs.

**Why P1:** Must not break scripted captures.

**Acceptance Criteria:**

1. WHEN stderr is not a TTY THEN progress SHALL continue to write `\n`-terminated lines as today.
2. WHEN stderr is not a TTY THEN clear-live operations SHALL be no-ops (no ANSI clear spam).

**Independent Test:** Inject `stderrIsTTY: false`; assert `\n` payloads identical to current golden strings.

**Requirements:** HOTSPOT-971

---

### P1: Clear when progress is no longer needed ⭐ MVP

**User Story:** As a CLI user, I want the live progress line gone before warnings and before the report so the terminal is clean.

**Why P1:** Defines teardown and interleaving safety.

**Acceptance Criteria:**

1. WHEN handlers tear down / `flushWarnings()` runs after a scan (or compare warning loop) THEN any open live progress line SHALL be cleared before summary warning flush / return.
2. WHEN a warning, error, or info diagnostic is about to be written to stderr via the CLI sink THEN any open live progress line SHALL be cleared first.
3. WHEN progress phase switches (e.g. `git` → `complexity`) while a live line is open THEN the previous phase line SHALL be cleared (or fully overwritten) so it does not linger as stale text.
4. WHEN no live line is open THEN clear SHALL be a no-op.

**Independent Test:** Sequence TTY progress → `flushWarnings` / `logWarning` / phase change; assert clear sequence then subsequent writes.

**Requirements:** HOTSPOT-972, HOTSPOT-973, HOTSPOT-974

---

### P1: Quiet / no-progress unchanged ⭐ MVP

**User Story:** As an operator, I want `--quiet` and `--no-progress` to keep suppressing progress entirely.

**Why P1:** Non-regression vs M38.

**Acceptance Criteria:**

1. WHEN `--quiet` or `--no-progress` is set THEN no progress writes SHALL occur (TTY or not).
2. WHEN those flags are set THEN no live-line clear ANSI SHALL be required for progress (nothing opened).

**Independent Test:** Existing handler tests + TTY injection still no progress writes.

**Requirements:** HOTSPOT-975

---

### P1: M58 warnings compose ⭐ MVP

**User Story:** As a CLI user, I want ephemeral progress to compose correctly with `--warnings summary|full`.

**Why P1:** Locked sister interaction.

**Acceptance Criteria:**

1. WHEN `warnings=summary` THEN live progress MAY continue during the scan while warnings buffer; WHEN `flushWarnings()` runs THEN the live line SHALL be cleared before (or as part of) emitting aggregated summary lines.
2. WHEN `warnings=full` THEN each `logWarning` path SHALL clear the live progress line before writing the detail line so `\r` updates cannot overwrite warning text.
3. WHEN JSON / `meta.warnings` are inspected THEN no contract change SHALL be required.

**Independent Test:** Handlers with TTY + summary flush; TTY + full interleaved warning; assert clear ordering.

**Requirements:** HOTSPOT-976, HOTSPOT-977

---

### P1: Testable TTY detection + docs ⭐ MVP

**User Story:** As a maintainer, I want injectable TTY detection and docs that describe the UX.

**Why P1:** Unit tests cannot rely on real TTYs; operators need accurate README.

**Acceptance Criteria:**

1. WHEN creating CLI diagnostic handlers THEN TTY detection SHALL be injectable (e.g. `stderrIsTTY?: boolean`) defaulting to `process.stderr.isTTY === true`.
2. WHEN reading README Advanced progress notes / ARCHITECTURE diagnostics THEN TTY live overwrite vs non-TTY newline permanence SHALL be documented; recipes updated only if they describe progress UX.
3. WHEN no new CLI flags are documented THEN docs SHALL not invent flags or config keys for this feature.

**Independent Test:** Unit inject true/false; doc review checklist.

**Requirements:** HOTSPOT-979, HOTSPOT-980

---

## Edge Cases

- WHEN progress is suppressed THEN clear/write paths SHALL not emit ANSI clear sequences for progress.
- WHEN `flushWarnings()` is called twice THEN the second clear SHALL be a no-op.
- WHEN complexity totals are omitted (partial counters) THEN TTY overwrite SHALL still use the same format helpers as today.
- WHEN terminal width is narrower than the progress string THEN clear-to-EOL (`\x1b[2K`) SHALL be preferred over pad-to-width so remnants do not linger (design risk).
- WHEN `--verbose` git argv lines interleave with TTY progress THEN behavior is best-effort / known risk — out of scope to wrap verbose writers in M59.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-970 | P1: TTY live overwrite | Tasks | Pending |
| HOTSPOT-971 | P1: Non-TTY newlines | Tasks | Pending |
| HOTSPOT-972 | P1: Clear on teardown | Tasks | Pending |
| HOTSPOT-973 | P1: Clear before diagnostics | Tasks | Pending |
| HOTSPOT-974 | P1: Clear on phase switch | Tasks | Pending |
| HOTSPOT-975 | P1: Quiet / no-progress | Tasks | Pending |
| HOTSPOT-976 | P1: M58 summary compose | Tasks | Pending |
| HOTSPOT-977 | P1: M58 full compose | Tasks | Pending |
| HOTSPOT-978 | P1: Message format unchanged | Tasks | Pending |
| HOTSPOT-979 | P1: Injectable isTTY | Tasks | Pending |
| HOTSPOT-980 | P1: Living docs | Tasks | Pending |
| HOTSPOT-981–989 | — | — | Reserved |

**Coverage:** 11 mapped requirements + reserved band; all P1 mapped to tasks.

---

## Success Criteria

- [ ] Interactive scan leaves at most one transient progress line (cleared after scan), not N permanent batch lines
- [ ] Piped/CI stderr progress remains greppable `\n` lines
- [ ] M58 summary/full + quiet/no-progress regressions green
- [ ] `pnpm build && pnpm test` passes
- [ ] README + ARCHITECTURE describe TTY vs non-TTY progress
