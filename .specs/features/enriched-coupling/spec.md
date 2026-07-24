# Milestone 14 — Enriched Coupling Specification

**Feature slug:** `enriched-coupling`  
**Milestone:** ROADMAP M14  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [CONCERNS.md](../../codebase/CONCERNS.md)  
**Context:** [`.specs/features/enriched-coupling/context.md`](./context.md)  
**Depth:** Large

## Problem Statement

Temporal coupling ranks file pairs that change together, but does not say whether those pairs also share a **static** import/require edge. Tech leads cannot tell “hidden dependency” (co-change without imports) from “expected coupling” (co-change **with** static imports) without opening the sources. Enriching each `CouplingPair` with `hasStaticDependency: boolean` makes the coupling report actionable.

## Goals

- [ ] Add `hasStaticDependency: boolean` to `CouplingPair` for every ranked pair
- [ ] Detect resolvable static import/export/require edges between pair paths (see context.md)
- [ ] Surface the field in JSON, table, markdown, and CSV (scan + compare coupling rows)
- [ ] Leave `couplingStrength` / co-change formulas unchanged
- [ ] Anticipate M20 schema: field documented for `schemas/scan-result.json`
- [ ] `pnpm build && pnpm test` passing after Execute

## Out of Scope

| Feature                                                   | Reason                                    |
| --------------------------------------------------------- | ----------------------------------------- |
| Full repo import graph / dependency cycles                | YAGNI — pair boolean only                 |
| Direction (`A→B` vs `B→A`) as separate output fields      | YAGNI — single boolean                    |
| tsconfig `paths` / package.json `exports` aliases         | YAGNI — relative resolution only          |
| Dynamic `import(expr)` / non-literal `require`            | Unreliable without eval                   |
| Changing `--min-cochange` or ranking order by static edge | Ranking stays temporal                    |
| Per-function coupling                                     | Coupling remains file-level (M11)         |
| M20 schema file publication                               | M20 owns schemas; M14 only adds the field |

---

## User Stories

### P1: Domain field on CouplingPair ⭐ MVP

**User Story**: As a library consumer, I want every `CouplingPair` to include `hasStaticDependency` so that JSON and compare baselines carry the enrichment.

**Why P1**: Contract for all reporters and M20.

**Acceptance Criteria**:

1. WHEN a `CouplingPair` is produced by the scan pipeline THEN it SHALL include `hasStaticDependency: boolean`
2. WHEN TypeScript domain types are read THEN `CouplingPair` in `src/types/domain.ts` SHALL declare the field
3. WHEN `couplingStrength` / `coChangeCount` / ordering are computed THEN they SHALL be unchanged from pre-M14 behavior

**Independent Test**: Unit test on enriched pairs; snapshot field presence on fixture scan JSON.

**Requirements**: HOTSPOT-145

---

### P1: Static edge detection ⭐ MVP

**User Story**: As a tech lead, I want `hasStaticDependency` to reflect a real static module link between the two files so that I can separate hidden co-change from import-backed coupling.

**Why P1**: Core analytic value of M14.

**Acceptance Criteria**:

1. WHEN file A has a resolvable static `import`/`export … from`/`require` string referencing file B (or vice versa) THEN `hasStaticDependency` SHALL be `true`
2. WHEN neither file statically references the other THEN `hasStaticDependency` SHALL be `false`
3. WHEN the specifier is a bare package name THEN it SHALL NOT alone set the flag for the pair
4. WHEN a source file is missing or unreadable THEN the pair SHALL get `hasStaticDependency: false` without failing the scan
5. WHEN enrichment runs THEN it SHALL only consider pairs that already passed `minCochange` scoring

**Independent Test**: Fixture pair sources with/without relative imports; assert boolean.

**Requirements**: HOTSPOT-146, HOTSPOT-147

---

### P1: Reporter surfaces ⭐ MVP

**User Story**: As a CLI user, I want table/markdown/CSV/JSON coupling output to show the static-dependency flag so that I do not need a second tool.

