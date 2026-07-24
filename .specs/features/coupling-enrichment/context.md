# Milestone 27 — Coupling Enrichment Context

**Feature slug:** `coupling-enrichment`  
**Captured:** 2026-07-23  
**Trigger:** ROADMAP M27; extends M14 enriched coupling beyond relative-only resolution  
**Depth:** Large

---

## Decision: Additive JSON shape (locked)

**Question:** How do we expose direction, type-vs-runtime, and re-exports without breaking M14 consumers?

**Choice:** Keep `hasStaticDependency: boolean` (required, same meaning: any static module edge between the pair). Add four **required** additive fields on every `CouplingPair`:

```typescript
type StaticDependencyDirection = "none" | "a-to-b" | "b-to-a" | "both";

interface CouplingPair {
  fileA: string;
  fileB: string;
  coChangeCount: number;
  couplingStrength: number;
  /** True iff any static edge exists (runtime and/or type-only). Unchanged M14 meaning. */
  hasStaticDependency: boolean;
  /** Aggregate edge direction between fileA and fileB. */
  staticDependencyDirection: StaticDependencyDirection;
  /** At least one non-type-only static edge (value import / require / value re-export). */
  hasRuntimeStaticDependency: boolean;
  /** At least one `import type` / `export type … from` edge. */
  hasTypeOnlyStaticDependency: boolean;
  /** At least one `export … from` / `export * from` / `export type … from` re-export edge. */
  hasReExportStaticDependency: boolean;
}
```

**Invariants (must hold on every pair):**

1. `hasStaticDependency === (hasRuntimeStaticDependency || hasTypeOnlyStaticDependency)`
2. `hasReExportStaticDependency === true` ⇒ `hasStaticDependency === true` (re-exports are classified as runtime and/or type-only as well)
3. `staticDependencyDirection === "none"` ⇔ `hasStaticDependency === false` ⇔ all three kind flags are `false`
4. Direction uses **pair field names**, not lexicographic path order: `"a-to-b"` means `fileA` references `fileB`; `"b-to-a"` means `fileB` references `fileA`; `"both"` means mutual

**Rationale:** Flat fields serialize cleanly to CSV/table; baselines stay easy to validate; M14 boolean remains the primary triage bit.

**Status:** **Confirmed**

**Applies to:** HOTSPOT-231, HOTSPOT-232, HOTSPOT-234–236.

---

## Decision: Version / schema policy (locked)

**Question:** Bump `ScanResult.version` for new coupling fields?

**Choice:** Keep `version: "1.0"` (additive, same as M9/M11/M14). Update `schemas/scan-result.json` `$defs/CouplingPair`:

- Add properties for the four new fields
- Add them to `required`
- Keep `additionalProperties: true`
- Compare schema continues to `$ref` scan-result `CouplingPair`

**Baseline policy:** `loadBaseline()` / `parseScanResult()` **reject** coupling items missing any of the new required fields, with a path-specific message instructing the user to re-scan (same pattern as M14 `hasStaticDependency`). No auto-migration / defaulting.

**Status:** **Confirmed**

**Applies to:** HOTSPOT-238, HOTSPOT-239.

---

## Decision: tsconfig `paths` / aliases scope (locked)

**Question:** What alias resolution ships in M27?

**Choice:** Resolve TypeScript/JavaScript path aliases from the importer’s nearest config:

| Supported                         | Behavior                                                                 |
| --------------------------------- | ------------------------------------------------------------------------ |
| `compilerOptions.baseUrl`         | Resolve non-relative specifiers against baseUrl                          |
| `compilerOptions.paths`           | Map patterns (`@app/*` → `src/*`) with single `*` wildcard segment rules |
| `tsconfig.json` / `jsconfig.json` | Walk up from importer directory to `repoPath`; first found wins          |
| JSONC                             | Strip `//` and `/* */` comments before `JSON.parse` (no new runtime dep) |

