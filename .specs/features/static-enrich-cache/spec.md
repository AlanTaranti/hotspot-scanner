# Milestone 33 — Static Enrich Graph Cache Specification

**Feature slug:** `static-enrich-cache`  
**Milestone:** ROADMAP M33  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md) § Enriched coupling, [CONCERNS.md](../../codebase/CONCERNS.md)  
**Sister:** [enriched-coupling (M14)](../enriched-coupling/spec.md), [coupling-enrichment (M27)](../coupling-enrichment/spec.md)  
**Depth:** Medium–Large  
**HOTSPOT ID range:** HOTSPOT-340 … HOTSPOT-359 (gaps OK)

## Problem Statement

`enrichCouplingStaticDeps()` labels each temporal coupling pair with static-dependency fields by scanning working-tree sources. Today it **re-reads and re-parses** a file for every pair that mentions it (`collectEdgesToPeer` → `readSourceSafe` + regex extract per call). On dense graphs (hub files in many pairs), enrich becomes O(pairs × reads) and dominates wall time without changing labels. Tech leads need the same M14/M27 fields, faster.

## Goals

- [ ] One source **read** and one **parse** (reference extract) per unique file touched by the enrich pass
- [ ] Cache resolved directed edges (with kind flags) for the enrich pass; label pairs via **O(1)** adjacency lookup
- [ ] Preserve exact public labeling semantics: `hasStaticDependency`, `staticDependencyDirection`, kind flags, and invariants
- [ ] Leave temporal ranking (`couplingStrength`, `coChangeCount`, pair order) unchanged
- [ ] Keep `package.json` `exports`/`imports` deferred (CONCERNS)
- [ ] No ts-morph under `src/scoring/`
- [ ] `pnpm build && pnpm test` passing after Execute

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| `package.json` `exports` / `imports` resolution | Explicitly deferred (CONCERNS / ROADMAP) |
| Changing ranking by static edge or `--min-cochange` | Enrich remains post-score labeling only |
| New CLI flags / config for cache | Always on; YAGNI |
| Persistent / cross-scan disk cache | In-memory per enrich call only |
| Full-repo import graph metrics (fan-in, cycles) | Pair labeling only |
| PathAliasMap / rename graph (M26) | Hard boundary |
| ts-morph AST for imports | Regex + existing resolution only |
| Reporter / schema / baseline contract changes | Fields unchanged |
| Parallelizing enrich across workers | Separate from this cache milestone |

---

## User Stories

### P1: One read/parse per file ⭐ MVP

**User Story**: As a CLI user scanning a large TS/JS repo, I want each coupling-participant source file read and regex-parsed at most once during static enrich so that enrich wall time scales with unique files, not pair count.

**Why P1**: ROADMAP bullet 1; primary perf win.

**Acceptance Criteria**:

1. WHEN `enrichCouplingStaticDeps(pairs, repoPath)` runs with N unique source paths appearing in `pairs` THEN the enricher SHALL read each readable source path at most once during that call
2. WHEN a source is read THEN `extractStaticReferences` (or equivalent structured extract) SHALL run at most once on that source text during that call
3. WHEN a path is not a supported source extension, missing, or unreadable THEN the enricher SHALL NOT invent edges from that path (same as M14/M27) and SHALL NOT retry unbounded reads for it within the call
4. WHEN `pairs` is empty THEN the enricher SHALL return `[]` without scanning the tree

**Independent Test**: Temp repo with one hub file paired to many leaves; spy/mock `readFileSync` (or inject readable counter) and assert hub read count === 1.

**Requirements**: HOTSPOT-340, HOTSPOT-348

---

### P1: Cached edges + O(1) pair lookup ⭐ MVP

**User Story**: As a maintainer of the scoring module, I want resolved directed edges cached for the enrich pass so that labeling a pair is an adjacency lookup, not another resolve loop over the peer’s source.

**Why P1**: ROADMAP bullets 1–2; enables read-once without changing labels.

**Acceptance Criteria**:

1. WHEN the enrich pass builds its cache THEN it SHALL store directed edges among paths that appear in `pairs` (peer set), including enough kind metadata to set runtime / type-only / re-export flags
2. WHEN labeling a pair `(fileA, fileB)` THEN the enricher SHALL determine A→B and B→A presence via O(1) (amortized) map/set lookup into that cache — not by re-extracting the peer’s source
3. WHEN aggregating kinds for a pair THEN the enricher SHALL OR kind flags across edges in either direction the same way M27 does today
4. WHEN computing `staticDependencyDirection` THEN it SHALL use `fileA`/`fileB` field identity (`a-to-b` / `b-to-a` / `both` / `none`) unchanged

