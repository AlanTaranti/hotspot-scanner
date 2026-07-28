# Milestone 76 — Trend Color UX Context

**Gathered:** 2026-07-27  
**Spec:** [`.specs/features/trend-color-ux/spec.md`](./spec.md)  
**Status:** Ready for design  
**Milestone:** ROADMAP M76 | **IDs:** HOTSPOT-1600–1619 | **Slug:** `trend-color-ux`

User-locked scope from the planning brief; gray areas decided firmly below (no open discussion items).

**Note:** M73–M75 / HOTSPOT-1500–1599 are already assigned. This feature is **M76**.

---

## Feature Boundary

**In scope:** ANSI coloring of the growth-pattern **kind** token on `hotspot-scanner trend` **table** `Pattern:` line (`deteriorating` / `refactored` / `stable` / `inconclusive`) when writing to an interactive stdout TTY, gated like M41/M74 (`--no-color`, `NO_COLOR`, non-TTY, `--output`, non-table format → plain).

**Out of scope:** Coloring summary text, sparklines, headers, or data-row cells; per-row delta coloring; `FORCE_COLOR`; JSON/CSV color; scan/doctor color changes; new runtime color libraries; changing `classifyGrowthPattern` heuristics or `meta.growthPattern` JSON shape; hoisting `--no-color` to program-global.

---

## Locked Decisions

### D1: Color target — Pattern kind only

**Choice:** Color only the growth-pattern kind token on the `Pattern:` line (e.g. `stable`, `deteriorating`). The label `Pattern:`, the em dash, and the summary after `—` stay uncolored. Sparklines, headers, and revision rows stay plain.

**Rationale:** Matches M74 “prefix only” sparsity; Pattern is the semantic takeaway from M75; YAGNI on dense table cell coloring.

**Status:** **Confirmed**

---

### D2: Palette

**Choice:** Raw ANSI (no chalk/picocolors/kleur), reusing [`src/report/color.ts`](../../../src/report/color.ts):

| Kind            | Color               |
| --------------- | ------------------- |
| `deteriorating` | Red (`\x1b[31m`)    |
| `refactored`    | Green (`\x1b[32m`)  |
| `inconclusive`  | Yellow (`\x1b[33m`) |
| `stable`        | Plain (uncolored)   |

Wrap with reset (`\x1b[0m`) after the kind token when colored.

**Status:** **Confirmed**

---

### D3: When color is enabled

**Choice:** Color **on** only when **all** of:

1. Trend output format is `table`
2. `process.stdout.isTTY === true` (injectable in tests)
3. `--no-color` is **not** set on the trend command
4. `NO_COLOR` env is unset or empty (non-empty disables — same as M41/M74)
5. `--output` is **not** set (file write stays plain — same as scan table)

Color **off** for `--format json` and `--format csv` always.

**No** `FORCE_COLOR` (YAGNI — same as M41 D6 / M74).

**Status:** **Confirmed**

---

### D4: `--no-color` on trend

**Choice:** Add `--no-color` to the **trend** subcommand (CLI-only). Scan and doctor keep their own `--no-color`; do not hoist to a global parent option in this milestone. Not a config key.

Help text may say “Disable ANSI colors in trend table output” (agent discretion on exact wording).

**Status:** **Confirmed**

---

### D5: Formatting ownership

**Choice:** Keep `renderTrendTable` in `src/report/trend-table.ts`; add optional `{ color?: boolean }`. Add `paintGrowthPattern(kind, enabled)` in `src/report/color.ts`. Bin resolves color via `resolveTrendColor` and passes it through `bin/trend-actions.ts`. JSON/CSV renderers never receive color.

**Status:** **Confirmed**

---

### D6: Pipeline / contract unchanged

**Choice:** No changes to `runComplexityTrend`, `classifyGrowthPattern`, complexity-trend JSON `version: "3.0"`, or schemas. Presentation + CLI gates only. Visible table shape stays `Pattern: <kind> — <summary>` (ANSI may wrap `<kind>` only).

**Status:** **Confirmed**

---

## Agent Discretion (non-blocking)

- Whether `paintGrowthPattern` accepts `GrowthPatternKind` from `#trend` or an inline string union — prefer inline union (or type-only import) to avoid unnecessary coupling; either is fine if no cycle
- Whether `resolveTrendColor` shares a private helper with `resolveTableColor` — prefer parallel export for clarity (same gates as table, including `outputPath`)
- Completion-script / help wording for `--no-color` — match scan/doctor style

---

## Related Closed Decisions

| Decision                            | Value                                                                     | Relevance                          |
| ----------------------------------- | ------------------------------------------------------------------------- | ---------------------------------- |
| M41 table color gates               | TTY + `--no-color` + `NO_COLOR` + no `--output`; no FORCE_COLOR; no chalk | Sister gates to reuse              |
| M74 doctor prefix color             | Status prefix only; subcommand `--no-color`                               | Sparsity + flag pattern            |
| M75 growth Pattern line             | `Pattern: ${kind} — ${summary}` always-on                                 | Color target exists                |
| Reporter pure / stripAnsi           | `src/report/color.ts`                                                     | Reuse `stripAnsi` for tests        |
| M74 out-of-scope “scan/trend color” | Explicitly deferred trend                                                 | This milestone delivers trend half |
