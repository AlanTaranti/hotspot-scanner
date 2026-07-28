# Milestone 76 — Trend Color UX Specification

**Feature slug:** `trend-color-ux`  
**Milestone:** M76  
**Priority:** Medium  
**Status:** Specs Planned  
**Depth:** Medium  
**IDs:** HOTSPOT-1600–1619 (1611–1619 reserved)  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [TESTING.md](../../codebase/TESTING.md)  
**Artifacts:** [context.md](./context.md) · [design.md](./design.md) · [tasks.md](./tasks.md)  
**Sisters:** output-interpretation-ux (M41 color gates), doctor-color-ux (M74), growth-pattern-trend-bridge (M75), complexity-trend (M72)

**Note:** M73–M75 / HOTSPOT-1500–1599 belong to other features. This feature is **M76**.

---

## Problem Statement

`hotspot-scanner trend` prints a dense monochrome table. The always-on `Pattern:` line (M75) is the semantic takeaway (`deteriorating` / `refactored` / `stable` / `inconclusive`), but operators must read the kind token carefully among sparklines and revision rows. Scan tables and doctor text already use TTY-aware ANSI (M41/M74); trend table should color only the Pattern kind with the same gates.

## Goals

- [ ] Color the growth-pattern **kind** token on trend **table** `Pattern:` line when stdout is a TTY
- [ ] Disable color for non-TTY, `--no-color`, non-empty `NO_COLOR`, `--output`, and non-table formats
- [ ] Keep visible line shape `Pattern: <kind> — <summary>` and JSON/CSV contracts unchanged
- [ ] No new runtime color dependency
- [ ] `pnpm build && pnpm test` green after Execute

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Color summary / headers / sparklines / row cells | YAGNI — kind token is enough |
| Per-row ncloc/indentMean delta coloring | YAGNI — noisy; separate feature if needed |
| `FORCE_COLOR` | M41/M74 YAGNI lock |
| Color in JSON or CSV output | Machine formats stay plain |
| New color libraries (chalk, etc.) | M41 — raw ANSI only |
| Changing `classifyGrowthPattern` or JSON `meta.growthPattern` | Unrelated; M75 contract stable |
| Scan / doctor color behavior changes | Sister M41/M74 only |
| Hoisting `--no-color` to program-global | YAGNI — trend subcommand flag only |
| Complexity-trend schema / version bump | Presentation only |

---

## User Stories

### P1: Colorized Pattern kind on TTY table ⭐ MVP

**User Story:** As an operator running `hotspot-scanner trend <file>` in a terminal, I want the Pattern kind colored so I can spot deteriorating / refactored / inconclusive at a glance.

**Why P1:** Core UX of this milestone.

**Acceptance Criteria:**

1. WHEN trend writes `--format table` (default) to a TTY stdout AND color is enabled THEN the `Pattern:` line SHALL wrap only the kind token (`deteriorating` / `refactored` / `inconclusive` / `stable`) in the locked ANSI colors (red / green / yellow / plain) with reset after the kind when colored
2. WHEN color is enabled THEN the label `Pattern:`, the em dash, the summary, sparklines, headers, and data rows SHALL remain uncolored
3. WHEN `stripAnsi` is applied to colored table output THEN the result SHALL equal the plain table (same as today’s uncolored format, including trailing newline)

**Independent Test:** Unit tests of `paintGrowthPattern` / `renderTrendTable` with `color: true|false`; assert ANSI presence and `stripAnsi` equality.

**Requirements:** HOTSPOT-1600, HOTSPOT-1601, HOTSPOT-1602

---

### P1: Color gates (TTY, `--no-color`, `NO_COLOR`, output, json/csv) ⭐ MVP

**User Story:** As an operator or CI job, I want trend color to respect the same disable rules as scan tables so piped/redirected and machine-readable output stays plain.

**Why P1:** Correctness and M41/M74 parity.

**Acceptance Criteria:**