**Independent Test**: Unit tests on graph builder + enrich output for one-way, reverse, both, and none; assert no second parse when labeling many pairs sharing files.

**Requirements**: HOTSPOT-341, HOTSPOT-342

---

### P1: Behavioral equivalence (no ranking / field change) ⭐ MVP

**User Story**: As a tech lead consuming JSON/table/CSV, I want M33 to produce the same static-dependency fields for the same working tree so that reports and baselines do not silently drift.

**Why P1**: ROADMAP “no ranking change; same fields”; safety for a perf refactor.

**Acceptance Criteria**:

1. WHEN relative and tsconfig-alias edges resolve under M27 rules THEN labeled fields SHALL match pre-M33 semantics for the same fixtures
2. WHEN invariants are checked THEN `hasStaticDependency === (hasRuntimeStaticDependency || hasTypeOnlyStaticDependency)` and `direction === "none"` ⇔ all static flags false SHALL hold
3. WHEN enrichment completes THEN `couplingStrength`, `coChangeCount`, and pair array order SHALL be unchanged from the input pairs (aside from spreading static fields)
4. WHEN bare package specifiers lack a paths/baseUrl hit THEN they SHALL still not create pair edges
5. WHEN enrichment runs THEN `src/scoring/` SHALL NOT import ts-morph
6. WHEN design/docs mention resolution gaps THEN `package.json` `exports`/`imports` SHALL remain documented as deferred (no implementation)

**Independent Test**: Existing `enrich-coupling-static.test.ts` cases stay green; add equivalence assertions for alias + kind fixtures; grep/static check no ts-morph in scoring.

**Requirements**: HOTSPOT-343, HOTSPOT-344, HOTSPOT-345, HOTSPOT-346, HOTSPOT-347

---

### P2: Document cache behavior in SoT docs

**User Story**: As an agent or contributor, I want ARCHITECTURE/CONCERNS to note that enrich uses a per-pass edge cache so that future work does not reintroduce per-pair reads.

**Why P2**: Living docs; not user-facing CLI.

**Acceptance Criteria**:

1. WHEN ARCHITECTURE § Enriched coupling is updated THEN it SHALL state that enrich builds an in-memory peer-scoped edge cache (one read/parse per file; O(1) pair lookup)
2. WHEN CONCERNS mentions enriched coupling performance THEN it SHALL note the M33 mitigation (or point to ARCHITECTURE)

**Independent Test**: Doc review in task Done when.

**Requirements**: HOTSPOT-351

---

## Edge Cases

- WHEN the same file appears in many pairs THEN it SHALL be read/parsed once per enrich call
- WHEN only one side of a pair is a source file THEN the other side SHALL contribute no outbound edges (same as today)
- WHEN resolution candidates exist but none match the peer path THEN no edge for that specifier
- WHEN `TsconfigPathMap` misses / unreadable config THEN alias miss behavior unchanged
- WHEN two pairs share no files THEN graph build still reads each participant at most once
- WHEN kinds mix (runtime + type-only + re-export) across directions THEN OR aggregation matches M27

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-340 | P1: One read/parse per file | Tasks | Pending |
| HOTSPOT-341 | P1: Cached edges + O(1) lookup | Tasks | Pending |
| HOTSPOT-342 | P1: Cached edges + O(1) lookup | Tasks | Pending |
| HOTSPOT-343 | P1: Behavioral equivalence | Tasks | Pending |
| HOTSPOT-344 | P1: Behavioral equivalence | Tasks | Pending |
| HOTSPOT-345 | P1: Behavioral equivalence | Tasks | Pending |
| HOTSPOT-346 | P1: Behavioral equivalence | Tasks | Pending |
| HOTSPOT-347 | P1: Behavioral equivalence | Tasks | Pending |
| HOTSPOT-348 | P1: One read/parse per file | Tasks | Pending |
| HOTSPOT-351 | P2: Document cache behavior | Tasks | Pending |

**ID format:** `HOTSPOT-NNN`  
**Reserved unused in range:** HOTSPOT-349, HOTSPOT-350, HOTSPOT-352–359 (available for Execute splits if needed)  
**Coverage:** 10 mapped requirements; all P1 IDs appear in tasks.md

---

## Success Criteria

- [ ] Hub-file / multi-pair fixtures show one read per unique source path
- [ ] Existing enrich unit tests pass without semantic assertion changes (except new cache tests)
- [ ] No new public fields; no schema/reporter diffs required
- [ ] `package.json` exports/imports still deferred
- [ ] `pnpm build && pnpm test` green after Execute
