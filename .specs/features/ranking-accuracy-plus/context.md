# Milestone 50 — Ranking Accuracy Plus Context

**Feature slug:** `ranking-accuracy-plus`  
**Captured:** 2026-07-24  
**Trigger:** ROADMAP M50; user-locked scope during planning (do **not** reopen without new milestone)  
**Depth:** Large  
**IDs:** HOTSPOT-730–769

---

## Feature Boundary

Improve ranking **trust and coverage** across five locked bullets: stronger unlinked-rename linking (RT-003), rename-aware static enrich via `PathAliasMap`, `PARSE_FAILED` files in file hotspot ranking (flagged, score 0), function AST callbacks/IIFEs (McCabe unchanged — RT-005), and function-mode inclusion of zero-churn-file functions (intentional revisit of M35 D6).

**Out of scope (locked):** historical AST; `node_modules` resolve; M46 path-scope tests; changing the harmonic hotspot formula; new warning `code` values beyond the M28 catalog.

---

## Decision: Stronger unlinked-rename linking (RT-003)

**Question:** M26 only *warns* on same-commit delete+add pairs with matching basename. Should M50 also *link* them into `PathAliasMap`?

**Choice:** **Yes — heuristic link + keep avisos.**

| Rule | Behavior |
| ---- | -------- |
| When | Same commit; delete-only + add-only paths; neither already has `renameFrom` / `=>` metadata |
| Relatedness (strengthened) | (1) identical basename **or** (2) identical basename **stem** (strip final extension) with related extensions in `{.ts,.tsx,.js,.jsx,.mjs,.cjs}` **or** (3) identical basename and shared parent-directory leaf (posix) — exact algorithm in design; keep cheap O(paths²) per commit |
| Action | Call `PathAliasMap.link(from, to)` so `canonicalize*` unifies churn/coupling under the new path |
| Warnings | Still emit `RENAME_HISTORY_INCOMPLETE` families (`Suspected unlinked rename…` / caps) — **stable `code`**; message may note that a heuristic link was applied |
| Cap | Keep max 5 detail pairs + summary (M26) |
| Forbidden | `--follow`; historical AST; cross-commit guess linking; new warning codes |

**Status:** **Confirmed** (user locked + planner)

**Applies to:** HOTSPOT-730–737

---

## Decision: PathAliasMap in static enrich

**Question:** M27 explicitly forbade PathAliasMap in scoring. Reopen?

**Choice:** **Yes — intentional reopen for M50.** Pass the miner’s `PathAliasMap` (or a thin `canonicalizePath(path) => string` derived from it) into `enrichCouplingStaticDeps` so peer collection and edge resolution compare **canonical** paths. Ranking (`couplingStrength`, order, `--min-cochange`) unchanged — metadata-only accuracy for `hasStaticDependency*` when git already linked renames (including M50 heuristic links).

| Still out of scope | Reason |
| ------------------ | ------ |
| Inventing alias graph without git/miner links | YAGNI |
| `node_modules` resolve | Out of scope |
| Changing enrich timing / formulas | M14/M27 lock |

**Status:** **Confirmed**

**Applies to:** HOTSPOT-738–745

---

## Decision: PARSE_FAILED files in hotspot ranking

**Question:** How do parse failures appear in file hotspots without distorting successful-file ranks or changing the harmonic formula?

**Choice:**

