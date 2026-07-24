# Milestone 27 — Coupling Enrichment Specification

**Feature slug:** `coupling-enrichment`  
**Milestone:** ROADMAP M27  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [CONCERNS.md](../../codebase/CONCERNS.md)  
**Sister:** [enriched-coupling (M14)](../enriched-coupling/spec.md), [json-contract (M20)](../json-contract/spec.md)  
**Context:** [`.specs/features/coupling-enrichment/context.md`](./context.md)  
**Depth:** Large  
**HOTSPOT ID range:** HOTSPOT-231 … HOTSPOT-250 (gaps OK)

## Problem Statement

M14’s `hasStaticDependency` only resolves **relative** import/export/require edges. In monorepos that use tsconfig `paths` (and `baseUrl`) aliases, many real static links are reported as `false`, so tech leads cannot trust the flag for refactor triage. They also lack **direction** (who depends on whom) and cannot tell **type-only** vs **runtime** edges or call out **re-exports** — all of which change how a coupled pair should be prioritized.

## Goals

- [ ] Resolve tsconfig/jsconfig `paths` + `baseUrl` when flagging static edges between coupling pairs
- [ ] Record dependency direction (`none` / `a-to-b` / `b-to-a` / `both`) on every pair
- [ ] Distinguish type-only vs runtime edges; flag re-exports explicitly
- [ ] Keep `hasStaticDependency` semantics and temporal ranking unchanged
- [ ] Update JSON Schema + baseline validation additively under `version: "1.0"`
- [ ] Surface new fields in JSON, table, markdown, and CSV (scan + compare)
- [ ] `pnpm build && pnpm test` passing after Execute

## Out of Scope

| Feature                                                      | Reason                                                                 |
| ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `package.json` `exports` / `imports` resolution              | Deferred; CONCERNS gap partially remains                               |
| Full TypeScript project-references / solution configs        | YAGNI                                                                  |
| Full import graph / cycles / fan-in metrics                  | Pair enrichment only                                                   |
| Changing ranking by static edge or `--min-cochange`          | Temporal ranking stays authoritative                                   |
| PathAliasMap / RT-003 rename warnings (M26)                  | Hard boundary — do not duplicate                                       |
| Dynamic `import(expr)` / non-literal `require`               | Unchanged M14 exclusion                                                |
| Per-function coupling                                        | Coupling remains file-level                                            |
| New CLI flags for enrichment                                 | Always on after score (YAGNI)                                          |
| Bumping `ScanResult.version` to `1.1`                        | Additive under `"1.0"` (context.md)                                    |

---

## User Stories

### P1: Additive domain fields on CouplingPair ⭐ MVP

**User Story**: As a library/CLI consumer, I want every `CouplingPair` to carry direction and kind flags alongside `hasStaticDependency` so that JSON and baselines expose the richer signal.

**Why P1**: Contract foundation for enricher, schema, and reporters.

**Acceptance Criteria**:

1. WHEN a `CouplingPair` is produced by the scan pipeline THEN it SHALL include `staticDependencyDirection`, `hasRuntimeStaticDependency`, `hasTypeOnlyStaticDependency`, and `hasReExportStaticDependency` per [context.md](./context.md)
2. WHEN TypeScript domain types are read THEN `CouplingPair` in `src/types/domain.ts` SHALL declare those fields
3. WHEN invariants from context.md are evaluated THEN they SHALL hold for every pair (including `hasStaticDependency === (hasRuntimeStaticDependency || hasTypeOnlyStaticDependency)`)
4. WHEN no static edge exists THEN `staticDependencyDirection` SHALL be `"none"` and all kind flags / `hasStaticDependency` SHALL be `false`

**Independent Test**: Unit tests on domain enrichment output; fixture JSON includes all fields.

**Requirements**: HOTSPOT-231, HOTSPOT-232

---

### P1: tsconfig paths / baseUrl resolution ⭐ MVP

**User Story**: As a tech lead on a monorepo, I want alias imports (e.g. `@app/foo`) that resolve to the peer file via tsconfig `paths`/`baseUrl` to set static-dependency flags so that monorepo coupling is not falsely labeled “hidden”.

**Why P1**: Primary CONCERNS mitigation for M27; ROADMAP bullet 1.

**Acceptance Criteria**:

1. WHEN file A imports peer B via a specifier matching nearest `tsconfig.json`/`jsconfig.json` `paths` or `baseUrl` AND resolution lands on B’s repo-relative path THEN the pair SHALL record a static edge (`hasStaticDependency: true` and appropriate direction/kinds)
2. WHEN relative resolution would already match (M14) THEN alias support SHALL NOT regress that behavior
3. WHEN no config exists, config is unreadable, or the alias does not resolve to an existing candidate THEN that specifier SHALL NOT create an edge (scan continues)
4. WHEN the specifier is a bare package name with no `paths`/`baseUrl` hit THEN it SHALL NOT alone create a pair edge
5. WHEN enrichment runs THEN it SHALL NOT import ts-morph under `src/scoring/`

**Independent Test**: Temp fixture sources + synthetic tsconfig with `@/` → `src/` mapping; assert edge true; missing config → relative-only behavior.

**Requirements**: HOTSPOT-233, HOTSPOT-237

---

### P1: Dependency direction ⭐ MVP

**User Story**: As a tech lead, I want to know whether A depends on B, B on A, or both so that I can choose where to break a cycle or extract a module.

**Why P1**: ROADMAP bullet 2; triage value beyond boolean.

**Acceptance Criteria**:

1. WHEN only `fileA` statically references `fileB` THEN `staticDependencyDirection` SHALL be `"a-to-b"`
2. WHEN only `fileB` statically references `fileA` THEN `staticDependencyDirection` SHALL be `"b-to-a"`
3. WHEN both reference each other THEN `staticDependencyDirection` SHALL be `"both"`
4. WHEN neither references the other THEN `staticDependencyDirection` SHALL be `"none"`
5. WHEN direction is computed THEN it SHALL use `fileA`/`fileB` field identity (not sorted path order)

**Independent Test**: Unit fixtures for each of the four direction values.

**Requirements**: HOTSPOT-234

---

### P1: Type-only vs runtime + re-exports ⭐ MVP

**User Story**: As a tech lead, I want type-only edges distinguished from runtime edges and re-exports called out so that “types-only coupling” is not treated like a hard runtime dependency.

**Why P1**: ROADMAP bullet 3.

**Acceptance Criteria**:

1. WHEN the only edges between the pair are `import type` / `export type … from` THEN `hasTypeOnlyStaticDependency` SHALL be `true`, `hasRuntimeStaticDependency` SHALL be `false`, and `hasStaticDependency` SHALL be `true`
2. WHEN a value `import`/`require`/`export … from` edge exists THEN `hasRuntimeStaticDependency` SHALL be `true`
3. WHEN an `export … from` / `export * from` / `export type … from` re-export edge exists THEN `hasReExportStaticDependency` SHALL be `true` and the corresponding runtime or type-only flag SHALL also be set
4. WHEN both runtime and type-only edges exist (any direction) THEN both kind flags SHALL be `true`
5. WHEN classifying edges THEN dynamic non-literal imports/requires SHALL be ignored

**Independent Test**: Unit fixtures for type-only-only, runtime-only, re-export, and mixed pairs.

**Requirements**: HOTSPOT-235, HOTSPOT-236

---

### P1: Schema + baseline contract ⭐ MVP

**User Story**: As a CI user comparing baselines, I want published schemas and `loadBaseline` to require the new fields so that stale JSON fails loudly with a re-scan hint.

**Why P1**: M20 contract continuity; prevents silent partial enrichment.

**Acceptance Criteria**:

1. WHEN `schemas/scan-result.json` `$defs/CouplingPair` is read THEN it SHALL require the four new fields with correct types/enums
2. WHEN `ScanResult.version` is emitted THEN it SHALL remain `"1.0"`
3. WHEN a baseline coupling item omits any new required field THEN `loadBaseline`/`parseScanResult` SHALL throw `BaselineError` with a re-scan hint
4. WHEN contract tests run THEN CLI/fixture JSON SHALL validate against updated schemas

**Independent Test**: Schema unit/contract tests; load-baseline rejection cases mirroring M14 pattern.

**Requirements**: HOTSPOT-238, HOTSPOT-239

---

### P1: Reporter surfaces ⭐ MVP

**User Story**: As a CLI user, I want table/markdown/CSV/JSON (and compare) to show direction and kinds so that I do not need a second tool.

**Why P1**: ROADMAP signal is useless if hidden.

**Acceptance Criteria**:

