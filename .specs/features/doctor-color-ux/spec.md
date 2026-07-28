# Milestone 74 — Doctor Color UX Specification

**Feature slug:** `doctor-color-ux`  
**Milestone:** M74  
**Priority:** Medium  
**Status:** Specs Planned  
**Depth:** Medium  
**IDs:** HOTSPOT-1520–1539 (1535–1539 reserved)  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [TESTING.md](../../codebase/TESTING.md)  
**Artifacts:** [context.md](./context.md) · [design.md](./design.md) · [tasks.md](./tasks.md)  
**Sisters:** output-interpretation-ux (M41 color gates), cli-init-doctor-dry-run (M39), scan-observability (M51 JSON), doctor-scope-parity (M52), config-doctor-dx (M64)

**Note:** M73 / HOTSPOT-1500–1519 belong to `top-only-rollups`. This feature is **M74**.

---

## Problem Statement

`hotspot-scanner doctor` prints plain `pass|warn|fail: message` lines with no ANSI. On an interactive TTY, operators must read every prefix to distinguish warnings and failures from passes — especially on large repos with many findings. Scan tables already use TTY-aware color (M41); doctor should follow the same gates for status prefixes only.

## Goals

- [ ] Color `pass:` / `warn:` / `fail:` prefixes on doctor **text** output when stdout is a TTY
- [ ] Disable color for non-TTY, `--no-color`, non-empty `NO_COLOR`, and `--format json`
- [ ] Keep line shape `status: message` and JSON envelope unchanged
- [ ] No new runtime color dependency
- [ ] `pnpm build && pnpm test` green after Execute

## Out of Scope

| Feature                                 | Reason                                  |
| --------------------------------------- | --------------------------------------- |
| Color message body / paths / numbers    | YAGNI — prefix scan is enough           |
| `FORCE_COLOR`                           | M41 YAGNI lock                          |
| Color in JSON output                    | Machine formats stay plain (M41 spirit) |
| New color libraries (chalk, etc.)       | M41 — raw ANSI only                     |
| Changing finding messages or exit codes | Unrelated                               |
| Scan / trend table color changes        | Sister M41 only                         |
| Doctor `--output` / file write path     | Doctor has no `--output`                |
| Hoisting `--no-color` to program-global | YAGNI — doctor subcommand flag only     |
| M73 top-only-rollups                    | Separate milestone                      |

---

## User Stories

### P1: Colorized status prefixes on TTY text ⭐ MVP

**User Story:** As an operator running `hotspot-scanner doctor` in a terminal, I want `pass:` / `warn:` / `fail:` colored green / yellow / red so I can spot problems at a glance.

**Why P1:** Core UX of this milestone.

**Acceptance Criteria:**

1. WHEN doctor writes `--format text` (default) to a TTY stdout AND color is enabled THEN each line SHALL wrap only the status prefix (`pass:` / `warn:` / `fail:`) in the locked ANSI colors (green / yellow / red) with reset after the prefix
2. WHEN color is enabled THEN the message body after the prefix SHALL remain uncolored
3. WHEN `stripAnsi` is applied to colored text output THEN the result SHALL equal the plain `status: message` lines (same as today’s uncolored format, including trailing newline)

**Independent Test:** Unit tests of `formatDoctorTextReport` / `paintDoctorStatus` with `color: true|false`; assert ANSI presence and `stripAnsi` equality.

**Requirements:** HOTSPOT-1520, HOTSPOT-1521, HOTSPOT-1522

---

### P1: Color gates (TTY, `--no-color`, `NO_COLOR`, JSON) ⭐ MVP

**User Story:** As an operator or CI job, I want doctor color to respect the same disable rules as scan tables so piped/redirected and machine-readable output stays plain.

**Why P1:** Correctness and M41 parity.

**Acceptance Criteria:**

1. WHEN stdout is not a TTY THEN doctor text output SHALL be plain (no ANSI)
2. WHEN `--no-color` is passed to `doctor` THEN text output SHALL be plain
3. WHEN `NO_COLOR` is set to a non-empty value THEN text output SHALL be plain
4. WHEN `--format json` THEN output SHALL never contain ANSI status colors (envelope unchanged)
5. WHEN color resolution runs THEN it SHALL NOT read config keys for color (CLI + env + TTY only)