1. Complexity stage emits a **stub** `ComplexityResult` for each `PARSE_FAILED` path: `cyclomaticComplexity: 0`, `functionCount: 0` (plus existing `PARSE_FAILED` warning — code unchanged).
2. `HotspotScore` gains required additive boolean **`parseFailed`** (`true` for stubs, `false` otherwise). JSON `version` stays `"1.0"`; schema `required` includes `parseFailed`; `loadBaseline` rejects missing field (re-scan hint).
3. **Score:** `hotspotScore === 0`, `complexityNormalized === 0` for parse-failed rows. Churn fields still come from `fileStats` when present.
4. **Normalization universe:** compute `normalizeLogMinMax` **only over non-parse-failed** entries; append parse-failed rows afterward with zeros for complexity/hotspot norms (churnNormalized may still reflect churn for explainability, or be 0 — **lock: churnNormalized from fileStats via separate pass only among successful rows; parse-failed rows use `churnNormalized: 0` and `hotspotScore: 0`** so they never pull the min-max). Harmonic formula code path unchanged for successful rows.
5. **Surfaces:** JSON field; table/markdown show a compact flag (e.g. `ParseFail` yes/no or `!`); CSV column `parseFailed`.
6. **Function mode:** no function rows for parse-failed files (no AST). File-mode `hotspots` is the surface for this bullet.

**Status:** **Confirmed**

**Applies to:** HOTSPOT-746–753

---

## Decision: Function AST — callbacks / IIFEs (reopen M29 omit)

**Question:** M29 context listed IIFEs / call-argument callbacks as out of scope. Reopen?

**Choice:** **Yes — collect both; McCabe decision nodes unchanged (RT-005).**

| Construct | Collect? | `functionName` |
| --------- | -------- | -------------- |
| Call arg `ArrowFunction` / `FunctionExpression` | yes | Prefer existing parent naming if any; else `<anonymous>:L{line}` |
| IIFE `(function () { … })()` / `(() => { … })()` | yes | `<anonymous>:L{line}` (expression start line) |
| Nested bodies | yes | Existing `collectFunctionsInScope` recursion |

**Do not** edit `mccabe.ts` decision-node kinds. File-level sum increases where these constructs exist — update fixtures deliberately.

**Status:** **Confirmed** (intentional reopen of M29 omit)

**Applies to:** HOTSPOT-754–760

---

## Decision: Function-mode zero-churn-file functions (revisit M35 D6)

**Question:** M35 D6 omitted zero-churn eligible files from AST/`functions`. Include them?

**Choice:** **Yes — intentional semantic reopen.**

| Stage | Behavior after M50 |
| ----- | ------------------ |
| Function-mode AST | **Full in-scope discovery** again — do **not** pass `pathAllowlist` (or pass none); same discovery as file mode for eligible sources |
| Patch pathspecs | **Keep M35** — restrict to scoped numstat churn ∩ eligible extensions (I/O efficiency preserved) |
| Zero-churn functions | Appear in `ScanResult.functions` with `commitCount: 0`, `linesChanged: 0`, `authorCount: 0`, typically `hotspotScore: 0` |
| Normalization | Universe **includes** these rows — may dilute churn/complexity norms vs M35; document as intentional ranking impact |
| Tests | Invert/replace HOTSPOT-387/398 “absent from functions” assertions; keep file-mode zero-patch and typical churned-order parity |

**Status:** **Confirmed** (user locked revisit of M35 D6)

**Applies to:** HOTSPOT-761–765

---

## Decision: Harmonic formula + JSON version

**Choice:** Do **not** change `hotspotScore = 2ch/(c+h)` (or zero-guard). Do **not** bump `ScanResult.version` beyond `"1.0"` (additive `parseFailed` only).

**Status:** **Confirmed**

---

## Related closed / reopened decisions

| Decision | Prior | M50 |
| -------- | ----- | --- |
| Unlinked rename = warn only | M26 | **Reopen** → warn + heuristic `link()` |
| No PathAliasMap in enrich | M27 | **Reopen** → pass alias map |
| PARSE_FAILED = skip from ranking | complexity default | **Change** → stub row + flag |
| IIFE / call callbacks out of scope | M29 | **Reopen** → collect |
| Zero-churn omitted from function AST | M35 D6 | **Reopen** → include |
| No historical AST | M26/M35 | **Still locked** |
| Warning code catalog | M28/M42 | **Stable codes**; message copy may refine |

---

## Requirement ID band

Use **only** `HOTSPOT-730` … `HOTSPOT-769`.
