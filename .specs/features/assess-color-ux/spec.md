# Milestone 78 — Assess Color UX Specification

**Feature slug:** `assess-color-ux`  
**Milestone:** M78  
**Priority:** Medium  
**Status:** Specs Planned  
**Depth:** Medium  
**IDs:** HOTSPOT-1680–1699 (1695–1699 reserved)  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [TESTING.md](../../codebase/TESTING.md)  
**Artifacts:** [context.md](./context.md) · [design.md](./design.md) · [tasks.md](./tasks.md)  
**Sisters:** hotspot-assess (M77), trend-color-ux (M76), doctor-color-ux (M74), output-interpretation-ux (M41)

**Note:** M76 / HOTSPOT-1600–1619 and M77 / HOTSPOT-1620–1679 are assigned. This feature is **M78**.

---

## Problem Statement

`hotspot-scanner assess` prints a monochrome table: summary pattern counts, a `Deteriorating` section, and detail lines with score + Pattern kind. Operators must read every token carefully to spot deteriorating vs refactored vs inconclusive in the portfolio summary. Scan, doctor, and (planned) trend already use TTY-aware ANSI; assess should add sparse color plus bold structure with the same gates — without coloring paths, markdown, or JSON.

## Goals

- [ ] Bold title `Hotspot assess` and section header `Deteriorating` on assess **table** when color is enabled
- [ ] Color summary Pattern-count kinds and detail Pattern kinds via `paintGrowthPattern`; color detail scores via `paintScore`
- [ ] Disable emphasis for non-TTY, assess `--no-color`, non-empty `NO_COLOR`, `--output`, and non-table formats
- [ ] Keep strip-ANSI visible shape identical to today’s plain table; JSON/markdown unchanged
- [ ] No new runtime color dependency
- [ ] `pnpm build && pnpm test` green after Execute

## Out of Scope

| Feature                                           | Reason                              |
| ------------------------------------------------- | ----------------------------------- |
| Color file paths / Pattern summaries / meta lines | YAGNI — signal tokens only          |
| stderr `warning:` prefix color                    | Separate diagnostics surface        |
| `FORCE_COLOR`                                     | M41/M74/M76 YAGNI lock              |
| Color in JSON or markdown                         | Machine / doc formats stay plain    |
| New color libraries (chalk, etc.)                 | M41 — raw ANSI only                 |
| Changing `runAssess` / schema / selection         | Presentation only                   |
| Scan / doctor / trend color behavior changes      | Sister milestones only              |
| Hoisting `--no-color` to program-global           | YAGNI — assess subcommand flag only |
| `--fail-on-deteriorating` / SARIF                 | Deferred assess CI                  |

---

## User Stories

### P1: Bold structure + colored semantics on TTY table ⭐ MVP

**User Story:** As an operator running `hotspot-scanner assess` in a terminal, I want bold title/section headers and colored pattern kinds and scores so I can triage deteriorating candidates at a glance.

**Why P1:** Core UX of this milestone.

**Acceptance Criteria:**

1. WHEN assess writes `--format table` (default) to a TTY stdout AND color is enabled THEN the title line `Hotspot assess` and the section header `Deteriorating` SHALL be wrapped in bold ANSI with reset
2. WHEN color is enabled THEN each kind token in the `Pattern counts:` summary line (`deteriorating` / `refactored` / `stable` / `inconclusive`) SHALL use `paintGrowthPattern` colors (red / green / plain / yellow); count digits and surrounding punctuation SHALL remain uncolored
3. WHEN color is enabled THEN each deteriorating detail line SHALL color only the Pattern kind via `paintGrowthPattern` and only the numeric score via `paintScore`; file path, `score=`, `Pattern:`, em dash, and summary SHALL remain uncolored
4. WHEN `stable` appears as a kind token AND color is enabled THEN that kind SHALL remain uncolored (palette lock)
5. WHEN `stripAnsi` is applied to colored table output THEN the result SHALL equal the plain table (same as today’s uncolored format, including trailing newline)

**Independent Test:** Unit tests of `paintBold` / `paintGrowthPattern` / `renderAssessTable` with `color: true|false`; assert ANSI presence and `stripAnsi` equality.

**Requirements:** HOTSPOT-1680, HOTSPOT-1681, HOTSPOT-1682, HOTSPOT-1683, HOTSPOT-1684

---

### P1: Color gates (TTY, `--no-color`, `NO_COLOR`, output, json/markdown) ⭐ MVP

**User Story:** As an operator or CI job, I want assess emphasis to respect the same disable rules as scan/trend tables so piped/redirected and machine-readable output stays plain.

**Why P1:** Correctness and M41/M74/M76 parity.

**Acceptance Criteria:**