1. WHEN `--format json` THEN each coupling object SHALL include all additive fields
2. WHEN `--format table` or `markdown` THEN coupling rows SHALL show `StaticDep`, `Direction`, and `Kinds` per [context.md](./context.md)
3. WHEN `--format csv` THEN coupling CSV SHALL include columns for the four new fields
4. WHEN compare coupling sections render THEN the new fields SHALL appear on entities/columns

**Independent Test**: Reporter unit tests with fixture pairs covering none / a-to-b / both and kind combinations.

**Requirements**: HOTSPOT-240

---

### P1: Ranking purity + M26 boundary + docs ⭐ MVP

**User Story**: As a maintainer, I want enrichment to stay post-score metadata and docs/CONCERNS updated so that M27 does not regress temporal coupling or collide with M26 rename work.

**Why P1**: Fragile scoring area; explicit milestone boundary.

**Acceptance Criteria**:

1. WHEN enrichment runs THEN `couplingStrength`, `coChangeCount`, and pair order SHALL be unchanged vs pre-enrichment for the same temporal inputs
2. WHEN M27 code lands THEN it SHALL NOT modify `src/git/rename.ts` / PathAliasMap / RT-003 warning emission
3. WHEN docs update THEN ARCHITECTURE enriched-coupling section and CONCERNS mitigation for tsconfig paths SHALL reflect M27

**Independent Test**: Assert order/strength stable in unit/integration; grep shows no PathAliasMap imports from enricher; doc grep for new field names.

**Requirements**: HOTSPOT-241, HOTSPOT-242

---

## Edge Cases

- WHEN both files only `import type` each other THEN direction `"both"`, type-only `true`, runtime `false`, `hasStaticDependency` `true`
- WHEN A re-exports from B and B does not reference A THEN direction `"a-to-b"`, re-export `true`, runtime or type-only per export form
- WHEN alias maps to a file that exists but is not the peer path THEN no edge for that pair (resolution must match peer)
- WHEN `paths` pattern has multiple targets THEN try candidates in order until an existing file matches the peer (TypeScript-like first-match among existing candidates that equal peer)
- WHEN importer sits under a nested package with its own `tsconfig.json` THEN that nearest config SHALL win over repo-root config
- WHEN `extends` points at a missing file THEN use whatever `compilerOptions` were already parsed; do not abort scan
- WHEN pair paths are non-TS/JS (e.g. `.json`) THEN no static edge (`none` / all false) as in M14
- WHEN source missing/unreadable THEN no edge from that side; other side may still contribute direction

---

## Requirement Traceability

| Requirement ID | Story                                      | Phase | Status   |
| -------------- | ------------------------------------------ | ----- | -------- |
| HOTSPOT-231    | P1: Additive domain fields                 | Tasks | In Tasks |
| HOTSPOT-232    | P1: Additive domain fields (invariants)    | Tasks | In Tasks |
| HOTSPOT-233    | P1: tsconfig paths / baseUrl               | Tasks | In Tasks |
| HOTSPOT-234    | P1: Dependency direction                   | Tasks | In Tasks |
| HOTSPOT-235    | P1: Type-only vs runtime                   | Tasks | In Tasks |
| HOTSPOT-236    | P1: Re-exports                             | Tasks | In Tasks |
| HOTSPOT-237    | P1: Graceful fallback                      | Tasks | In Tasks |
| HOTSPOT-238    | P1: Schema version / additive required     | Tasks | In Tasks |
| HOTSPOT-239    | P1: Baseline validation                    | Tasks | In Tasks |
| HOTSPOT-240    | P1: Reporter surfaces                      | Tasks | In Tasks |
| HOTSPOT-241    | P1: Ranking purity + M26 boundary          | Tasks | In Tasks |
| HOTSPOT-242    | P1: Docs / CONCERNS                        | Tasks | In Tasks |

**Coverage:** 12 total, 12 mapped to tasks (see tasks.md), 0 unmapped

---

## Success Criteria

- [ ] Monorepo-style `@alias` import between a coupling pair → `hasStaticDependency: true` with correct direction
- [ ] Type-only-only pair distinguishable from runtime pair via flags
- [ ] Re-export pairs set `hasReExportStaticDependency`
- [ ] Pre-M27 baselines without new fields rejected with re-scan hint
- [ ] Temporal ranking unchanged for identical git inputs
- [ ] `pnpm build && pnpm test` green
