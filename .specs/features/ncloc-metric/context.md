# Milestone 57 — NCLOC Metric Context

**Feature slug:** `ncloc-metric`  
**Milestone:** ROADMAP M57  
**Depth:** Complex  
**Requirement IDs:** HOTSPOT-920+ (913–919 reserved from M56 — start at **920**)  
**Status:** Locked (planning) — all decisions **Confirmed**; do not re-open  
**Sisters / inverse:** [remove-coupling-analysis](../remove-coupling-analysis/spec.md) (M56 hard-cut exemplar), [complexity-analyzer](../complexity-analyzer/spec.md) (M3), [harmonic-hotspot-score](../harmonic-hotspot-score/spec.md) (M8), [rich-output](../rich-output/spec.md) (M9), [function-granularity](../function-granularity/spec.md) (M11), [per-function-churn](../per-function-churn/spec.md) (M23), [function-mode-scan-efficiency](../function-mode-scan-efficiency/spec.md) (M35), [explain-and-scan-feedback](../explain-and-scan-feedback/spec.md) (M42), [ranking-accuracy-plus](../ranking-accuracy-plus/spec.md) (M50), [json-contract](../json-contract/spec.md) (M20), [csv-bundle](../csv-bundle/spec.md) (M18)

---

## Intent

Replace cyclomatic complexity (McCabe) with **NCLOC** (non-commented lines of code) as the size/complexity axis `c` in `hotspotScore = 2ch/(c+h)`. Keep log1p + min-max normalization and the harmonic combiner unchanged.

Hard-cut remove **function mode** end-to-end (CLI/config, per-function churn miner, function ranking, schema types, CSV sidecars, compare function deltas, explain `path:function` grammar).

Bump JSON contract to **`"3.0"`** with field rename `cyclomaticComplexity` → `ncloc`. Reject baselines `2.0` / legacy `cyclomaticComplexity` with clear re-scan messaging (parity with M56).

Revisit **ADR-2026-019** (McCabe over LOC) — NCLOC is now the product metric.

---

## Decision: Milestone / slug / depth / IDs (LOCKED)

| Field | Value |
| ----- | ----- |
| Milestone | **M57** |
| Slug | `ncloc-metric` |
| Depth | **Complex** |
| IDs | **HOTSPOT-920+** (913–919 reserved from M56; do not reuse) |

**Status:** **Confirmed** — do not re-open

---

## Decision: Metric — NCLOC replaces McCabe as axis `c` (LOCKED)

**Question:** What is the size/complexity signal in the hotspot formula?

**Choice:**

- Replace McCabe / cyclomatic complexity with **NCLOC** as axis `c`
- Formula remains `hotspotScore = 2ch / (c + h)` with **log1p + min-max** normalization unchanged
- Harmonic combiner unchanged (M8)

**Status:** **Confirmed** — do not re-open

**Applies to:** Scoring, JSON field rename, reporters, fixtures, docs; HOTSPOT-920+.

---

## Decision: NCLOC definition (LOCKED)

**Definition:** Count **source lines that are neither blank nor comment-only**.

| Rule | Behavior |
| ---- | -------- |
| Blank lines | **Exclude** |
| Comment-only lines (`//…`, `/* … */`, JSDoc) | **Exclude** |
| Lines that contain code | **Include** (including lines whose code string literals contain `//`) |
| Scope | **File-level only** (no per-function NCLOC) |

**Status:** **Confirmed** — do not re-open

**Applies to:** Analyzer implementation + fixtures under `tests/fixtures/complexity/` (retarget to NCLOC).

---

## Decision: Function mode — remove entirely (LOCKED)

**Hard cut** — no deprecation window, no empty `functions: []`, no legacy `--granularity function`.

**Remove:**

| Surface | Items |
| ------- | ----- |
| CLI / config | `--granularity` / config `granularity`; `-g` alias |
| Ranking | Function ranking; `scoreFunctionHotspots` / `FunctionHotspotScorer` |
| Git | Per-function churn miner `src/git/function-churn/` |
| CSV | `{stem}.functions.csv`; compare `functions.*.csv` trio |
| Compare | Function delta sections (`new` / `removed` / `rankChanged` for functions) |
| `--only` | Value `functions` (see also `--only` decision below) |
| Explain | Grammar `path:function`; function-section lookup |
| Types / schemas | `FunctionHotspotScore`, `FunctionComplexityResult`, `FunctionChangeStats`, related `$defs` |
| Progress | Phase `function-churn` and progress tied only to function-churn |
| Options | `ScanGranularity`, `meta.granularity` on scan/compare |

**Status:** **Confirmed** — do not re-open

**Applies to:** HOTSPOT-920+ function-mode cut IDs.

---

## Decision: JSON contract → version `"3.0"` (LOCKED)

**Choice:**

- Bump `ScanResult.version` and `CompareResult.version` to **`"3.0"`**
- Rename file hotspot field **`cyclomaticComplexity` → `ncloc`**
- Remove function-mode arrays/fields (`functions`, function complexity fields, `functionCount` as McCabe-era count)
- Do **not** keep empty `functions: []`