| Explicitly out of scope (M27)                                      | Reason                                      |
| ------------------------------------------------------------------ | ------------------------------------------- |
| `package.json` `exports` / `imports`                               | Separate complexity; leave for a later gap  |
| Full TypeScript project-references graph / solution-style configs  | YAGNI                                       |
| `extends` deep-merge beyond one level of practical need            | Implement **shallow `extends` chain** only (merge `compilerOptions.paths`/`baseUrl` from extended configs until cycle or missing file); do not implement full TS config semantics |
| Bare npm package names without a matching `paths`/`baseUrl` hit    | Still not a pair edge (M14 rule unchanged)  |
| Dynamic `import(expr)` / non-literal `require`                     | Unchanged M14 exclusion                     |

**Fallback:** If no config found, parse fails, or alias does not resolve to an existing candidate → treat that specifier as unresolved (same as M14 miss → no edge). Scan continues.

**Status:** **Confirmed**

**Applies to:** HOTSPOT-233, HOTSPOT-237.

---

## Decision: Edge classification (locked)

**Question:** How are type-only vs runtime vs re-export detected without ts-morph in scoring?

**Choice:** Extend the literal-string extractor in `src/scoring/` (no ts-morph; INTEGRATIONS boundary). Classify each matched static string specifier:

| Construct                                                         | Runtime | Type-only | Re-export |
| ----------------------------------------------------------------- | ------- | --------- | --------- |
| `import … from '…'` / side-effect `import '…'` / `import('…')`    | yes     | no        | no        |
| `import type … from '…'` / `export type … from '…'`               | no      | yes       | re-export only for `export type … from` |
| `export { … } from '…'` / `export * from '…'`                     | yes     | no        | yes       |
| `require('…')` string literal                                     | yes     | no        | no        |

Mixed pairs (both runtime and type-only edges present in either direction) set **both** kind flags `true`.

**Status:** **Confirmed**

**Applies to:** HOTSPOT-235, HOTSPOT-236.

---

## Decision: Enrichment timing + ranking (locked)

**Question:** Where does richer analysis run?

**Choice:** Same post-score enrichment as M14 — `enrichCouplingStaticDeps()` after `scoreCoupling()`, before `ScanResult` assembly. **Do not** change `couplingStrength`, `coChangeCount`, pair ordering, or `--min-cochange` filtering.

**Status:** **Confirmed**

**Applies to:** HOTSPOT-241.

---

## Decision: M26 / PathAliasMap boundary (locked)

**Question:** Does M27 touch rename canonicalization or RT-003 warnings?

**Choice:** **No.** Do not import, extend, or duplicate `PathAliasMap` / rename-warning behavior from M26. Renamed-but-unlinked paths may still yield `hasStaticDependency: false` — document only; no new rename graph in scoring.

**Status:** **Confirmed**

**Applies to:** HOTSPOT-241 Out of Scope / boundary.

---

## Decision: Reporter surfaces (locked)

**Question:** How do humans see the richer signal?

**Choice:**

| Surface          | Behavior                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| JSON             | All five static fields on every coupling object                                                   |
| Table / markdown | Keep `StaticDep` (`yes`/`no`); add `Direction` (`none` / `a→b` / `b→a` / `both`); add `Kinds` (`—` / comma list from `{runtime,type,re-export}` present flags) |
| CSV coupling     | Columns: existing + `staticDependencyDirection`, `hasRuntimeStaticDependency`, `hasTypeOnlyStaticDependency`, `hasReExportStaticDependency` |
| Compare          | Same fields on coupling entities / columns                                                        |

**Status:** **Confirmed**

**Applies to:** HOTSPOT-240.

---

## Related closed decisions (upstream)

| Decision                         | Value                                      | Relevance                                      |
| -------------------------------- | ------------------------------------------ | ---------------------------------------------- |
| Post-score enrichment            | M14 context                                | Extend enricher; do not move into scorer       |
| Relative resolution + extensions | M14                                        | Keep; aliases are additional resolution path   |
| `import type` counted as edge    | M14 (`hasStaticDependency: true`)          | Still true; now also sets type-only flag       |
| No ts-morph in `src/scoring/`    | M14 / INTEGRATIONS.md                      | Retain                                        |
| JSON `"1.0"` additive            | M9/M11/M14/M20                             | No version bump                                |
| Requirement ID range             | `HOTSPOT-231`–`HOTSPOT-250` (use as needed)| This feature                                   |
