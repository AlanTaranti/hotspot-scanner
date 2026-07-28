# Milestone 78 — Assess Color UX Context

**Gathered:** 2026-07-27  
**Spec:** [`.specs/features/assess-color-ux/spec.md`](./spec.md)  
**Status:** Ready for design  
**Milestone:** ROADMAP M78 | **IDs:** HOTSPOT-1680–1699 | **Slug:** `assess-color-ux`

User-locked scope from the planning brief (assess table screenshot + bold/structure discussion); gray areas decided firmly below (no open discussion items).

**Note:** M76 owns HOTSPOT-1600–1619; M77 owns HOTSPOT-1620–1679. This feature is **M78** with **HOTSPOT-1680–1699**.

---

## Feature Boundary

**In scope:** TTY-aware ANSI emphasis on `hotspot-scanner assess` **table** output:

| Surface | Emphasis |
| ------- | -------- |
| Title `Hotspot assess` | Bold only |
| Section header `Deteriorating` | Bold only |
| Summary `Pattern counts:` kind tokens | Color via `paintGrowthPattern` (M76 palette) |
| Detail line Pattern kind | Color via `paintGrowthPattern` |
| Detail line `score=` numeric value | `paintScore` bands (M41 scan) |

Disable via assess `--no-color`, non-empty `NO_COLOR`, non-TTY, `--output`, or non-table format. Raw ANSI only (no chalk).

**Out of scope:** Coloring file paths, Pattern summaries, meta `since=` / Candidates / Skipped lines; stderr `warning:` prefixes; markdown/JSON color; `FORCE_COLOR`; new color libraries; changing assess schema / selection / deteriorating-only detail policy; hoisting `--no-color` global; `--fail-on-deteriorating` / SARIF.

---

## Locked Decisions

### D1: Emphasis targets — structure bold + semantic color

**Choice:** Bold for hierarchy (title + `Deteriorating` section). Color for semantics (summary pattern-count kinds, detail Pattern kind, detail score). Do **not** bold kind tokens that are already colored.

**Rationale:** Assess is a portfolio view — summary counts are glanceable before the detail list; M76 kind-only is too thin for this layout. Matches “paint the signal, not the sentence.”

**Status:** **Confirmed**

---

### D2: Palette

**Choice:** Reuse [`src/report/color.ts`](../../../src/report/color.ts):

| Token | Style |
| ----- | ----- |
| `deteriorating` | Red (`\x1b[31m`) |
| `refactored` | Green (`\x1b[32m`) |
| `inconclusive` | Yellow (`\x1b[33m`) |
| `stable` | Plain |
| Score ≥ 0.7 | Red (`paintScore`) |
| Score ≥ 0.4 | Yellow (`paintScore`) |
| Score &lt; 0.4 | Plain |
| Title / section header | Bold (`\x1b[1m` … `\x1b[0m`) via `paintBold` |

Wrap with reset after each painted token when enabled.

**Status:** **Confirmed**

---

### D3: When color/bold is enabled

**Choice:** Emphasis **on** only when **all** of:

1. Assess output format is `table`
2. `process.stdout.isTTY === true` (injectable in tests)
3. `--no-color` is **not** set on the assess command
4. `NO_COLOR` env is unset or empty (non-empty disables — same as M41/M74/M76)
5. `--output` is **not** set (file write stays plain)

Emphasis **off** for `--format json` and `--format markdown` always.

**No** `FORCE_COLOR` (YAGNI — same as M41/M74/M76).

**Status:** **Confirmed**

---

### D4: `--no-color` on assess

**Choice:** Add `--no-color` to the **assess** subcommand (CLI-only). Scan, doctor, and trend keep their own flags; do not hoist to a global parent option. Not a config key.

Help text: “Disable ANSI colors in assess table output” (agent discretion on exact wording).

**Status:** **Confirmed**

---

### D5: Formatting ownership + M76 reuse

**Choice:** Extend `renderAssessTable(result, { color?: boolean })` in `src/report/assess-table.ts`. Add `paintBold` in `color.ts`. Reuse `paintScore` and `paintGrowthPattern` (from M76; if still absent at Execute, implement `paintGrowthPattern` here as shared helper — M76 stays compatible). Bin resolves via `resolveAssessColor` and passes through `bin/assess-actions.ts`. JSON/markdown never receive color.

**Prefer Execute order:** M76 before M78 when practical.

**Status:** **Confirmed**

---

### D6: Pipeline / contract unchanged

**Choice:** No changes to `runAssess`, `AssessResult`, `schemas/hotspot-assess.json` `version: "1.0"`, candidate selection, or deteriorating-only detail policy. Presentation + CLI gates only. Strip-ANSI of colored table equals today’s plain table (including trailing newline).

**Status:** **Confirmed**

---

### D7: stderr warnings stay plain

**Choice:** Do **not** color `warning:` prefixes in this milestone (diagnostics surface; optional future sister).

**Status:** **Confirmed**

---

## Agent Discretion (non-blocking)

- Whether summary paints only the kind token (`deteriorating`) or `kind=N` as a unit — prefer kind token only (number stays plain) for stripAnsi clarity and M76 parity
- Whether `resolveAssessColor` shares a private helper with `resolveTableColor` / `resolveTrendColor` — prefer parallel export for clarity
- Completion-script listing for assess `--no-color` — match scan/doctor/trend style if completion already enumerates assess flags

---

## Related Closed Decisions

| Decision | Value | Relevance |
| -------- | ----- | --------- |
| M41 table color gates | TTY + `--no-color` + `NO_COLOR` + no `--output`; no FORCE_COLOR; no chalk | Sister gates |
| M74 doctor prefix color | Status prefix only; subcommand `--no-color` | Flag pattern |
| M76 trend Pattern kind color | `paintGrowthPattern` palette | Shared paint helper |
| M77 hotspot-assess | Plain table MVP; “No color in MVP” | This milestone adds presentation |
| Reporter pure / stripAnsi | `src/report/color.ts` | Reuse for tests |
