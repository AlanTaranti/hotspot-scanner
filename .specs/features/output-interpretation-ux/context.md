# Milestone 41 — Output Interpretation UX Context

**Gathered:** 2026-07-24  
**Spec:** [`.specs/features/output-interpretation-ux/spec.md`](./spec.md)  
**Status:** Ready for design  
**Milestone:** ROADMAP M41 | **IDs:** HOTSPOT-510–539 | **Items:** 13, 14, 15, 16, 17, 19

User-locked scope from the planning brief; remaining gray areas decided firmly below (no open `PENDENTE-DISCUSSÃO`).

---

## Feature Boundary

**In scope:** Human interpretation UX for scan (and compare where noted) reports — table legend/glossary, markdown “How to read this”, executive summary, conservative triage hints, `--only` section filter, TTY-aware table colors.

**Out of scope:** `--explain` (M42), SARIF, fail-on thresholds, harmonic formula changes, colorizing markdown/JSON/CSV, ML/heuristics beyond the locked rule table, new runtime color libraries.

---

## Locked Decisions

### D1: Table legend / glossary placement

**Choice:** **Stdout footer after all tables** (same report string — not stderr).

**Rationale:** Keeps interpretation next to the data operators just read; stderr stays diagnostics (warnings/progress). When `--output` writes a table file, the legend is part of the file body (identical string).

**Applies to:** Scan and compare `--format table`.

**Status:** **Confirmed** (user lock)

---

### D2: Markdown “How to read this”

**Choice:** Dedicated section in `--format markdown` reports (scan + compare), after the executive summary / metadata and **before** ranking tables — title `## How to read this`.

**Rationale:** PR/docs readers need glossary up front; table users get the footer instead. Content shares the same glossary SoT as the table legend (wording may be slightly prose-oriented).

**Status:** **Confirmed** (user lock + placement locked here)

---

### D3: Executive summary

**Choice:** Short block at the **top** of **table** and **markdown** only (scan + compare).

**Scan fields (required):**

| Field | Source |
| ----- | ------ |
| Scan window | `meta.since` (+ `scannedAt` where already shown) |
| Granularity | `meta.granularity` |
| Rows shown vs total | Per active ranking (hotspots **or** functions) and coupling — when `--top` slices |
| Coupling pair count | Full (pre-slice) `coupling.length` |
| Pairs with `hasStaticDependency === false` | Count on **full** coupling array |

**Compare fields:** Delta-oriented counts (e.g. new / removed / rankChanged totals for active ranking + coupling) plus baseline/current `since` when present — no churn of scan-only static-dep false count unless cheap from current side; prefer: shown vs total on sliced delta arrays + section totals.

**Totals timing:** Compute from the **full** `ScanResult` / `CompareResult` **before** `sliceScanResult` / `sliceCompareResult`. Pass summary into renderers via `ReporterOptions` (do not bury totals only in sliced arrays).

**Not in JSON/CSV.**

**Status:** **Confirmed** (user lock + totals/compare detail locked here)

---

### D4: Conservative triage hints

**Choice:** Default **ON** for **scan** `table` and `markdown` only. Disable with `--no-triage-hints`. No ML. Must not change rankings, scores, or JSON/CSV numeric payloads.

**Rules (exactly 3 — deterministic):**

| ID | Condition | Hint text (stable) |
| -- | --------- | ------------------ |
| `dual-signal-hotspot` | Ranking row (file or function) with `hotspotScore ≥ 0.7` **and** `complexityNormalized ≥ 0.5` **and** `churnNormalized ≥ 0.5` | `High dual-signal hotspot — complexity and churn both elevated; prioritize review.` |
| `coupled-with-static` | Coupling row with `couplingStrength ≥ 0.5` **and** `hasStaticDependency === true` | `Strong temporal coupling with a static dependency — candidate boundary/split review.` |
| `coupled-without-static` | Coupling row with `couplingStrength ≥ 0.5` **and** `hasStaticDependency === false` | `Strong temporal coupling without a static edge — may be coincidence or unresolved import/alias; verify before refactoring.` |

**Presentation:** Section titled `Triage hints` (table) / `## Triage hints` (markdown), **after** ranking tables and **before** the table legend footer (markdown: after tables, before any trailing notes). List matching rows capped at **3 matches per rule** (highest score/strength first). If no matches: omit the section entirely (no “none” placeholder).