1. WHEN stdout is not a TTY THEN trend table output SHALL be plain (no ANSI)
2. WHEN `--no-color` is passed to `trend` THEN table output SHALL be plain
3. WHEN `NO_COLOR` is set to a non-empty value THEN table output SHALL be plain
4. WHEN `--output` is set THEN table file body SHALL be plain
5. WHEN `--format json` or `--format csv` THEN output SHALL never contain ANSI pattern colors
6. WHEN color resolution runs THEN it SHALL NOT read config keys for color (CLI + env + TTY only)

**Independent Test:** Unit tests for `resolveTrendColor`; CLI tests injecting TTY / env / flags.

**Requirements:** HOTSPOT-1603, HOTSPOT-1604, HOTSPOT-1605, HOTSPOT-1606, HOTSPOT-1607, HOTSPOT-1608

---

### P1: Trend `--no-color` flag ⭐ MVP

**User Story:** As an operator, I want `hotspot-scanner trend <file> --no-color` so I can force plain text even on a TTY.

**Why P1:** M41/M74 parity; required for D3/D4.

**Acceptance Criteria:**

1. WHEN `trend --help` is shown THEN `--no-color` SHALL be listed for the trend command
2. WHEN `trend … --no-color` runs on a TTY THEN table output SHALL be plain `Pattern: <kind> — <summary>` (no ANSI)

**Independent Test:** Commander option registration + CLI run asserting no ANSI escapes.

**Requirements:** HOTSPOT-1609

---

### P2: Living docs

**User Story:** As a reader of README / ARCHITECTURE, I want trend table Pattern colors documented next to existing scan/doctor color notes.

**Why P2:** Adoption and agent context; not blocking MVP code.

**Acceptance Criteria:**

1. WHEN README documents trend THEN it SHALL note TTY Pattern-kind colors and disable via `--no-color` / `NO_COLOR` / non-TTY / `--output`
2. WHEN ARCHITECTURE / CONVENTIONS mention CLI color THEN trend table Pattern coloring SHALL be referenced (brief)

**Independent Test:** Doc review in task Done when checklist.

**Requirements:** HOTSPOT-1610, HOTSPOT-1611

---

## Edge Cases

- WHEN pattern kind is `stable` THEN the kind token SHALL remain uncolored even when color is enabled (palette lock)
- WHEN `NO_COLOR=""` (empty string) THEN treat as unset — color may enable on TTY table (same as M41/M74)
- WHEN tests assert existing Pattern line substrings THEN they SHALL still match colored output **or** use `stripAnsi` — prefer `stripAnsi` for stability
- WHEN truncation note / warnings go to stderr THEN they SHALL remain uncolored by this feature (out of scope)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-1600 | P1: Colorize Pattern kind token | Tasks | Pending |
| HOTSPOT-1601 | P1: Summary / rows / sparklines uncolored | Tasks | Pending |
| HOTSPOT-1602 | P1: `stripAnsi` equals plain table | Tasks | Pending |
| HOTSPOT-1603 | P1: Non-TTY → plain | Tasks | Pending |
| HOTSPOT-1604 | P1: `--no-color` → plain | Tasks | Pending |
| HOTSPOT-1605 | P1: Non-empty `NO_COLOR` → plain | Tasks | Pending |
| HOTSPOT-1606 | P1: `--output` → plain | Tasks | Pending |
| HOTSPOT-1607 | P1: JSON/CSV never colored | Tasks | Pending |
| HOTSPOT-1608 | P1: Color not a config key | Tasks | Pending |
| HOTSPOT-1609 | P1: Trend `--no-color` flag | Tasks | Pending |
| HOTSPOT-1610 | P2: README trend color note | Tasks | Pending |
| HOTSPOT-1611 | P2: ARCHITECTURE/CONVENTIONS note | Tasks | Pending |
| HOTSPOT-1612–1614 | — | — | Buffer |
| HOTSPOT-1615–1619 | — | — | Reserved |

---

## Success Criteria

- [ ] TTY trend table shows red/green/yellow/plain Pattern kinds per lock
- [ ] Non-TTY / `--no-color` / `NO_COLOR` / `--output` / JSON / CSV stay plain
- [ ] Table shape and complexity-trend JSON contract unchanged
- [ ] Gate green: `pnpm build && pnpm test`
