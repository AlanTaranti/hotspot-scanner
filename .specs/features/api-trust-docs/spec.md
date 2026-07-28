# Milestone 55 — API Trust Docs Specification

**Feature slug:** `api-trust-docs`  
**Milestone:** ROADMAP M55  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [TESTING.md](../../codebase/TESTING.md)  
**Context:** [context.md](./context.md) — locked decisions  
**Depth:** Small (full artifacts)  
**Priority:** Medium  
**Sisters:** [adoption-docs-package-exports](../adoption-docs-package-exports/spec.md) (M45), [config-file](../config-file/spec.md) (M21), [package-dx](../package-dx/spec.md) (M24); cross-link [output-interpretation-ux](../output-interpretation-ux/spec.md) (M41)  
**IDs:** HOTSPOT-860–889 (883–889 reserved)

## Problem Statement

Package consumers cannot import dry-run preview or doctor from the public entry. Unknown `.hotspot-scanner.json` keys are silently dropped (M21), hiding typos and CLI-only keys. The `merge-heavy` fixture is unused in CI integration. Trust documentation — zero-network posture, vulnerability reporting, baseline artifact placement, and the M41 `--only` JSON trap — is incomplete or easy to miss.

## Goals

- [ ] Export `previewScanScope`, `runDoctor`, and their public types from `src/index.ts` (package `"."` entry)
- [ ] Warn (warn-only) on unknown config keys with stable code `UNKNOWN_CONFIG_KEY`; keep forward-compat (never fail)
- [ ] Wire `tests/fixtures/repos/merge-heavy` into the integration suite
- [ ] Ship README zero-network callout, `SECURITY.md` + reporting, baseline-in-artifacts guidance, and `--only` filtered JSON ≠ baseline cross-links

## Out of Scope

| Feature                                                   | Reason                                 |
| --------------------------------------------------------- | -------------------------------------- |
| npm publish / npx / `pnpm dlx`                            | Deferred (STATE)                       |
| Hard-fail on unknown config keys                          | Locked warn-only / forward-compat      |
| New CLI flags or config keys                              | YAGNI                                  |
| JSON schema / ranking / miner changes                     | Docs + exports + thin config warn only |
| Subpath `package.json` exports                            | Keep M45 single `"."` map              |
| `formatScanScopePreview` / doctor internals as public API | YAGNI                                  |
| Redesign `merge-heavy` history                            | Fixture already exists                 |

---

## User Stories

### P1: Public preview + doctor exports ⭐ MVP

**User Story**: As a library consumer, I want to `import { previewScanScope, runDoctor } from '@vitals/hotspot-scanner'` so that I can script dry-run scope checks and doctor without deep imports.

**Why P1**: ROADMAP M55 item 1; closes M45 “do not expand API” deferral for these two already-shipped surfaces.

**Acceptance Criteria**:

1. WHEN `src/index.ts` is read THEN it SHALL re-export `previewScanScope` from the scan-preview module
2. WHEN `src/index.ts` is read THEN it SHALL re-export type `ScanScopePreview`
3. WHEN `src/index.ts` is read THEN it SHALL re-export `runDoctor` from the doctor module
4. WHEN `src/index.ts` is read THEN it SHALL re-export types `DoctorFinding`, `DoctorFindingId`, `DoctorFindingStatus`, `DoctorResult`, and `RunDoctorOptions`
5. WHEN `package.json` `"exports"."."` is checked THEN it SHALL still resolve to `./dist/index.js` + `./dist/index.d.ts` (no new subpaths required)
6. WHEN README Programmatic API is updated THEN it SHALL list `previewScanScope` and `runDoctor` (with type imports) alongside existing `runScan` / compare helpers
7. WHEN `pnpm build` completes THEN `dist/index.d.ts` SHALL declare the new exports

**Independent Test**: `pnpm build`; inspect `src/index.ts` + `dist/index.d.ts`; TypeScript import smoke in a unit/doc test or README sample compile via existing gate.

**Requirements**: HOTSPOT-860, HOTSPOT-861, HOTSPOT-862, HOTSPOT-863, HOTSPOT-864, HOTSPOT-865, HOTSPOT-866

---