**Compare:** **No triage hints** in M41 (deltas are not absolute scores; avoid misleading advice). `--no-triage-hints` still accepted (no-op for compare).

**Thresholds:** Exported as named constants in `src/report/triage.ts` for tests.

**Status:** **Confirmed** (user lock + rules/thresholds/placement locked here)

---

### D5: `--only hotspots|coupling|functions`

**Choice:** Repeatable CLI flag. Valid values: `hotspots`, `coupling`, `functions`. Invalid value → `CliUsageError` (exit 2). CLI-only (not config file).

**Filter semantics:**

| Format | Excluded section behavior |
| ------ | ------------------------- |
| table / markdown | **Omit** section block entirely (no header, no empty placeholder) |
| json | **Omit** top-level key(s) for excluded sections |
| csv | **Omit** corresponding data file(s) from the bundle; always keep `meta.json` |

**Empty *included* section** (e.g. `--only hotspots` but zero hotspots): keep **existing** empty rendering — table `(none)`, markdown `_No results._`, JSON `[]` if key present, CSV header-only file if that section is included.

**JSON contract:** Unfiltered JSON remains schema-complete. Filtered JSON (`--only`) is an intentional triage export — **not** a valid baseline; help/docs must say so. Do not weaken `schemas/*.json` `required` arrays.

**Applies to:** Scan and compare (`render` + `renderCompare`).

**Granularity:** `--only functions` in file mode (empty functions) and `--only hotspots` in function mode are allowed — render only the requested section(s) with existing empty behavior.

**Deduping:** Repeated `--only hotspots --only hotspots` → treat as once. Multiple distinct values → union of sections.

**Status:** **Confirmed** (user lock + empty/omit/JSON baseline warning locked here)

---

### D6: TTY-aware table colors

**Choice:** Colorize **table format only** (scan + compare).

**Color off when any of:**

1. stdout is not a TTY (`process.stdout.isTTY !== true`)
2. `--no-color` is set
3. `NO_COLOR` is set in the environment (any value, non-empty — follow [no-color.org](https://no-color.org) spirit: presence disables)
4. `--output <path>` is used (file body must be plain text)

**No color** for markdown, JSON, CSV. Do **not** implement `FORCE_COLOR` in M41 (YAGNI).

**Implementation:** Minimal ANSI helpers in `src/report/` — **no new runtime dependency** (no chalk/picocolors).

**What gets color (minimal, deterministic):**

| Element | Behavior |
| ------- | -------- |
| `hotspotScore` / function Score / coupling Strength | Red ≥ 0.7, yellow ≥ 0.4, default otherwise |
| StaticDep `yes` | Dim green |
| StaticDep `no` | Dim yellow |

Headers/legend uncolored. Colors must not change column padding logic beyond wrapping cell text in ANSI (pad on visible width — tests assert strip-ANSI equality to plain table).

**Status:** **Confirmed** (user lock + bands/no-deps locked here)

---

### D7: Flags are CLI-only

**Choice:** `--only`, `--no-triage-hints`, `--no-color` are CLI-only (like `format` / `output`). Not keys in `.hotspot-scanner.json`.

**Status:** **Confirmed**

---

### D8: Pipeline / scoring unchanged

**Choice:** No changes to `runScan`, scorers, harmonic formula, JSON `version`, or schema required fields. Reporter + bin only (plus living docs).

**Status:** **Confirmed**

---

## Agent Discretion (non-blocking)

- Exact legend wording polish (must stay accurate to ARCHITECTURE metrics)
- Whether compare executive summary lists static-dep-false on current-side coupling only — prefer skip if awkward; counts of delta classes are enough
- ANSI dim vs bright for StaticDep — prefer dim

---

## Related Closed Decisions

| Decision | Value | Relevance |
| -------- | ----- | --------- |
| `--top` table/markdown only (M16) | Full arrays for JSON/CSV | Summary shown-vs-total only meaningful for table/markdown |
| Reporter pure / no fs (ARCHITECTURE) | Strings in / out | Color + legend stay in report string; TTY detection may be injected via options from bin |
| Exit 0 on successful scan | No fail-on | Triage hints advisory only |
| M42 `--explain` | Separate milestone | Do not add per-file explain here |