**Why P1**: ROADMAP output field is useless if hidden from humans/pipelines.

**Acceptance Criteria**:

1. WHEN `--format json` THEN each coupling object SHALL include `hasStaticDependency`
2. WHEN `--format table` or `markdown` THEN coupling rows SHALL include a static-dependency column (`yes`/`no` or equivalent)
3. WHEN `--format csv` THEN coupling CSV SHALL include a `hasStaticDependency` column
4. WHEN compare coupling sections render THEN the field SHALL appear on entities (JSON) and in human/CSV coupling delta rows

**Independent Test**: Reporter unit tests with fixture `CouplingPair` including both booleans.

**Requirements**: HOTSPOT-148, HOTSPOT-149, HOTSPOT-150

---

### P1: Pipeline wiring ⭐ MVP

**User Story**: As a developer running `runScan()`, I want enrichment applied automatically after temporal coupling scoring so that all entry points (CLI and programmatic API) stay consistent.

**Why P1**: Single orchestration path.

**Acceptance Criteria**:

1. WHEN `runScan()` completes THEN `result.coupling[*].hasStaticDependency` SHALL be set
2. WHEN enrichment fails to read a file THEN scan SHALL continue (warning optional; must not abort)
3. WHEN no coupling pairs exist THEN enrichment SHALL be a no-op

**Independent Test**: Integration scan on fixture with known import-linked co-change pair.

**Requirements**: HOTSPOT-151

---

### P1: Tests + documentation ⭐ MVP

**User Story**: As a maintainer, I want fixtures and docs so that M14 does not regress and M20 can schema-lock the field.

**Why P1**: Fragile adjacent area (scoring + report); handoff to M20.

**Acceptance Criteria**:

1. WHEN unit/integration tests run THEN they SHALL cover true/false/missing-file cases
2. WHEN docs update THEN ARCHITECTURE / README / STRUCTURE mention enriched coupling field
3. WHEN M20 is planned THEN schema SHALL list `hasStaticDependency` as required boolean on coupling items (cross-milestone note in design)

**Independent Test**: `pnpm build && pnpm test`; doc grep for `hasStaticDependency`.

**Requirements**: HOTSPOT-152

---

## Edge Cases

- WHEN both files import each other THEN `hasStaticDependency` SHALL be `true` (still boolean)
- WHEN import path uses extensionless relative form THEN resolution SHALL try common TS/JS extensions / index
- WHEN path casing differs only by case on case-insensitive FS THEN best-effort match; fixtures use canonical repo-relative paths
- WHEN file is `.json` or non-TS/JS coupled path THEN `false` (no static TS/JS module edge required)
- WHEN `import type { X } from './b'` THEN counts as static edge (`true`)

---

## Requirement Traceability

| Requirement ID | Story                                    | Phase            | Status |
| -------------- | ---------------------------------------- | ---------------- | ------ |
| HOTSPOT-145    | P1: Domain field on CouplingPair         | Tasks T1         | Done   |
| HOTSPOT-146    | P1: Static edge detection                | Tasks T2         | Done   |
| HOTSPOT-147    | P1: Static edge detection (missing file) | Tasks T2         | Done   |
| HOTSPOT-148    | P1: JSON reporter                        | Tasks T3         | Done   |
| HOTSPOT-149    | P1: Table/markdown reporters             | Tasks T3         | Done   |
| HOTSPOT-150    | P1: CSV + compare reporters              | Tasks T3         | Done   |
| HOTSPOT-151    | P1: Pipeline wiring                      | Tasks T4         | Done   |
| HOTSPOT-152    | P1: Tests + documentation                | Tasks T2, T4, T5 | Done   |

**Coverage:** 8 total, 8 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] Every coupling pair in scan JSON has `hasStaticDependency`
- [ ] Import-linked fixture pair → `true`; co-change-only pair → `false`
- [ ] Strength ranking unchanged vs pre-enrichment for same inputs
- [ ] `pnpm build && pnpm test` green
