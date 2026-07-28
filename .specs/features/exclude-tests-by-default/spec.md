# Milestone 46 — Exclude Tests by Default Specification

**Feature slug:** `exclude-tests-by-default`  
**Milestone:** ROADMAP M46  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md)  
**Context:** [`.specs/features/exclude-tests-by-default/context.md`](./context.md) — all product decisions locked  
**Sisters:** [path-scoping](../path-scoping/spec.md) (M7), [path-config-dx](../path-config-dx/spec.md) (M30), [cli-init-doctor-dry-run](../cli-init-doctor-dry-run/spec.md) (M39 dry-run)  
**Depth:** Large  
**Requirement IDs:** HOTSPOT-640 … HOTSPOT-659 (gaps OK)

## Problem Statement

Dogfooding shows co-located tests (`src/*.test.ts`, `bin/*.test.ts`, etc.) ranking as top hotspots because they churn with every feature. Product recipes already recommend `--exclude "**/*.test.ts"`, but the default still includes tests. Maintenance triage should focus on application source by default, with an explicit opt-in when auditing test-suite health.

## Goals

- [x] Exclude locked test patterns from PathScope by default (git filter, complexity discovery, eligible counts)
- [x] Opt-in `--include-tests` / `ScanOptions.includeTests` lifts **only** built-in test patterns (artifact defaults + user excludes remain)
- [x] Wire through `createPathScope`, `runScan`, `previewScanScope`, CLI `scan` / `baseline save` / `compare`
- [x] Document breaking default + recipes/README/ARCHITECTURE; JSON contract unchanged
- [x] `pnpm build && pnpm test` green after Execute

## Out of Scope

| Feature                                                  | Reason                                               |
| -------------------------------------------------------- | ---------------------------------------------------- |
| `--no-default-excludes`                                  | M7 locked — forbidden                                |
| Config key `includeTests`                                | CLI/API only (like `--quiet`)                        |
| `.mts` / `.cts` test suffixes                            | Eligible extensions remain `.ts`/`.tsx`/`.js`/`.jsx` |
| New fixture repo under `tests/fixtures/repos/`           | Unit + CLI/preview tests suffice                     |
| JSON Schema / `version` bump                             | Ranking population changes; contract shape unchanged |
| Scoring / McCabe / coupling formula changes              | Path filter only                                     |
| Removing user ability to `--exclude` tests when included | User excludes stay additive                          |

---

## User Stories

### P1: Tests excluded by default ⭐ MVP

**User Story**: As a developer running `hotspot-scanner scan`, I want test files excluded by default so rankings reflect application maintenance hotspots, not test churn.

**Why P1**: Core product change; intentional breaking default.

**Acceptance Criteria**:

1. WHEN `createPathScope()` is called with no options (or `includeTests` omitted/false) THEN compiled excludes SHALL include all `DEFAULT_ARTIFACT_EXCLUDE_PATTERNS` **and** all `DEFAULT_TEST_EXCLUDE_PATTERNS` from [context.md](./context.md)
2. WHEN evaluating paths such as `src/scan.test.ts`, `bin/hotspot-scanner.test.ts`, `packages/ui/Button.spec.tsx`, or `src/__tests__/foo.ts` under the default scope THEN `isPathInScope` SHALL return `false`
3. WHEN walking discovery THEN directories matching `**/__tests__/**` SHALL be pruned via `shouldPruneDirectory` consistently with existing exclude prune semantics
4. WHEN M7/M30 artifact defaults are present THEN they SHALL remain always-on and unchanged by this milestone’s test split
5. WHEN a default scan runs (`runScan` without `includeTests`) THEN git-filtered stats and complexity discovery SHALL omit those test paths (same `PathScope` instance)

**Independent Test**: Unit tests on `DEFAULT_*` exports + `isPathInScope` / `shouldPruneDirectory` with representative paths; no new fixture repo required.

**Requirements**: HOTSPOT-640, HOTSPOT-641, HOTSPOT-642, HOTSPOT-643

---

### P1: Opt-in `--include-tests` / `includeTests` ⭐ MVP

**User Story**: As a developer auditing test-suite health, I want `--include-tests` so built-in test excludes are lifted while artifact defaults and my own `--exclude` patterns still apply.

**Why P1**: Required escape hatch for the minority audit case.

**Acceptance Criteria**:

