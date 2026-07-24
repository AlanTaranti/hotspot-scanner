# Milestone 14 — Enriched Coupling Context

**Feature slug:** `enriched-coupling`  
**Captured:** 2026-07-23  
**Trigger:** ROADMAP M14 scope; locked during planning (agent decisions where user did not constrain)

---

## Decision: Enrichment timing

**Question:** When is `hasStaticDependency` computed?

**Choice:** **Post-score enrichment** — after `scoreCoupling()` returns ranked pairs, enrich each surviving pair before attaching to `ScanResult`. Do not change co-change aggregation or `couplingStrength` formulas.

**Rationale:**

- Temporal coupling remains the ranking signal; static edge is explanatory metadata
- Only ranked pairs (post `--min-cochange`) need AST/read work — cheaper than whole-repo import graph
- Keeps `coupling-scorer.ts` formula-pure (CONCERNS.md fragile area)

**Status:** **Confirmed**

**Applies to:** design § Components, HOTSPOT-145–147.

---

## Decision: Static dependency definition

**Question:** What counts as a static dependency between `fileA` and `fileB`?

**Choice:** `hasStaticDependency === true` when **either** file has a **resolvable** static reference to the other:

| Construct                                                          | Counted                          |
| ------------------------------------------------------------------ | -------------------------------- |
| `import … from './path'` / `import('./path')` (static string only) | Yes                              |
| `export … from './path'` / `export * from './path'`                | Yes                              |
| `require('./path')` with string literal                            | Yes                              |
| Dynamic `import(expr)` / `require(expr)` (non-literal)             | No                               |
| Bare package specifier (`lodash`, `@scope/pkg`)                    | No — not a pair edge             |
| Type-only `import type` / `export type … from`                     | Yes (still a static module edge) |

Resolution: resolve relative (and `./`/`../`) specifiers against the importing file’s directory to a repo-relative path; normalize to the same path form used in coupling (`fileA`/`fileB`). Extensionless and `.js`→`.ts` candidates: try common TS/JS extensions (`.ts`, `.tsx`, `.js`, `.jsx`, `/index.*`) when matching the peer path.

**Rationale:**

- Boolean answers “is there a static import link?” for refactor prioritization
- Package imports are irrelevant to pair enrichment
- YAGNI: no direction field, no import graph, no tsconfig `paths` aliases in M14

**Status:** **Confirmed**

**Applies to:** HOTSPOT-146, HOTSPOT-147.

---

## Decision: Module ownership

**Question:** Where does enrichment live?

**Choice:** New helper `src/scoring/enrich-coupling-static.ts` (or `static-dependency.ts`) called from `src/scan.ts` after coupling score. Uses `fs` + lightweight parse (regex or ts-morph **only if already loaded** — prefer string-literal extract without requiring a full Project per pair). **Do not** import ts-morph outside `src/complexity/` — if AST needed, put a thin reader under `src/complexity/` and call from enricher, OR use literal-string scan in scoring without ts-morph.

**Preferred for M14:** **literal-string / line-oriented import extractor** in `src/scoring/` (no new ts-morph dependency on scoring). Complexity module stays McCabe-only.

**Rationale:**

- INTEGRATIONS.md: ts-morph only in `src/complexity/`
- Coupling pairs are few; reading two source files per pair is acceptable
- Avoids worker/Project coupling to scoring

**Status:** **Confirmed**

**Applies to:** design, HOTSPOT-146.

---

## Decision: Output surfaces

**Question:** Which reporters show `hasStaticDependency`?

**Choice:**

| Surface          | Behavior                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| JSON             | Field on every `CouplingPair` object                                                             |
| Table / markdown | Column `StaticDep` (or `Has static`) — `yes`/`no`                                                |
| CSV coupling     | Column `hasStaticDependency` (`true`/`false`)                                                    |
| Compare          | Field travels with `entity` on coupling deltas; renderers show column where coupling rows appear |

**Rationale:** Additive schema under `version: "1.0"` (same pattern as M9/M11). M20 JSON Schema **must** include `hasStaticDependency` (boolean, required on coupling items once M14 ships; M20 plans for it).

**Status:** **Confirmed**

**Applies to:** HOTSPOT-148–150; M20 anticipation.

---

## Decision: Missing / unreadable sources

**Question:** What if a coupled path has no readable working-tree file?

**Choice:** Treat as **no static dependency** (`false`); do not fail the scan. Optional debug-level skip is out of scope — silent `false` is enough.

**Rationale:** Coupling is git-history based; deleted or binary paths remain valid temporal pairs without static edges.

**Status:** **Confirmed**

**Applies to:** HOTSPOT-147 edge cases.

---

## Related closed decisions

| Decision                      | Value         | Relevance                             |
| ----------------------------- | ------------- | ------------------------------------- |
| Coupling always file-level    | M11           | Enrichment is file-pair only          |
| `DEFAULT_MIN_COCHANGE = 3`    | M4/M5         | Enrich only pairs that pass threshold |
| JSON version `"1.0"` additive | M9/M11        | No version bump for new boolean       |
| Requirement ID start          | `HOTSPOT-145` | Continues after M18 (`HOTSPOT-144`)   |
