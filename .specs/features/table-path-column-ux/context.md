# Milestone 60 — Table Path Column UX Context

**Feature slug:** `table-path-column-ux`  
**Captured:** 2026-07-26  
**Trigger:** ROADMAP M60 + planner lock (parent session)  
**Depth:** Medium (shared pad/ellipsis helper + scan/compare table wiring + docs)  
**IDs:** HOTSPOT-990–1009 (1001–1009 reserved)

---

## Feature Boundary

Default **table** output hard-codes the File column to **24** characters and left-truncates with `slice(0, width)`, which drops the basename on deep paths. Operators reading a TTY want a **wider File column when the terminal allows**, and **middle-ellipsis** so both a path prefix and the basename remain visible (e.g. `src/api/v1/…/schema.ts`). Compare table must stay consistent. Markdown / JSON / CSV already emit full paths — unchanged.

**In scope:** `src/report/table.ts`, `src/report/compare-table.ts`, one shared helper module under `src/report/`, unit tests, living docs if table layout is mentioned.

**Out of scope:** markdown / JSON / CSV path rendering; new CLI flags; config keys; JSON schema bumps; `--full-paths`; end-ellipsis / basename-only truncation styles; triage / explain / glossary copy changes.

**Sisters:** rich-output (M9), export-formats (M10), output-interpretation-ux (M41), compare-interpretation (M53), tty-ephemeral-progress (M59 — injectable TTY pattern).

---

## Decision: Truncation style (LOCKED)

**Question:** How are long paths shortened in the File column?

**Choice:** **Middle-ellipsis** — keep a path **prefix** and the **basename** when fitting into the File width (e.g. `src/api/v1/…/schema.ts`). **Not** end-ellipsis and **not** basename-only.

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-990, HOTSPOT-994, HOTSPOT-997

---

## Decision: Ellipsis character (LOCKED)

**Question:** Unicode `…` (U+2026) vs ASCII `...`?

**Choice:** **Unicode `…`** (single code point). Brownfield has no File-column ASCII `...` convention; M59 progress copy already uses `…` in operator-facing text. Count as **one** display column for width math (BMP; no combining marks).

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-998

---

## Decision: File column width source (LOCKED)

**Question:** How is File column width chosen?

**Choice:**

| Input                                        | Behavior                                                |
| -------------------------------------------- | ------------------------------------------------------- |
| `options.stdoutColumns` (injectable)         | Prefer this over `process.stdout.columns` for tests     |
| `process.stdout.columns`                     | Default when injectable omitted                         |
| Missing / non-finite / ≤ 0 (pipes, CI, dumb) | **Fallback File width = 24** (current hard-coded width) |

Derive File width from terminal columns with **min / max** clamps and a **cap** so the scan hotspot row (Rank + File + numeric columns + separators) still fits on **~80-col** terminals when possible. Compare tables **reuse the same File width** for parity (rank-changed header may still exceed 80 — accepted; do not invent a second width).

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-991, HOTSPOT-992, HOTSPOT-993, HOTSPOT-995

---

## Decision: No new flags / config / schema (LOCKED)

**Question:** Opt-in `--full-paths` or config key?

**Choice:** **None.** Presentation-only improvement of default table/compare-table. Full paths remain in markdown / JSON / CSV.

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-999

---

## Decision: Shared helper (LOCKED)

**Question:** Duplicate ellipsis/width in `table.ts` and `compare-table.ts`?

**Choice:** **One shared module** under `src/report/` (suggested name `path-column.ts` — Agent's Discretion on exact filename) exporting width resolution + middle-ellipsis (+ optional pad-to-width File cell helper). Both renderers call it so widths and ellipsis stay consistent.

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-995, HOTSPOT-994

---

## Agent's Discretion (non-blocking)

| Topic                                                  | Guidance                                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Exact `MIN_FILE_WIDTH` / `MAX_FILE_WIDTH` constants    | Design locks recommended values; tweak only if tests prove awkward                    |
| Whether `formatFileCell` pads in the helper vs callers | Prefer helper returns display string of exact width (ellipsis + padEnd)               |
| STRUCTURE.md one-line listing of new file              | Update if STRUCTURE enumerates report modules                                         |
| Screenshot / README sample refresh                     | Only if samples assert a truncated deep path; short fixture paths need no PNG refresh |

---

## Non-goals reminder

Do **not** reopen M41 triage, M53 compare explain, M58 warnings, or M59 progress. Do **not** change scoring, PathScope, or JSON `version: "3.0"`.
