# Milestone 1 — Scaffold Specification

**Feature slug:** `scaffold`  
**Milestone:** ROADMAP M1  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [STRUCTURE.md](../../codebase/STRUCTURE.md)

## Problem Statement

Developers and implementation agents (M2–M6) need a typed, compilable skeleton before adding real pipeline logic. Without M1, each milestone would create structure ad-hoc, violating module boundaries documented in [STRUCTURE.md](../../codebase/STRUCTURE.md) and [INTEGRATIONS.md](../../codebase/INTEGRATIONS.md).

The repository has partial bootstrap (`package.json`, Vitest, dual `tsc` projects, minimal `bin/` and `src/index.ts` stubs) but lacks module directories, domain types, pipeline orchestration contract, and fixture layout.

## Goals

- [x] Module layout under `src/{git,complexity,scoring,report,types}/` plus `src/scan.ts` with stub exports
- [x] Domain types aligned with IMPL §5.1 (`FileChangeStats`, `ComplexityResult`, `HotspotScore`, `CoChangeEvent`, `CouplingPair`, `ScanOptions`, `ScanResult`)
- [x] Pipeline stub — `runScan()` returns empty typed `ScanResult` with no external I/O
- [x] Quality gate green — `pnpm build && pnpm test` passes
- [x] Fixture scaffold — `tests/fixtures/{git-log,repos,complexity}/` created (empty, with `.gitkeep`)
- [x] Placeholder integration test — `src/scan.test.ts` validates `runScan()` compiles, returns correct shape, and does not throw

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature                                              | Reason                            |
| ---------------------------------------------------- | --------------------------------- |
| `git log` parsing                                    | Milestone 2 — Git Change Miner    |
| McCabe / ts-morph                                    | Milestone 3 — Complexity Analyzer |
| Scoring formulas                                     | Milestone 4 — Scoring             |
| Commander, CLI flags, real reporter                  | Milestone 5 — Reporter + CLI      |
| Versioned Git fixture repo                           | Milestones 2 / 6                  |
| Runtime deps (`commander`, `ts-morph`, `simple-git`) | Respective milestones             |
| Coverage ≥80% on domain modules                      | After real implementation (M2+)   |

---

## User Stories

### P1: Typed module skeleton ⭐ MVP

**User Story**: As an implementer agent, I want a compilable module layout with domain types so that I can add M2–M5 logic without restructuring the repo.

**Why P1**: Every downstream milestone depends on stable paths and types.

**Acceptance Criteria**:

1. WHEN `pnpm build` THEN the compiler SHALL emit `dist/` without errors for `src/**` and `bin/**`
2. WHEN importing from `src/types/` THEN all IMPL §5.1 interfaces plus `ScanOptions` and `ScanResult` SHALL be available
3. WHEN listing `src/` THEN directories `git/`, `complexity/`, `scoring/`, `report/`, `types/` SHALL exist with barrel `index.ts` stubs exporting interfaces
4. WHEN `src/scan.ts` is imported THEN `runScan(options)` SHALL be exported and return a typed empty `ScanResult`

**Independent Test**: Run `pnpm build` and import `runScan` from `dist/index.js` — no TypeScript errors, empty result shape.

**Requirements**: HOTSPOT-01, HOTSPOT-02, HOTSPOT-03, HOTSPOT-04

---

### P1: CLI and integration wiring ⭐ MVP

**User Story**: As a developer, I want a minimal CLI stub and integration test so that I can smoke-test the pipeline contract before real features land.

**Why P1**: Validates bin → scan wiring and test harness without commander or git.

**Acceptance Criteria**:

1. WHEN `hotspot-scanner scan <path>` is invoked THEN bin SHALL delegate to `runScan({ repoPath })` and exit `0`
2. WHEN `hotspot-scanner` is invoked without valid `scan <path>` THEN bin SHALL print usage to stderr and exit `2`
3. WHEN `pnpm test` runs THEN `src/scan.test.ts` SHALL assert `runScan` returns `{ version: '1.0', hotspots: [], coupling: [], meta: {...} }`
4. WHEN `runScan` is called THEN it SHALL NOT spawn git subprocess or import ts-morph

**Independent Test**: `pnpm test -- src/scan.test.ts` passes; manual `pnpm exec hotspot-scanner scan .` exits `0`.

**Requirements**: HOTSPOT-05, HOTSPOT-07, HOTSPOT-08

---

### P1: Fixture directory scaffold ⭐ MVP

**User Story**: As a test author, I want fixture directories created so that M2+ can add samples without inventing layout.

**Why P1**: STRUCTURE.md and TESTING.md define fixture paths; creating them now avoids parallel structure debates.

**Acceptance Criteria**:

1. WHEN listing `tests/fixtures/` THEN subdirectories `git-log/`, `repos/`, and `complexity/` SHALL exist
2. WHEN directories are empty THEN each SHALL contain a `.gitkeep` so Git tracks them

**Independent Test**: `ls tests/fixtures/{git-log,repos,complexity}` shows `.gitkeep` in each.

**Requirements**: HOTSPOT-06

---

## Edge Cases

- WHEN `runScan` receives a non-existent `repoPath` THEN in M1 it SHALL still return empty `ScanResult` (path validation deferred to M2/M5)
- WHEN module stub factory functions are called THEN they SHALL throw `Error` with a clear "not implemented" message (not silent no-ops)
- WHEN `authors` is modeled in `FileChangeStats` THEN it SHALL use `Set<string>` internally and SHALL NOT appear in JSON output schema (IMPL §5.2, §6.2)
- WHEN building bin THEN `bin/` SHALL NOT be added to root `tsconfig.json` include (dual-project build per CONVENTIONS.md)

---

## Requirement Traceability

| Requirement ID | Story                          | Phase    | Status |
| -------------- | ------------------------------ | -------- | ------ |
| HOTSPOT-01     | P1: Typed module skeleton      | Tasks T2 | Done   |
| HOTSPOT-02     | P1: Typed module skeleton      | Tasks T1 | Done   |
| HOTSPOT-03     | P1: Typed module skeleton      | Tasks T2 | Done   |
| HOTSPOT-04     | P1: Typed module skeleton      | Tasks T3 | Done   |
| HOTSPOT-05     | P1: CLI and integration wiring | Tasks T4 | Done   |
| HOTSPOT-06     | P1: Fixture directory scaffold | Tasks T5 | Done   |
| HOTSPOT-07     | P1: CLI and integration wiring | Tasks T6 | Done   |
| HOTSPOT-08     | P1: CLI and integration wiring | Tasks T8 | Done   |

**Coverage:** 8 total, 8 mapped to tasks, 0 unmapped

---

## Success Criteria

- [x] `pnpm build && pnpm test` passes with zero regressions from current bootstrap
- [x] All P1 acceptance criteria verifiable without human judgment (automated gate)
- [x] Module map in STRUCTURE.md can be updated to `scaffold` / `stub` status for new paths after Execute
- [x] orchestrator-implementer can execute T1–T8 without ambiguous scope