**Status:** **Confirmed** — do not re-open

**Applies to:** Schemas, domain types, contract tests.

---

## Decision: Baseline rejection (LOCKED)

**Parity with M56:**

| Condition | Behavior |
| --------- | -------- |
| Baseline `version === "2.0"` (or `"1.0"`) | Reject via `BaselineError` + **re-scan** hint |
| Baseline has legacy field `cyclomaticComplexity` on hotspot items | Reject + re-scan hint (even if version spoofed to `"3.0"`) |
| Baseline has top-level `functions` | Reject + re-scan hint |
| Valid `"3.0"` with `ncloc`, no `functions` | Accept |

**Status:** **Confirmed** — do not re-open

**Applies to:** `src/compare/load-baseline.ts`, `parseScanResult`.

---

## Decision: ADR-2026-019 revisit (LOCKED)

**Choice:** Document supersession in STATE.md Decisions + ADR table:

- ADR-2026-019 originally chose **McCabe over LOC** via ts-morph
- M57 supersedes: product metric is **NCLOC**; McCabe decision nodes retired
- Update **rejected-alternatives** narrative: “LOC as complexity proxy” was rejected in favor of McCabe; **now NCLOC is the product metric** (file-level size axis), with McCabe / function mode removed

**Status:** **Confirmed** — do not re-open

---

## Decision: `--only` after function cut (LOCKED — agent discretion locked here)

**Choice:** Keep `--only` with allowed value **`hotspots` only**; reject `functions` (and any other value). Scripts that already pass `--only hotspots` keep working. Document that `functions` is invalid.

**Rationale:** Minimal script breakage vs deleting the flag entirely; YAGNI on multi-section filtering when only one section remains, but flag retention is cheap.

**Status:** **Confirmed** — do not re-open

---

## Decision: Analyzer implementation — lighter NCLOC scanner (LOCKED for Design)

**Question:** Keep ts-morph AST for scoring, or use a lighter scanner?

**Choice (design SoT):** **Lighter stateful line/token scanner** for file NCLOC — **not** ts-morph McCabe.

| Factor | Outcome |
| ------ | ------- |
| Scoring need | NCLOC is line-oriented; AST decision nodes unused |
| Function mode | Removed → no AST ranges for hunk overlap |
| Accuracy | State machine must respect `//`, `/* */` / JSDoc, and string/template literals so `//` inside strings still counts as code |
| Dependency | Prefer **remove `ts-morph` runtime dependency** when no other module needs it |
| Workers | Retarget or simplify: no Project reuse; optional bounded parallel file reads; may drop worker pool if sync/async main-thread is enough (YAGNI — keep concurrency hook if cheap) |
| Parse failures | Syntactic `PARSE_FAILED` stubs retired; unreadable I/O → warn + skip file (omit from hotspots) |

**Status:** **Confirmed** for planning (implementer follows design.md)

---

## What stays (LOCKED)

| Keep | Notes |
| ---- | ----- |
| Harmonic combiner `2ch/(c+h)` | Unchanged |
| log1p + min-max normalization | Unchanged; `c` fed from NCLOC |
| Git churn / `FileChangeStats` | Unchanged (numstat); PathAliasMap unchanged |
| File-mode scan pipeline | git ∥ size analysis → score → report |
| Compare for **hotspots** only | Function compare gone |
| Path scope / discovery / eligible extensions | Keep `.ts`/`.tsx`/`.js`/`.jsx`/`.mjs`/`.cjs` |
| `--concurrency` | Retain as parallel file-read/analysis knob unless Execute proves useless — do not invent new flags |

---

## Out of scope (LOCKED)

| Item | Reason |
| ---- | ------ |
| npm publish / npx | Deferred |
| CI recipes / SARIF | Deferred |
| Historical AST | Do-not-prioritize |
| Reintroducing temporal coupling | M56 hard cut stands |
| Alternative metrics beyond NCLOC (Halstead, cognitive, raw LOC, etc.) | YAGNI |
| Soft deprecation / dual McCabe+NCLOC | Hard cut |
| Per-function NCLOC | File-level only |
| Reopening historical Done function/McCabe specs | Stay historical; M57 supersedes product behavior |

---

## Related closed decisions (prior milestones — superseded product behavior)

| Decision | Prior value | M57 effect |
| -------- | ----------- | ---------- |
| ADR-2026-019 McCabe over LOC | STATE | Superseded — NCLOC is product metric |
| McCabe via ts-morph (M3+) | ComplexityAnalyzer | Replaced by NCLOC scanner; prefer drop ts-morph |
| Function granularity (M11) | `--granularity function` | Removed |
| Per-function hunk churn (M23) | `src/git/function-churn/` | Deleted |
| Function AST coverage (M22/M29/M50) | Collection extensions | Retired with function mode |
| JSON `version: "2.0"` + `cyclomaticComplexity` | M56 | → `"3.0"` + `ncloc` |
| `PARSE_FAILED` stub hotspots (M50) | Syntax stubs | Retired with AST; I/O warn-skip instead |
| Progress phase `function-churn` (M28) | Phased progress | Removed |
