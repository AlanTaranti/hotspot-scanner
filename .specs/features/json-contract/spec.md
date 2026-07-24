# Milestone 20 — JSON Contract Specification

**Feature slug:** `json-contract`  
**Milestone:** ROADMAP M20  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), domain types in `src/types/domain.ts`  
**Context:** [`.specs/features/json-contract/context.md`](./context.md)  
**Depends on:** M14 `hasStaticDependency` on `CouplingPair` (field required in schemas)  
**Depth:** Large

## Problem Statement

JSON output and `--baseline` loading are only loosely validated (top-level keys). Consumers and compare mode need a **published contract** (`ScanResult` / `CompareResult` schemas) and **strong** baseline validation so malformed files fail with clear errors instead of corrupting deltas.

## Goals

- [ ] Publish JSON Schema for `ScanResult` and `CompareResult` under `schemas/`
- [ ] Strong validation in `loadBaseline()` / `parseScanResult()` — reject malformed JSON with clear `BaselineError`
- [ ] Contract tests: CLI `--format json` scan and compare output validates against schemas
- [ ] Schemas include M14 `hasStaticDependency` (boolean, required on coupling items)
- [ ] `pnpm build && pnpm test` passing after Execute

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| OpenAPI / HTML docs site | YAGNI |
| Validating table/markdown/csv text | JSON contract only |
| Changing scoring formulas | Contract only |
| Auto-migrating old baselines | Reject with message (context.md) |
| JSON Schema for CSV meta sidecar | Separate concern; optional note only if trivial |

---

## User Stories

### P1: Published schemas ⭐ MVP

**User Story**: As a downstream integrator, I want checked-in JSON Schema files so that I can validate hotspot-scanner JSON in my own pipelines.

**Acceptance Criteria**:

1. WHEN the repo is cloned THEN `schemas/scan-result.json` and `schemas/compare-result.json` SHALL exist
2. WHEN schemas describe coupling items THEN they SHALL require `hasStaticDependency` as boolean
3. WHEN schemas describe hotspots/functions/meta THEN they SHALL match current TypeScript domain types (`version`, raw metrics, granularity enum, etc.)
4. WHEN CompareResult is described THEN new/removed/rankChanged sections SHALL be represented

**Independent Test**: Files present; Ajv can compile schemas.

**Requirements**: HOTSPOT-158, HOTSPOT-159

---

### P1: Strong baseline validation ⭐ MVP

**User Story**: As a CLI user passing `--baseline`, I want malformed or incomplete JSON rejected with a clear error so that I do not get silent wrong deltas.

**Acceptance Criteria**:

1. WHEN baseline JSON is not an object / wrong `version` / missing required top-level fields THEN `loadBaseline` SHALL throw `BaselineError` with a clear message (existing behavior retained or improved)
2. WHEN hotspot/function/coupling **items** have wrong types or missing required properties (including `hasStaticDependency` on coupling) THEN validation SHALL reject with `BaselineError` naming the problem
3. WHEN JSON parse fails or file unreadable THEN existing `BaselineError` behavior SHALL remain
4. WHEN valid post-M14 scan JSON is loaded THEN `loadBaseline` SHALL succeed and return a typed `ScanResult`

**Independent Test**: Unit tests in `load-baseline.test.ts` with malformed fixtures.

**Requirements**: HOTSPOT-160, HOTSPOT-161

---

### P1: Contract tests for CLI JSON ⭐ MVP

**User Story**: As a maintainer, I want CI to prove CLI JSON matches the published schemas so that reporters cannot drift.

**Acceptance Criteria**:

1. WHEN scan runs `--format json` on the primary fixture THEN output SHALL validate against `schemas/scan-result.json`
2. WHEN compare JSON is produced (fixture baseline + current) THEN output SHALL validate against `schemas/compare-result.json`
3. WHEN schemas change THEN contract tests SHALL fail until reporters/types align

**Independent Test**: Dedicated contract test file using schema + CLI or `runScan`/`compare` JSON.

**Requirements**: HOTSPOT-162, HOTSPOT-163

---

### P1: Documentation ⭐ MVP

**User Story**: As a reader of README/ARCHITECTURE, I want pointers to `schemas/` and baseline validation behavior.

**Acceptance Criteria**:

1. WHEN README / ARCHITECTURE mention JSON THEN they SHALL link or path-reference `schemas/`
2. WHEN baseline errors are documented THEN messages SHALL mention re-scan if coupling field missing (as applicable)

**Independent Test**: Doc grep for `schemas/`

**Requirements**: HOTSPOT-164

---

### P1: Package visibility ⭐ MVP

**User Story**: As an npm consumer, I want schemas included in the published package (or clearly documented as repo-only).

**Acceptance Criteria**:

1. WHEN `package.json` `files` (or equivalent) is considered THEN schemas SHALL be included **if** the package already publishes non-dist assets; otherwise document repo path until M24 package-dx — **minimum**: schemas committed in repo and referenced from README
2. YAGNI: do not block M20 on full publish matrix if `files` is unset — document in tasks

**Independent Test**: Schemas on disk + README link.

**Requirements**: HOTSPOT-165

---

## Edge Cases

- WHEN coupling array is empty THEN schema SHALL still allow `[]`
- WHEN granularity is `function` THEN `hotspots` may be empty and `functions` populated (and vice versa) — schema SHALL allow both arrays always present
- WHEN rankChanged entity embeds full hotspot/function/coupling objects THEN nested required fields SHALL apply
- WHEN extra unknown properties appear THEN schema policy: `additionalProperties` — prefer `true` for forward compat OR `false` for strictness; **default for M20: `additionalProperties: true`** on objects to avoid brittle breaks, while **required** lists enforce minimum contract

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-158 | P1: scan-result schema | Tasks T1 | Pending |
| HOTSPOT-159 | P1: compare-result schema + hasStaticDependency | Tasks T1 | Pending |
| HOTSPOT-160 | P1: Strong parseScanResult | Tasks T2 | Pending |
| HOTSPOT-161 | P1: BaselineError messages | Tasks T2 | Pending |
| HOTSPOT-162 | P1: Scan JSON contract test | Tasks T3 | Pending |
| HOTSPOT-163 | P1: Compare JSON contract test | Tasks T3 | Pending |
| HOTSPOT-164 | P1: Documentation | Tasks T4 | Pending |
| HOTSPOT-165 | P1: Package/README visibility | Tasks T4 | Pending |

**Coverage:** 8 total, 8 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] `schemas/*.json` compile and match domain types including `hasStaticDependency`
- [ ] Malformed baselines rejected with clear errors
- [ ] Contract tests green for scan + compare JSON
- [ ] `pnpm build && pnpm test` green