### P1: Warn on unknown config keys ⭐ MVP

**User Story**: As a repo maintainer, I want unknown keys in `.hotspot-scanner.json` to produce a clear warn-only diagnostic so that typos and CLI-only keys are visible without breaking older or newer config files.

**Why P1**: ROADMAP M55 item 2; upgrades M21 silent ignore without sacrificing forward-compat.

**Acceptance Criteria**:

1. WHEN a config object contains keys outside the known set (`since`, `include`, `exclude`, `granularity`, `minCochange`, `top`, `concurrency`) THEN those keys SHALL NOT be applied to merge
2. WHEN unknown keys are present THEN the system SHALL emit a `ScanWarning` with `code: "UNKNOWN_CONFIG_KEY"` (severity `warning`) listing the unknown key name(s) — prefer one warning with sorted key names
3. WHEN unknown keys are present THEN scan/doctor/config load SHALL **not** throw `ConfigError` solely because of those keys
4. WHEN only unknown keys differ from a valid empty/known config THEN exit code on successful scan SHALL remain `0`
5. WHEN invalid _known_ key types appear THEN behavior SHALL remain hard-fail (`ConfigError`) as today
6. WHEN `runScan` completes with unknown config keys THEN `meta.warnings` SHALL include the `UNKNOWN_CONFIG_KEY` entry and `onWarning` SHALL have been invoked (when provided)
7. WHEN README / Configuration docs mention unknown keys THEN they SHALL state warn-only + ignored for merge (supersede “silently ignored”)
8. WHEN `docs/warning-codes.md` is updated THEN it SHALL list `UNKNOWN_CONFIG_KEY` with a one-line interpretation

**Independent Test**: Unit tests on parse/load; optional CLI stderr assertion with a temp config containing `format: "json"`.

**Requirements**: HOTSPOT-867, HOTSPOT-868, HOTSPOT-869, HOTSPOT-870, HOTSPOT-871, HOTSPOT-872

---

### P1: Wire `merge-heavy` into integration suite ⭐ MVP

**User Story**: As a maintainer, I want the existing merge/delete fixture exercised in Vitest so that merge commits and deletes stay regression-covered.

**Why P1**: ROADMAP M55 item 3; fixture Done since M6 P2 but unwired.

**Acceptance Criteria**:

1. WHEN Vitest global setup (or equivalent) runs THEN `tests/fixtures/repos/merge-heavy` SHALL be bootstrapped via `ensureFixtureRepo` when `.git` is missing
2. WHEN `src/scan.integration.test.ts` runs THEN a describe block SHALL scan `merge-heavy` successfully
3. WHEN that scan completes THEN `src/keep.ts` SHALL appear in hotspot rankings and deleted `src/remove.ts` SHALL NOT
4. WHEN TESTING.md Integration layer is read THEN `merge-heavy` SHALL be documented as a wired E2E fixture (not merely “P2 optional”)

**Independent Test**: `pnpm test -- src/scan.integration.test.ts`; manual `pnpm exec hotspot-scanner scan tests/fixtures/repos/merge-heavy`.

**Requirements**: HOTSPOT-873, HOTSPOT-874, HOTSPOT-875, HOTSPOT-876

---

### P1: Trust & security docs ⭐ MVP

**User Story**: As an evaluator or security reviewer, I want an explicit zero-network callout, a `SECURITY.md` reporting path, baseline-in-artifacts guidance, and a clear `--only` ≠ baseline warning so that I can trust local use and avoid invalid compare workflows.

**Why P1**: ROADMAP M55 item 4.

**Acceptance Criteria**:

1. WHEN README is opened near the top THEN a clear **zero network / local-only during scan** callout SHALL be present (strengthen existing Privacy block or equivalent — no contradiction with clone/install needing network)
2. WHEN the repo is checked THEN `SECURITY.md` SHALL exist describing the local trust model and how to report vulnerabilities (GitHub Security Advisories and/or a documented contact)
3. WHEN README TOC / Contributing-adjacent links are updated THEN they SHALL link to `SECURITY.md`
4. WHEN `docs/recipes.md` Baseline / compare (and README compare as needed) are updated THEN they SHALL recommend storing baselines as **CI artifacts** (example path or Actions upload wording) without inventing a new CLI flag
5. WHEN baseline docs are read THEN they SHALL restate that **`--only` filtered JSON is not a valid baseline** and cross-link M41 / existing README section filter warning
6. WHEN `package.json` `files` is checked THEN it SHALL include `SECURITY.md` (publish-prep; no publish)