**Independent Test:** Unit tests for `resolveDoctorColor`; CLI tests injecting TTY / env / flags.

**Requirements:** HOTSPOT-1523, HOTSPOT-1524, HOTSPOT-1525, HOTSPOT-1526, HOTSPOT-1527

---

### P1: Doctor `--no-color` flag ⭐ MVP

**User Story:** As an operator, I want `hotspot-scanner doctor --no-color` so I can force plain text even on a TTY.

**Why P1:** M41 parity; required for D3/D4.

**Acceptance Criteria:**

1. WHEN `doctor --help` is shown THEN `--no-color` SHALL be listed for the doctor command
2. WHEN `doctor --no-color` runs on a TTY THEN output SHALL be plain `status: message` lines

**Independent Test:** Commander option registration + CLI run asserting no ANSI escapes.

**Requirements:** HOTSPOT-1528

---

### P2: Living docs

**User Story:** As a reader of README / ARCHITECTURE, I want doctor color behavior documented next to existing table-color notes.

**Why P2:** Adoption and agent context; not blocking MVP code.

**Acceptance Criteria:**

1. WHEN README documents doctor THEN it SHALL note TTY text status colors and disable via `--no-color` / `NO_COLOR`
2. WHEN ARCHITECTURE / CONVENTIONS mention CLI color THEN doctor text coloring SHALL be referenced (brief)

**Independent Test:** Doc review in task Done when checklist.

**Requirements:** HOTSPOT-1529, HOTSPOT-1530

---

## Edge Cases

- WHEN findings list is empty THEN output SHALL remain a single trailing newline (or empty body + newline per current formatter) with no ANSI
- WHEN only `pass` findings exist THEN only green prefixes SHALL appear (when color on)
- WHEN `NO_COLOR=""` (empty string) THEN treat as unset — color may enable on TTY text (same as M41)
- WHEN tests assert existing `/pass:.*Node/` patterns THEN they SHALL still match colored output (ANSI may sit around `pass:`) **or** tests SHALL use `stripAnsi` — prefer updating assertions to stripAnsi for stability

---

## Requirement Traceability

| Requirement ID    | Story                                             | Phase | Status   |
| ----------------- | ------------------------------------------------- | ----- | -------- |
| HOTSPOT-1520      | P1: Colorize `pass:` / `warn:` / `fail:` prefixes | Tasks | Pending  |
| HOTSPOT-1521      | P1: Message body uncolored                        | Tasks | Pending  |
| HOTSPOT-1522      | P1: `stripAnsi` equals plain lines                | Tasks | Pending  |
| HOTSPOT-1523      | P1: Non-TTY → plain                               | Tasks | Pending  |
| HOTSPOT-1524      | P1: `--no-color` → plain                          | Tasks | Pending  |
| HOTSPOT-1525      | P1: Non-empty `NO_COLOR` → plain                  | Tasks | Pending  |
| HOTSPOT-1526      | P1: JSON never colored                            | Tasks | Pending  |
| HOTSPOT-1527      | P1: Color not a config key                        | Tasks | Pending  |
| HOTSPOT-1528      | P1: Doctor `--no-color` flag                      | Tasks | Pending  |
| HOTSPOT-1529      | P2: README doctor color note                      | Tasks | Pending  |
| HOTSPOT-1530      | P2: ARCHITECTURE/CONVENTIONS note                 | Tasks | Pending  |
| HOTSPOT-1531–1534 | —                                                 | —     | Buffer   |
| HOTSPOT-1535–1539 | —                                                 | —     | Reserved |

---

## Success Criteria

- [ ] TTY text doctor shows green/yellow/red status prefixes
- [ ] Non-TTY / `--no-color` / `NO_COLOR` / JSON stay plain
- [ ] Line shape and JSON contract unchanged
- [ ] Gate green: `pnpm build && pnpm test`