1. WHEN stdout is not a TTY THEN assess table output SHALL be plain (no ANSI)
2. WHEN `--no-color` is passed to `assess` THEN table output SHALL be plain
3. WHEN `NO_COLOR` is set to a non-empty value THEN table output SHALL be plain
4. WHEN `--output` is set THEN table file body SHALL be plain
5. WHEN `--format json` or `--format markdown` THEN output SHALL never contain ANSI emphasis
6. WHEN color resolution runs THEN it SHALL NOT read config keys for color (CLI + env + TTY only)

**Independent Test:** Unit tests for `resolveAssessColor`; CLI tests injecting TTY / env / flags.

**Requirements:** HOTSPOT-1685, HOTSPOT-1686, HOTSPOT-1687, HOTSPOT-1688, HOTSPOT-1689, HOTSPOT-1690

---

### P1: Assess `--no-color` flag ⭐ MVP

**User Story:** As an operator, I want `hotspot-scanner assess --no-color` so I can force plain text even on a TTY.

**Why P1:** Sister parity; required for D3/D4.

**Acceptance Criteria:**

1. WHEN `assess --help` is shown THEN `--no-color` SHALL be listed for the assess command
2. WHEN `assess … --no-color` runs on a TTY THEN table output SHALL be plain (no ANSI)

**Independent Test:** Commander option registration + CLI run asserting no ANSI escapes.

**Requirements:** HOTSPOT-1691

---

### P2: Living docs

**User Story:** As a reader of README / ARCHITECTURE, I want assess table colors/bold documented next to existing scan/doctor/trend color notes.

**Why P2:** Adoption and agent context; not blocking MVP code.

**Acceptance Criteria:**

1. WHEN README documents assess THEN it SHALL note TTY bold + Pattern/score colors and disable via `--no-color` / `NO_COLOR` / non-TTY / `--output`
2. WHEN ARCHITECTURE mentions CLI ANSI colors THEN assess table emphasis SHALL be referenced (brief)

**Independent Test:** Doc review in task Done when checklist.

**Requirements:** HOTSPOT-1692, HOTSPOT-1693

---

## Edge Cases

- WHEN pattern kind is `stable` THEN the kind token SHALL remain uncolored even when color is enabled
- WHEN `NO_COLOR=""` (empty string) THEN treat as unset — emphasis may enable on TTY table
- WHEN there are no deteriorating candidates THEN the plain message `No deteriorating candidates.` SHALL stay uncolored; section header `Deteriorating` still bold when color enabled
- WHEN tests assert existing assess table substrings THEN they SHALL use `stripAnsi` for stability when color may be on
- WHEN stderr warnings flush after the table THEN they SHALL remain uncolored by this feature

---

## Requirement Traceability

| Requirement ID    | Story                                   | Phase | Status   |
| ----------------- | --------------------------------------- | ----- | -------- |
| HOTSPOT-1680      | P1: Bold title + section header         | Tasks | Pending  |
| HOTSPOT-1681      | P1: Color summary Pattern-count kinds   | Tasks | Pending  |
| HOTSPOT-1682      | P1: Color detail Pattern kind           | Tasks | Pending  |
| HOTSPOT-1683      | P1: Color detail score via `paintScore` | Tasks | Pending  |
| HOTSPOT-1684      | P1: `stripAnsi` equals plain table      | Tasks | Pending  |
| HOTSPOT-1685      | P1: Non-TTY → plain                     | Tasks | Pending  |
| HOTSPOT-1686      | P1: `--no-color` → plain                | Tasks | Pending  |
| HOTSPOT-1687      | P1: Non-empty `NO_COLOR` → plain        | Tasks | Pending  |
| HOTSPOT-1688      | P1: `--output` → plain                  | Tasks | Pending  |
| HOTSPOT-1689      | P1: JSON/markdown never colored         | Tasks | Pending  |
| HOTSPOT-1690      | P1: Color not a config key              | Tasks | Pending  |
| HOTSPOT-1691      | P1: Assess `--no-color` flag            | Tasks | Pending  |
| HOTSPOT-1692      | P2: README assess color note            | Tasks | Pending  |
| HOTSPOT-1693      | P2: ARCHITECTURE color note             | Tasks | Pending  |
| HOTSPOT-1694      | —                                       | —     | Buffer   |
| HOTSPOT-1695–1699 | —                                       | —     | Reserved |

---

## Success Criteria

- [ ] TTY assess table shows bold title/section and red/green/yellow/plain kinds + score bands per lock
- [ ] Non-TTY / `--no-color` / `NO_COLOR` / `--output` / JSON / markdown stay plain
- [ ] Table strip-ANSI shape and assess JSON contract unchanged
- [ ] Gate green: `pnpm build && pnpm test`