**Independent Test**: File existence greps; README/`docs/recipes.md` link checks; no gate change beyond full project gate.

**Requirements**: HOTSPOT-877, HOTSPOT-878, HOTSPOT-879, HOTSPOT-880, HOTSPOT-881, HOTSPOT-882

---

## Edge Cases

- WHEN config has multiple unknown keys THEN one warning lists all (sorted) — do not spam N identical codes unless implementer proves need
- WHEN config is absent THEN no `UNKNOWN_CONFIG_KEY`
- WHEN unknown key value is exotic (object/array) THEN still warn + ignore — do not validate unknown value shapes
- WHEN `merge-heavy` `.git` already exists THEN bootstrap SHALL be a no-op
- WHEN programmatic consumer imports only types THEN types resolve from `dist/index.d.ts` without runtime side effects

---

## Requirement Traceability

| Requirement ID  | Story                                   | Phase | Status   |
| --------------- | --------------------------------------- | ----- | -------- |
| HOTSPOT-860     | P1: Public exports — `previewScanScope` | Tasks | Pending  |
| HOTSPOT-861     | P1: Public exports — `ScanScopePreview` | Tasks | Pending  |
| HOTSPOT-862     | P1: Public exports — `runDoctor`        | Tasks | Pending  |
| HOTSPOT-863     | P1: Public exports — doctor types       | Tasks | Pending  |
| HOTSPOT-864     | P1: README Programmatic API             | Tasks | Pending  |
| HOTSPOT-865     | P1: `exports` map unchanged shape       | Tasks | Pending  |
| HOTSPOT-866     | P1: `dist` types after build            | Tasks | Pending  |
| HOTSPOT-867     | P1: Unknown keys ignored for merge      | Tasks | Pending  |
| HOTSPOT-868     | P1: Warn-only emission                  | Tasks | Pending  |
| HOTSPOT-869     | P1: Code `UNKNOWN_CONFIG_KEY`           | Tasks | Pending  |
| HOTSPOT-870     | P1: No fail / exit 0                    | Tasks | Pending  |
| HOTSPOT-871     | P1: Docs supersede silent ignore        | Tasks | Pending  |
| HOTSPOT-872     | P1: warning-codes cheatsheet            | Tasks | Pending  |
| HOTSPOT-873     | P1: Bootstrap merge-heavy               | Tasks | Pending  |
| HOTSPOT-874     | P1: Integration describe                | Tasks | Pending  |
| HOTSPOT-875     | P1: keep/remove assertions              | Tasks | Pending  |
| HOTSPOT-876     | P1: TESTING.md wire note                | Tasks | Pending  |
| HOTSPOT-877     | P1: Zero-network callout                | Tasks | Pending  |
| HOTSPOT-878     | P1: SECURITY.md                         | Tasks | Pending  |
| HOTSPOT-879     | P1: README → SECURITY link              | Tasks | Pending  |
| HOTSPOT-880     | P1: Baseline-in-artifacts               | Tasks | Pending  |
| HOTSPOT-881     | P1: `--only` ≠ baseline cross-link      | Tasks | Pending  |
| HOTSPOT-882     | P1: `files` includes SECURITY.md        | Tasks | Pending  |
| HOTSPOT-883–889 | Reserved                                | —     | Reserved |

**Coverage:** 23 mapped requirements + 7 reserved; all P1 criteria map to tasks below.

---

## Success Criteria

- [ ] `import { previewScanScope, runDoctor } from '@vitals/hotspot-scanner'` works after `pnpm build`
- [ ] Unknown config keys warn with `UNKNOWN_CONFIG_KEY` and never fail the scan alone
- [ ] `merge-heavy` integration tests green in CI gate
- [ ] `SECURITY.md` + README/recipes trust docs present and consistent with M41 baseline rules
- [ ] `pnpm build && pnpm test` green
