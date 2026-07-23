# Milestone 11 — Function Granularity Context

**Feature slug:** `function-granularity`  
**Captured:** 2026-07-22  
**Trigger:** ROADMAP M11 scope, M9/M10 deferred items, user decision during planning

---

## Decision: Function ranking metric

**Question:** In `--granularity function`, how should functions be ranked? Git churn is file-level only — there is no per-function churn signal.

**Choice:** **hotspotScore with inherited file churn** — rank by harmonic mean `2ch/(c+h)` where `c` is the function's McCabe complexity (normalized globally across all functions) and `h` is the parent file's `commitCount` (normalized globally across all functions, with each function inheriting its file's churn value).

**Rationale:**

- Consistent with M8 file-level hotspot scoring — same formula, same normalization strategy (`log1p` + min-max)
- Churn signal remains meaningful at function granularity via parent file context
- User confirmed this option during planning (2026-07-22)

**Status:** **Confirmed**

**Applies to:** T2 `scoreFunctionHotspots()`, HOTSPOT-94, HOTSPOT-95.

---

## Decision: File mode unchanged

**Question:** Should `--granularity file` (default) change any existing behavior?

**Choice:** **No** — file mode is identical to M9/M10. `hotspots` populated; `functions` empty; `meta.granularity` = `"file"`.

**Rationale:**

- Default path must not regress existing consumers
- Function mode is opt-in via explicit flag

**Status:** **Confirmed**

**Applies to:** T3 pipeline branch, HOTSPOT-95.

---

## Decision: Coupling always file-level

**Question:** Should temporal coupling change in function mode?

**Choice:** **No** — `coupling` array is always file-pair ranked; identical in both granularities.

**Rationale:**

- Co-change events are file-level in Git miner (M2)
- ROADMAP M11 scope is hotspot granularity only

**Status:** **Confirmed**

**Applies to:** All reporters, HOTSPOT-97–99.

---

## Decision: Function naming conventions

**Question:** How should functions be identified in output when names are ambiguous or missing?

**Choice:**

| Construct | `functionName` |
| --------- | -------------- |
| `function foo()` | `foo` |
| `class Foo { bar() {} }` | `bar` |
| `constructor() {}` | `constructor` |
| `const foo = () => {}` | `foo` (variable name) |
| Anonymous arrow / function expression | `<anonymous>:L{line}` (e.g. `<anonymous>:L42`) |

`line` = `getStartLineNumber()` of the function node.

**Rationale:**

- Stable, testable identifiers without requiring source-map resolution
- Variable name for assigned arrows matches developer mental model
- Line suffix disambiguates multiple anonymous functions in same file

**Status:** **Confirmed**

**Applies to:** T1 extraction, HOTSPOT-92, HOTSPOT-93.

---

## Decision: JSON schema shape

**Question:** How should function-mode results appear in JSON?

**Choice:** Additive schema under `version: "1.0"`:

- `meta.granularity`: `"file"` | `"function"`
- `functions`: `FunctionHotspotScore[]` — populated in function mode, empty in file mode
- `hotspots`: `HotspotScore[]` — populated in file mode, empty in function mode

**Rationale:**

- Explicit granularity avoids consumers guessing which array is active
- Empty inactive array keeps shape stable for parsers
- No version bump — additive fields only (same pattern as M9)

**Status:** **Confirmed**

**Applies to:** T3 types, T5 JSON renderer, HOTSPOT-95, HOTSPOT-98.

---

## Decision: `--top` applies to active array

**Question:** Does `--top N` slice hotspots, functions, or both?

**Choice:** Slice the **active** ranking array based on `meta.granularity` — `hotspots` in file mode, `functions` in function mode. Coupling always sliced independently (unchanged).

**Rationale:**

- Consistent with M5/M10 render-time slicing via `sliceScanResult`
- User expects `--top 10` to mean "top 10 results" regardless of granularity

**Status:** **Confirmed**

**Applies to:** T5 `sliceScanResult`, HOTSPOT-100.

---

## Decision: Tie-break for equal hotspotScore

**Question:** When two functions share the same `hotspotScore`, how to order them?

**Choice:** Sort `hotspotScore` descending, then `filePath` ascending, then `line` ascending.

**Rationale:**

- Deterministic output for tests and CI
- Mirrors file-mode tie-break on `filePath` (M4/M5)

**Status:** **Confirmed**

**Applies to:** T2 scorer, HOTSPOT-94.

---

## Related closed decisions (STATE.md / prior milestones)

| Decision | Value | Relevance to M11 |
| -------- | ----- | ---------------- |
| McCabe decision nodes | Project-owned (RT-005) | Reuse `complexityForFunction()` — no definition change |
| Hotspot combiner | Harmonic mean `2ch/(c+h)` | Same formula at function level |
| Normalization | `log1p` + min-max | Same strategy; universe = all functions |
| Churn signal | Raw `commitCount` | Inherited from parent file per function |
| Requirement ID start | `HOTSPOT-92` | Continues after M10 (`HOTSPOT-91`) |