1. WHEN `createPathScope({ includeTests: true })` is used THEN excludes SHALL be `DEFAULT_ARTIFACT_EXCLUDE_PATTERNS` + user `exclude` only (no `DEFAULT_TEST_EXCLUDE_PATTERNS`)
2. WHEN `includeTests: true` **and** user/config `exclude` includes e.g. `**/*.test.ts` THEN that user pattern SHALL still exclude matching paths (additive; not cleared)
3. WHEN `ScanOptions.includeTests` is `true` THEN `runScan` and `previewScanScope` SHALL pass it into `createPathScope`
4. WHEN `includeTests` is omitted or `false` THEN behavior SHALL match P1 default (tests excluded)
5. WHEN `includeTests` is set THEN it SHALL **not** appear as a `.hotspot-scanner.json` config key (no merge from config; CLI/API only)

**Independent Test**: Unit cases for `includeTests: true` with and without user exclude; assert config merge ignores any accidental key if present in fixtures (config schema unchanged — unknown keys already rejected or ignored per M21; do not add key).

**Requirements**: HOTSPOT-644, HOTSPOT-645, HOTSPOT-646

---

### P1: CLI surface — scan / baseline save / compare ⭐ MVP

**User Story**: As a CLI user, I want `--include-tests` on `scan`, `baseline save`, and `compare` so every scan entry point shares the same opt-in.

**Why P1**: M40 workflow verbs must not silently diverge from `scan`.

**Acceptance Criteria**:

1. WHEN `hotspot-scanner scan … --include-tests` is invoked THEN `runScan` / dry-run preview SHALL receive `includeTests: true`
2. WHEN `hotspot-scanner baseline save … --include-tests` is invoked THEN the saved baseline SHALL be produced with tests in scope (same PathScope policy)
3. WHEN `hotspot-scanner compare … --include-tests` is invoked THEN the current scan leg SHALL use `includeTests: true` (baseline file contents unchanged; compare uses current scan options)
4. WHEN `--include-tests` is omitted THEN all three commands SHALL use default test exclusion
5. WHEN `scan --help` (and baseline/compare help as applicable) is shown THEN `--include-tests` SHALL be listed with a short description
6. WHEN `--include-tests` is combined with user `--exclude` THEN both SHALL apply per P1 opt-in rules

**Independent Test**: CLI unit tests in `bin/hotspot-scanner.test.ts` asserting flag parse + forward into scan helpers (mock/`buildScanOptions` / spy as existing patterns).

**Requirements**: HOTSPOT-647, HOTSPOT-648, HOTSPOT-649

---

### P1: Dry-run preview reflects test policy ⭐ MVP

**User Story**: As an operator using `scan --dry-run`, I want to see whether test files are excluded or included so I can confirm scope before a full mine.

**Why P1**: M39 dry-run exists to preview effective scope; breaking default must be visible.

**Acceptance Criteria**:

1. WHEN `previewScanScope` / `formatScanScopePreview` runs with default options THEN preview text SHALL indicate tests are excluded (stable phrasing locked in design, e.g. `test files: excluded`)
2. WHEN `includeTests: true` / `--include-tests` THEN preview text SHALL indicate tests are included (e.g. `test files: included`)
3. WHEN default excludes apply THEN `eligibleFileCount` SHALL already omit test paths (count consistency with PathScope)
4. WHEN dry-run runs THEN it SHALL still not invoke mine/AST/scoring (M39 unchanged)

**Independent Test**: `src/scan-preview.test.ts` assertions on formatted preview lines + eligible count with a temp tree containing a `*.test.ts` and a non-test `.ts`.

**Requirements**: HOTSPOT-650, HOTSPOT-651

---

### P1: Documentation & living architecture ⭐ MVP

**User Story**: As a new adopter, I want README, recipes, and ARCHITECTURE to describe tests-excluded-by-default and `--include-tests` so I do not copy obsolete `--exclude "**/*.test.ts"` recipes.

**Why P1**: Recipes currently recommend redundant test excludes; docs must match product.

**Acceptance Criteria**:

1. WHEN reading ARCHITECTURE PathScope section THEN default excludes SHALL list artifact patterns **and** test patterns, plus `--include-tests` semantics
2. WHEN reading README path-scoping / CLI flags THEN `--include-tests` SHALL be documented
3. WHEN reading `docs/recipes.md` THEN weekly triage SHALL **not** require `--exclude "**/*.test.ts"` for the default case; SHALL show `--include-tests` for test-suite audits; monorepo examples SHALL drop redundant test-only excludes where defaults cover them
4. WHEN STATE.md is updated THEN the intentional breaking default SHALL be recorded in the decision log

