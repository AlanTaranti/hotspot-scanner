# Milestone 44 — Coupling Package Exports Specification

**Feature slug:** `coupling-package-exports`  
**Milestone:** ROADMAP M44  
**Item:** 24  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [CONCERNS.md](../../codebase/CONCERNS.md)  
**Sister:** [coupling-enrichment (M27)](../coupling-enrichment/spec.md), [static-enrich-cache (M33)](../static-enrich-cache/spec.md), [enriched-coupling (M14)](../enriched-coupling/spec.md)  
**Context:** [`.specs/features/coupling-package-exports/context.md`](./context.md)  
**Depth:** Complex  
**HOTSPOT ID range:** HOTSPOT-590 … HOTSPOT-619 (gaps OK)

## Problem Statement

After M14/M27/M33, static coupling enrichment resolves relative paths and tsconfig aliases, but monorepo packages that import peers via package `"name"` entry points or `#` subpath `"imports"` still report `hasStaticDependency: false`. That false negative is listed in CONCERNS as an unmitigated gap (risk M→A in monorepos). Tech leads cannot trust the static-dependency flags for workspace package boundaries.

## Goals

- [ ] Resolve in-repo `package.json` `exports` and `imports` when labeling static edges between coupling pairs
- [ ] Keep ranking (`couplingStrength`, order) unchanged — enrichment only
- [ ] Preserve existing CouplingPair static fields and M27 invariants; improve true-positive rate for package-entry / `#` imports
- [ ] Keep M33 peer-scoped `StaticEdgeGraph` design; extend resolution caches, no per-pair source re-read
- [ ] Contract tests remain green; add fixtures for exports/imports cases
- [ ] On Execute Done: remove CONCERNS unmitigated `exports`/`imports` row; update ARCHITECTURE enriched-coupling section
- [ ] `pnpm build && pnpm test` passing after Execute

## Out of Scope

| Feature                                                   | Reason                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------ |
| Full npm / `node_modules` package resolution              | YAGNI — workspace/in-repo first ([context.md](./context.md)) |
| PathAliasMap / historical AST / M26 rename graph          | Hard boundary                                                |
| Changing `ScanResult.version` or new coupling JSON fields | Additive behavior only under `"1.0"`                         |
| Source↔dist inventing heuristics                          | Extension/index candidates only                              |
| Full Node ESM_RESOLVE parity                              | Pragmatic subset                                             |
| New CLI flags for enrichment                              | Always-on post-score                                         |
| This package’s published `"exports"` map / adoption docs  | M45                                                          |
| Changing `couplingStrength` or pair ordering              | Temporal ranking authoritative                               |

---

## User Stories

### P1: In-repo `exports` resolution ⭐ MVP

**User Story**: As a tech lead on a monorepo, I want static imports of a workspace package’s public entry (via `"exports"`) that land on a coupled peer file to set `hasStaticDependency` so that package-boundary coupling is not falsely labeled hidden.

**Why P1**: Primary CONCERNS mitigation; ROADMAP M44 bullet 1.

**Acceptance Criteria**:

1. WHEN file A imports peer B via a specifier matching an in-repo package `"name"` (or `name/subpath`) AND that package’s `"exports"` resolve to B’s repo-relative path THEN the pair SHALL record a static edge with appropriate direction and kind flags
2. WHEN `"exports"` uses string, object, conditional, array, or single-`*` subpath forms per [context.md](./context.md) THEN resolution SHALL produce candidates and match peers via existing extension/index rules
3. WHEN `"exports"` is present but no export maps to the peer THEN that specifier SHALL NOT create an edge via package resolution (tsconfig/relative may still match independently)
4. WHEN `"exports"` is absent THEN package entry resolution SHALL use `"main"` fallback (or package-root index candidates) per context.md
5. WHEN the target package.json is outside `repoPath` or only available under `node_modules` THEN package resolution SHALL NOT create an edge

**Independent Test**: Temp tree with `packages/a` importing `@repo/b` whose `exports` point at `packages/b/src/index.ts`; assert enrich flags true; external-only name → false.

**Requirements**: HOTSPOT-590, HOTSPOT-595, HOTSPOT-596, HOTSPOT-597, HOTSPOT-599, HOTSPOT-610, HOTSPOT-612

---

### P1: Package `imports` (`#`) resolution ⭐ MVP

**User Story**: As a tech lead, I want `#` private import mappings from the importer’s `package.json` `"imports"` that resolve to a coupled peer to set static-dependency flags.

**Why P1**: Completes the CONCERNS `exports`/`imports` pair; common in modern Node packages.

**Acceptance Criteria**:

1. WHEN file A contains `import … from '#lib/foo'` (or similar) AND nearest in-repo `package.json` `"imports"` maps that specifier to peer B THEN the pair SHALL record a static edge
2. WHEN the `#` mapping uses a single-`*` pattern THEN it SHALL resolve like M27 path patterns
3. WHEN no `"imports"` match exists THEN that specifier SHALL NOT create an edge via package imports
4. WHEN `"imports"` resolution runs THEN it SHALL use the **importer’s** package scope (not the peer’s)

**Independent Test**: Temp package with `"imports": { "#util": "./src/util.ts" }` and a coupling pair between importer and `src/util.ts`.

**Requirements**: HOTSPOT-594, HOTSPOT-612

---

### P1: Ranking and field semantics unchanged ⭐ MVP

**User Story**: As a CLI/library consumer, I want package resolution to only improve labeling so that temporal rankings and existing JSON fields remain stable.

**Why P1**: ROADMAP locked goal; prevents silent ranking churn.

**Acceptance Criteria**:

1. WHEN enrichment runs with or without package resolution hits THEN `couplingStrength`, `coChangeCount`, and pair order SHALL be identical to pre-enrichment scoring output
2. WHEN a package-resolved edge exists THEN existing fields (`hasStaticDependency`, `staticDependencyDirection`, kind flags) SHALL obey M27 invariants
3. WHEN no new schema properties are introduced THEN `ScanResult.version` SHALL remain `"1.0"`
4. WHEN relative and tsconfig alias cases from M14/M27 are re-run THEN they SHALL not regress

**Independent Test**: Unit tests asserting ranking fields untouched; golden M14/M27 cases still pass; new case flips only static flags.

**Requirements**: HOTSPOT-591, HOTSPOT-592, HOTSPOT-593, HOTSPOT-602, HOTSPOT-606

---

### P1: M33 peer-scoped cache preserved ⭐ MVP

**User Story**: As an operator of large repos, I want package resolution to reuse per-pass caches so that hub files are not re-read per pair.

**Why P1**: ROADMAP locked goal; CONCERNS performance mitigation must not regress.

**Acceptance Criteria**:

1. WHEN `enrichCouplingStaticDeps` builds the graph THEN each unique peer source file SHALL be read/parsed at most once per call
2. WHEN multiple pairs share packages THEN each distinct `package.json` SHALL be read at most once per enrich call (cache hit thereafter)
3. WHEN implementing package resolution THEN the design SHALL NOT reintroduce per-pair source re-extraction
4. WHEN `pairs` is empty THEN enrichment SHALL return `[]` without building the graph (unchanged)

**Independent Test**: Existing M33 read-once hub test remains; extend asserts for package.json read-once across multi-pair hubs.

**Requirements**: HOTSPOT-600, HOTSPOT-601, HOTSPOT-613

---

### P1: Misses and malformed config ⭐ MVP

**User Story**: As a user scanning imperfect trees, I want unreadable or invalid package metadata to skip edges without aborting the scan.

**Why P1**: Matches M27 miss semantics; scan robustness.

**Acceptance Criteria**:

1. WHEN `package.json` is missing, unreadable, or JSON-invalid THEN package resolution for that scope SHALL miss (no edge from that path alone)
2. WHEN a specifier cannot be resolved by relative, tsconfig, or package rules THEN no static edge SHALL be recorded for that specifier
3. WHEN enrichment encounters misses THEN the scan SHALL continue (exit `0` on otherwise successful scan)

**Independent Test**: Invalid package.json next to importer; assert no throw and no false positive edge from package path.

**Requirements**: HOTSPOT-598, HOTSPOT-611

---

### P2: Fixtures + contract regression

**User Story**: As a maintainer, I want dedicated fixtures and contract coverage so that exports/imports labeling cannot silently regress.

**Why P2**: ROADMAP bullet on contract tests + fixtures; supports Execute verification.

**Acceptance Criteria**:

1. WHEN Execute completes THEN a fixture tree under `tests/fixtures/` SHALL cover at least one `exports` entry case and one `#` `imports` case
2. WHEN contract tests run THEN CouplingPair required static fields SHALL still validate (no schema shape change required)
3. WHEN integration or enrich tests run against the fixture THEN package-resolved pairs SHALL assert `hasStaticDependency: true` (and expected direction/kinds where specified)
4. WHEN enrichment code changes THEN tests SHALL live co-located under `src/scoring/*.test.ts` per TESTING.md

**Independent Test**: `pnpm test` includes new cases; optional `pnpm exec hotspot-scanner scan tests/fixtures/repos/<slug>` for manual check.

**Requirements**: HOTSPOT-603, HOTSPOT-604, HOTSPOT-605

---

### P2: Docs + CONCERNS gap closure

**User Story**: As a future agent, I want ARCHITECTURE and CONCERNS updated so the unmitigated matrix no longer lists package exports as deferred after Execute.

**Why P2**: Living docs rule; user-locked goal 6.

**Acceptance Criteria**:

