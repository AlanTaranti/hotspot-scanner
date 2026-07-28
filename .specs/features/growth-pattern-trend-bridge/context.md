# Milestone 75 — Growth Pattern + Trend Bridge Context

**Feature slug:** `growth-pattern-trend-bridge`  
**Milestone:** ROADMAP M75  
**Depth:** Large  
**Requirement IDs:** HOTSPOT-1540–1599 (unused IDs in band reserved)  
**Status:** Locked (planning) — all decisions **Confirmed**; do not re-open  
**Inspiration:** Adam Tornhill — Evaluate the Growth Patterns (deteriorating / refactored / stable) on indentation complexity trends  
**Sisters:** [complexity-trend](../complexity-trend/spec.md) (M72), [explain-and-scan-feedback](../explain-and-scan-feedback/spec.md) (M42), [remove-compare-baseline](../remove-compare-baseline/spec.md) (M71 — do **not** reopen compare)  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md)

**Note:** Planning chat referred to “M73”; ROADMAP already assigns M73=`top-only-rollups` and M74=`doctor-color-ux`. This feature is **M75**.

---

## Intent

Close the DX loop after M72:

1. **Classify** the existing `trend` series into Tornhill growth patterns (always-on) so maintainers do not have to interpret sparklines alone.
2. **Bridge** `scan --explain <path>` → `hotspot-scanner trend <path>` with a stable stderr next-step on explain hits, plus recipes/docs for the three curves.

```text
scan → which files are hotspots now?
explain → why this score?
trend → how is this file evolving? + Pattern: deteriorating|refactored|stable|inconclusive
```

---

## Decision: Milestone / slug / depth / IDs (LOCKED)

| Field     | Value                                                              |
| --------- | ------------------------------------------------------------------ |
| Milestone | **M75**                                                            |
| Slug      | `growth-pattern-trend-bridge`                                      |
| Depth     | **Large**                                                          |
| IDs       | **HOTSPOT-1540–1599** (next free band after M74 HOTSPOT-1520–1539) |

**Status:** **Confirmed** — do not re-open

---

## Decision: One milestone, always-on classify (LOCKED)

| Field             | Value                                                                    |
| ----------------- | ------------------------------------------------------------------------ |
| Organization      | **Single** milestone covering classify + explain→trend bridge + docs     |
| Classify surface  | **Always-on** in table + JSON `meta.growthPattern`                       |
| `--classify` flag | **Out of scope** (supersedes M72 YAGNI deferral that anticipated a flag) |

**Status:** **Confirmed** — do not re-open (user locks 1A / 2A)

---

## Decision: Growth pattern labels + evidence (LOCKED)

| Field                | Value                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------- |
| Labels               | `deteriorating` \| `refactored` \| `stable` \| `inconclusive`                          |
| Primary shape metric | `indentMean` (chronological ascending `points`)                                        |
| Size context         | `ncloc` (relative growth compared when classifying deteriorating)                      |
| Evidence (required)  | `kind`, `summary` (one human line), numeric deltas; optional `peakRev` when refactored |
| Table UX             | Line `Pattern: <kind> — <summary>` **above** sparklines; raw series unchanged          |
| JSON                 | `meta.growthPattern` **required**; contract bump `complexity-trend` **`2.0` → `3.0`**  |
| CSV                  | **No** pattern column / header — table + JSON only (plot-ready rows stay metric-only)  |
| Scan JSON            | Untouched (`3.0`)                                                                      |

**Status:** **Confirmed** — do not re-open

---

## Decision: Classification heuristics (LOCKED)

Constants are product defaults; implement as named exports for tests.

| Rule                              | Constant / behavior                                                                                                                                                                                                   |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Min points for non-`inconclusive` | `MIN_POINTS = 5` (empty or `< 5` → `inconclusive`, reason in `summary`)                                                                                                                                               |
| Stable                            | Relative range of `indentMean` ≤ `STABLE_REL_RANGE = 0.08` (8%) of `max(maxMean, STABLE_FLOOR)` where `STABLE_FLOOR = 0.01` to avoid div-by-zero                                                                      |
| Refactored                        | Peak of `indentMean` **not** at last index; drop from peak to end ≥ `REFACTOR_DROP = 0.18` (18% of peak, using `max(peak, STABLE_FLOOR)` as denominator)                                                              |
| Deteriorating                     | First→last relative rise in `indentMean` ≥ `DETERIORATE_RISE = 0.10` (10%); prefer when Δmean/mean0 **>** Δncloc/ncloc0 (size-relative), but still classify deteriorating on strong mean rise even if size also grows |
| Priority                          | If both refactored and deteriorating signals fire, **refactored wins** when peak-then-drop criteria met; else deteriorating; else stable; else inconclusive                                                           |
| Mixed / weak                      | Anything not matching above → `inconclusive`                                                                                                                                                                          |
| Truncation                        | Classify the **sampled** series; `summary` MAY note truncated history when `meta.truncated` (orchestrator may append)                                                                                                 |

**Status:** **Confirmed** — do not re-open

---

## Decision: Explain → trend bridge (LOCKED)

| Field   | Value                                                                                        |
| ------- | -------------------------------------------------------------------------------------------- |
| When    | After `--explain` **hit** only (hotspot found)                                               |
| Where   | stderr, after the explain block                                                              |
| Format  | Stable line: `next: hotspot-scanner trend <repo-relative-posix-path>`                        |
| Path    | Matched hotspot `filePath` (repo-relative), not raw CLI argv with `./` noise when normalized |
| Miss    | **No** trend hint (avoid noise)                                                              |
| Formats | Does not alter stdout / JSON / CSV / `--output`; exit codes unchanged                        |
| Quiet   | When `--quiet`, suppress explain block **and** next-step (same channel as explain)           |

**Status:** **Confirmed** — do not re-open

---

## Decision: Docs (LOCKED)

| Item         | Value                                                                          |
| ------------ | ------------------------------------------------------------------------------ |
| Recipes      | Add cookbook: `scan` → `--explain` → `trend` + short Tornhill curve glossary   |
| README       | Brief discovery link / one-liner for Pattern + next-step                       |
| Living docs  | ARCHITECTURE, CONCERNS (formatter cliffs), STRUCTURE, skills mention as needed |
| Fail-on / CI | **Out of scope**                                                               |

**Status:** **Confirmed** — do not re-open

---

## Out of scope (LOCKED)

| Item                                      | Reason                                    |
| ----------------------------------------- | ----------------------------------------- |
| `--classify`                              | Always-on (2A)                            |
| `--fail-on-deteriorating` / SARIF         | False positives; deferred with CI horizon |
| `scan --trend-top` / batch from scan JSON | Cost / YAGNI                              |
| Repo-wide historical trend inside `scan`  | M72 lock stands                           |
| Compare / baseline                        | M71 stands                                |
| McCabe / historical AST / chart libraries | Deferred / YAGNI                          |
| Config keys for trend                     | CLI-only lock from M72                    |
| Changing `hotspotScore` / NCLOC rules     | Orthogonal                                |
| CSV pattern column                        | Table + JSON only                         |

**Status:** **Confirmed** — do not re-open

---

## Supersedes (documentation only)

| Prior lock                                    | Change                                          |
| --------------------------------------------- | ----------------------------------------------- |
| M72 out-of-scope `--classify` YAGNI           | Delivered as always-on classify (no flag)       |
| M72 deferred `--explain` auto-hint to `trend` | Delivered as stderr `next:` line on explain hit |

Historical M72 Done specs remain historical; do not rewrite acceptance of M72.