**Independent Test**: Docs review in Execute (no automated doc tests); checklist in Done when.

**Requirements**: HOTSPOT-652, HOTSPOT-653, HOTSPOT-654

---

### P2: Constant re-exports for library consumers

**User Story**: As a programmatic API user, I want `DEFAULT_TEST_EXCLUDE_PATTERNS` (and artifact split) exported from `src/paths` so I can inspect or compose scopes.

**Why P2**: Nice for transparency; `DEFAULT_EXCLUDE_PATTERNS` already exported.

**Acceptance Criteria**:

1. WHEN importing from `src/paths` (or public paths barrel) THEN `DEFAULT_ARTIFACT_EXCLUDE_PATTERNS` and `DEFAULT_TEST_EXCLUDE_PATTERNS` SHALL be available
2. WHEN `DEFAULT_EXCLUDE_PATTERNS` is read THEN it SHALL equal `[...artifact, ...test]` (order: artifact then test)

**Independent Test**: Unit assertion on exports equality.

**Requirements**: HOTSPOT-655

---

## Edge Cases

- WHEN path is `src/testing/helpers.ts` (no `.test.` / `.spec.` / `__tests__`) THEN it SHALL remain in scope by default (do not over-exclude “testing” directories by name alone)
- WHEN path is `src/foo.test.ts.bak` or non-eligible extension THEN eligibility remains extension-gated as today (test patterns only affect PathScope exclude matchers)
- WHEN `--include src/**` is set without `--include-tests` THEN test files under `src/` matching test patterns SHALL still be excluded (exclude wins)
- WHEN `--include-tests` + `--include src/**` THEN non-excluded tests under `src/` MAY enter scope
- WHEN user `--exclude "src/**"` with `--include-tests` THEN user exclude still wins for `src/**`
- WHEN compare uses a baseline scanned **before** this milestone (tests included) vs current default (tests excluded) THEN deltas may show many “removed” test hotspots — document as expected migration note in README/recipes (no auto-migration)

---

## Requirement Traceability

| Requirement ID | Story                                              | Phase | Status |
| -------------- | -------------------------------------------------- | ----- | ------ |
| HOTSPOT-640    | P1: Default test excludes in constants             | Tasks | Done   |
| HOTSPOT-641    | P1: `isPathInScope` excludes test paths by default | Tasks | Done   |
| HOTSPOT-642    | P1: `__tests__` directory prune                    | Tasks | Done   |
| HOTSPOT-643    | P1: Artifact defaults unchanged / always on        | Tasks | Done   |
| HOTSPOT-644    | P1: `includeTests: true` lifts test defaults only  | Tasks | Done   |
| HOTSPOT-645    | P1: User exclude still additive with includeTests  | Tasks | Done   |
| HOTSPOT-646    | P1: `ScanOptions.includeTests` → createPathScope   | Tasks | Done   |
| HOTSPOT-647    | P1: CLI `--include-tests` on scan                  | Tasks | Done   |
| HOTSPOT-648    | P1: CLI on baseline save + compare                 | Tasks | Done   |
| HOTSPOT-649    | P1: Help lists `--include-tests`                   | Tasks | Done   |
| HOTSPOT-650    | P1: Dry-run shows test policy line                 | Tasks | Done   |
| HOTSPOT-651    | P1: Dry-run eligible count respects scope          | Tasks | Done   |
| HOTSPOT-652    | P1: ARCHITECTURE PathScope docs                    | Tasks | Done   |
| HOTSPOT-653    | P1: README CLI / path scoping                      | Tasks | Done   |
| HOTSPOT-654    | P1: recipes.md + STATE decision                    | Tasks | Done   |
| HOTSPOT-655    | P2: Export artifact/test constant split            | Tasks | Done   |
| HOTSPOT-656    | Cross-cutting — no config key / no schema change   | Tasks | Done   |
| HOTSPOT-657    | Cross-cutting — full project gate                  | Tasks | Done   |

**Coverage:** 18 total (HOTSPOT-640–657; 658–659 reserved), mapped in tasks.md.

---

## Success Criteria

- [x] Default dogfood scan of this repo’s top table has no `*.test.ts` / `*.spec.*` / `__tests__` paths
- [x] `--include-tests` can restore test paths in rankings when desired
- [x] Dry-run text makes the policy obvious
- [x] Recipes no longer tell users to manually exclude the default test set
- [x] `pnpm build && pnpm test` passes