1. WHEN planning completes THEN CONCERNS SHALL mark the gap as Planned (M44) rather than open Deferred without pointer
2. WHEN Execute completes THEN CONCERNS Unmitigated matrix SHALL **remove** the `exports`/`imports` row and the enriched-coupling mitigation table SHALL document package resolution
3. WHEN Execute completes THEN ARCHITECTURE § Enriched coupling SHALL document exports/imports resolution and drop the “deferred” out-of-scope line for that item
4. WHEN scoring module list is documented THEN STRUCTURE.md MAY list the new helper file

**Independent Test**: Doc review in final task; no product behavior.

**Requirements**: HOTSPOT-608, HOTSPOT-609

---

### P2: No ts-morph / integration boundaries

**User Story**: As a maintainer of INTEGRATIONS boundaries, I want package JSON parsing to stay in scoring without ts-morph.

**Why P2**: Hard INTEGRATIONS rule.

**Acceptance Criteria**:

1. WHEN package resolution is implemented THEN `src/scoring/` SHALL NOT import ts-morph
2. WHEN parsing `package.json` THEN the implementation SHALL use `JSON.parse` (JSONC comments optional/YAGNI unless needed) with no new runtime dependency

**Independent Test**: Grep / review in code-reviewer phase; unit tests only use `node:fs`.

**Requirements**: HOTSPOT-607

---

## Edge Cases

- WHEN specifier is `@scope/pkg` and a peer-indexed package `"name"` is `@scope/pkg` THEN exports resolution SHALL apply
- WHEN specifier is `@scope/pkg/sub` and exports define `./sub` THEN subpath resolution SHALL apply
- WHEN `#` specifier appears but nearest package.json has no `"imports"` THEN miss
- WHEN exports target `./dist/index.js` and peer is `./src/index.ts` with no candidate equality THEN miss (no invent mapping)
- WHEN both tsconfig paths and exports could match THEN either path producing peer equality is sufficient (order tries tsconfig before package name exports; relative/imports first as locked)
- WHEN mutual package-name imports exist between two workspace packages THEN direction SHALL be `"both"` when both edges resolve
- WHEN type-only import uses a `#` or exports path THEN `hasTypeOnlyStaticDependency` SHALL be set per M27 classification

---

## Requirement Traceability

| Requirement ID | Story                        | Phase | Status  |
| -------------- | ---------------------------- | ----- | ------- |
| HOTSPOT-590    | P1: exports resolution       | Tasks | Pending |
| HOTSPOT-591    | P1: ranking unchanged        | Tasks | Pending |
| HOTSPOT-592    | P1: field semantics          | Tasks | Pending |
| HOTSPOT-593    | P1: no M14/M27 regression    | Tasks | Pending |
| HOTSPOT-594    | P1: imports `#`              | Tasks | Pending |
| HOTSPOT-595    | P1: exports forms            | Tasks | Pending |
| HOTSPOT-596    | P1: workspace package name   | Tasks | Pending |
| HOTSPOT-597    | P1: conditions               | Tasks | Pending |
| HOTSPOT-598    | P1: miss continues           | Tasks | Pending |
| HOTSPOT-599    | P1: no node_modules          | Tasks | Pending |
| HOTSPOT-600    | P1: M33 graph cache          | Tasks | Pending |
| HOTSPOT-601    | P1: package.json cache       | Tasks | Pending |
| HOTSPOT-602    | P1: no version/schema fields | Tasks | Pending |
| HOTSPOT-603    | P2: contract regression      | Tasks | Pending |
| HOTSPOT-604    | P2: exports fixture          | Tasks | Pending |
| HOTSPOT-605    | P2: imports fixture          | Tasks | Pending |
| HOTSPOT-606    | P1: kinds/direction          | Tasks | Pending |
| HOTSPOT-607    | P2: no ts-morph              | Tasks | Pending |
| HOTSPOT-608    | P2: CONCERNS gap remove      | Tasks | Pending |
| HOTSPOT-609    | P2: ARCHITECTURE update      | Tasks | Pending |
| HOTSPOT-610    | P1: main fallback            | Tasks | Pending |
| HOTSPOT-611    | P1: malformed package.json   | Tasks | Pending |
| HOTSPOT-612    | P1: single-`*` patterns      | Tasks | Pending |
| HOTSPOT-613    | P1: read-once invariant      | Tasks | Pending |
| HOTSPOT-614    | Gate                         | Tasks | Pending |

**Coverage:** 25 total, mapped in tasks.md

---

## Success Criteria

- [ ] Workspace `exports` / `#` `imports` edges set static flags where peers match
- [ ] External `node_modules`-only packages still miss
- [ ] Ranking identical; M14/M27 cases green; M33 read-once preserved
- [ ] Fixtures + contract green; CONCERNS unmitigated row removed after Execute
- [ ] `pnpm build && pnpm test` passes
