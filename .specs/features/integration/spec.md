# Milestone 6 — Integration Specification

**Feature slug:** `integration`  
**Milestone:** ROADMAP M6  
**Design SoT:** [IMPL-2026-003 §4, §7, §8.4, §9](../../../specifications/IMPL-2026-003-hotspot-scanner.md)  
**Context:** [`.specs/features/integration/context.md`](./context.md)

## Problem Statement

M2–M4 delivered domain modules (git miner, complexity analyzer, scoring) and M5 delivered the Reporter + CLI layer with diagnostics hooks. `runScan()` in `src/scan.ts` still returns empty `hotspots` and `coupling` arrays — the CLI cannot produce real maintenance rankings from a repository.

M6 wires the full pipeline: git log streaming → McCabe complexity → hotspot and coupling scoring → typed `ScanResult`. It adds a versioned Git fixture repo for end-to-end validation and documents a manual performance benchmark procedure before declaring v1 ready (IMPL §9, RT-001).

## Goals

- [x] Wire `runScan()` with `createGitMiner`, `createComplexityAnalyzer`, `createHotspotScorer`, and `createTemporalCouplingScorer`
- [x] Forward warnings (git + complexity) and progress (git) via `ScanOptions` callbacks
- [x] Versioned Git fixture `tests/fixtures/repos/small-ts/` with deterministic integration test assertions
- [x] `pnpm build && pnpm test` passing with `src/scan.ts` covered under `vitest.config.ts` per-file thresholds
- [x] Manual performance benchmark procedure documented (not CI)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| New scoring formulas or normalization strategy | M4 closed — [scoring/spec.md](../scoring/spec.md) |
| Reporter table/JSON changes or new CLI flags | M5 closed — [reporter-cli/spec.md](../reporter-cli/spec.md) |
| Intersection filter at orchestration (restrict complexity to git-touched paths only) | YAGNI — M4 uses `ComplexityResult[]` as hotspot driver; missing git stats → churn 0 ([context.md](./context.md) C1) |
| Worker-thread parallelization | Deferred in [STATE.md](../../project/STATE.md) |
| CI fail thresholds / non-zero exit on high hotspot score | IMPL §6.2 non-goal |
| Configurable scan timeout | IMPL [CLARIFICAR] — YAGNI v1 |
| `authors` field in JSON output | STATE.md — not exposed in v1 |
| Benchmark time threshold in CI | IMPL §9 — manual qualitative check only |

---

## User Stories

### P1: Pipeline orchestration ⭐ MVP

**User Story**: As a developer running hotspot-scanner, I want `runScan()` to execute the full git → complexity → scoring pipeline so that I receive real hotspot and coupling rankings for a repository.

**Why P1**: Core value proposition per IMPL §4 and [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md); all upstream modules exist but are not connected.

**Acceptance Criteria**:

1. WHEN `runScan({ repoPath })` is called on a valid Git repository THEN it SHALL invoke `createGitMiner().mine()` with `repoPath` and resolved `since`
2. WHEN git mining completes THEN `runScan()` SHALL invoke `createComplexityAnalyzer().analyze({ repoPath })`
3. WHEN complexity analysis completes THEN `runScan()` SHALL invoke `createHotspotScorer().score(fileStats, complexityResults)` and `createTemporalCouplingScorer().score(coChangeEvents, fileStats, minCochange)`
4. WHEN the pipeline succeeds THEN the returned `ScanResult` SHALL include sorted `hotspots` and `coupling` arrays (full lists — reporter applies `--top`)
5. WHEN `since` is omitted THEN `meta.since` SHALL equal `DEFAULT_SINCE` (`"12 months ago"`)
6. WHEN `minCochange` is omitted THEN coupling scorer SHALL receive `DEFAULT_MIN_COCHANGE` (`3`)
7. WHEN pipeline completes THEN `meta.scannedAt` SHALL be a valid ISO-8601 timestamp

**Independent Test**: Integration test on `tests/fixtures/repos/small-ts/` asserting non-empty rankings and stable top entries.

**Requirements**: HOTSPOT-51

---

### P1: Diagnostics forwarding ⭐ MVP

**User Story**: As a developer scanning a large repository, I want warnings and progress from upstream modules forwarded through `ScanOptions` callbacks so that I receive feedback during long scans without coupling modules to stderr directly.

**Why P1**: M5 wired CLI → `onWarning` / `onProgress`; M6 must forward module events per [reporter-cli/design.md](../reporter-cli/design.md) D11.

**Acceptance Criteria**:

1. WHEN `GitMinerResult.warnings` is non-empty AND `options.onWarning` is provided THEN each warning string SHALL be passed to `onWarning` in order
2. WHEN `ComplexityAnalyzerResult.warnings` is non-empty AND `options.onWarning` is provided THEN each warning string SHALL be passed to `onWarning` in order
3. WHEN `options.onProgress` is provided THEN it SHALL be forwarded to `GitMinerOptions.onProgress` during mining
4. WHEN `onWarning` or `onProgress` is omitted THEN the pipeline SHALL complete without error (callbacks optional)

**Independent Test**: Unit or integration test with `vi.fn()` callbacks on a fixture that produces at least one warning or progress event.

**Requirements**: HOTSPOT-52

---

### P1: Git and path failure handling ⭐ MVP

**User Story**: As a developer, I want clear errors when the repository path is invalid or `git log` fails so that misconfiguration is obvious before interpreting empty results.

**Why P1**: IMPL §8.4 exit semantics; AGENTS.md defines `!= 0` for git/path errors.

**Acceptance Criteria**:

1. WHEN `repoPath` does not exist or is not a directory THEN `runScan()` SHALL throw before invoking git (existing M5 behavior preserved)
2. WHEN `git log` subprocess fails THEN `runScan()` SHALL throw an `Error` whose message includes `repoPath` and indicates git failure
3. WHEN `runScan()` throws THEN CLI SHALL exit with code `!= 0` and print message to stderr

**Independent Test**: `scan.test.ts` for path validation; git failure test via non-git directory or mocked spawn at `GitMiner` boundary if needed.

**Requirements**: HOTSPOT-53

---

### P1: Versioned fixture repo `small-ts` ⭐ MVP

**User Story**: As a test author, I want a minimal versioned Git repository under `tests/fixtures/repos/small-ts/` so that integration tests run deterministically without network or external repos.

**Why P1**: IMPL §9 integration layer; [TESTING.md](../../codebase/TESTING.md) § Test layers.

**Acceptance Criteria**:

1. WHEN fixture is present THEN `tests/fixtures/repos/small-ts/` SHALL be a real Git repository committed to the project (`.git/` versioned)
2. WHEN fixture is scanned THEN it SHALL contain at least 3 TypeScript source files with varied McCabe complexity
3. WHEN fixture history is inspected THEN at least one pair of files SHALL co-change ≥ `DEFAULT_MIN_COCHANGE` times within the default `--since` window
4. WHEN fixture README is read THEN it SHALL document purpose, validation command, and expected top hotspot file
5. WHEN fixture uses fixed commit dates THEN `--since "12 months ago"` SHALL include all fixture commits on any test run date within the project lifetime (use recent fixed dates)

**Independent Test**: Fixture README + directory structure review; integration test consumes fixture.

**Requirements**: HOTSPOT-54

---

### P1: Integration test assertions ⭐ MVP

**User Story**: As a CI maintainer, I want Vitest integration tests that call `runScan()` on `small-ts` with deterministic assertions so that pipeline regressions are caught automatically.

**Why P1**: [fragile-areas.mdc](../../../.cursor/rules/fragile-areas.mdc) — `src/scan.ts` stage order changes require updated integration tests.

**Acceptance Criteria**:

1. WHEN `runScan({ repoPath: small-ts })` runs THEN `hotspots.length` SHALL be ≥ 1
2. WHEN rankings are produced THEN `hotspots[0].filePath` SHALL match the documented expected top file from fixture README
3. WHEN coupling is scored THEN `coupling.length` SHALL be ≥ 1 with `coChangeCount >= DEFAULT_MIN_COCHANGE`
4. WHEN integration test runs THEN it SHALL NOT mock `GitMiner` or `ComplexityAnalyzer` (real fixture, real git)
5. WHEN `src/scan.test.ts` is updated THEN path-validation tests from M5 SHALL remain passing

**Independent Test**: `src/scan.integration.test.ts` (or equivalent co-located integration file).

**Requirements**: HOTSPOT-55

---

### P1: CLI validation on fixture ⭐ MVP

**User Story**: As a developer validating the CLI manually or in CI, I want `hotspot-scanner scan tests/fixtures/repos/small-ts` to exit 0 and produce parseable output so that the full bin → scan → reporter path is verified.

**Why P1**: AGENTS.md validation; skill `vitals-cli-validation`.

**Acceptance Criteria**:

1. WHEN `pnpm exec hotspot-scanner scan tests/fixtures/repos/small-ts` runs THEN exit code SHALL be `0`
2. WHEN `--format json` is used THEN stdout SHALL be valid JSON with `version`, `hotspots`, `coupling`, and `meta` fields
3. WHEN `--format table` is used THEN stdout SHALL include a since header and at least one hotspot row
4. WHEN CLI integration test runs THEN it SHALL use the built `dist/` binary or `runCli` with real fixture path (not mocked `runScan`)

**Independent Test**: `bin/hotspot-scanner.integration.test.ts` or extended CLI test file.

**Requirements**: HOTSPOT-56

---

### P1: Coverage and quality gate ⭐ MVP

**User Story**: As a CI maintainer, I want `pnpm build && pnpm test` passing with `src/scan.ts` meeting per-file coverage thresholds so that M6 regressions are caught before release.

**Why P1**: [TESTING.md](../../codebase/TESTING.md) and workspace quality-gates rule.

**Acceptance Criteria**:

1. WHEN `pnpm build && pnpm test` runs THEN all tests SHALL pass
2. WHEN coverage is measured THEN every included source file SHALL meet `vitest.config.ts` per-file thresholds (90% lines/functions, 80% branches/statements)
3. WHEN M6 completes THEN [ROADMAP.md](../../project/ROADMAP.md) M6 SHALL link to this spec
4. WHEN M6 completes THEN [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md) SHALL describe `runScan()` as the pipeline orchestrator (not stub)

**Independent Test**: Full project gate.

**Requirements**: HOTSPOT-60

---

### P2: Fixture `with-renames`

**User Story**: As a test author, I want `tests/fixtures/repos/with-renames/` validating churn continuity across rename chains so that RT-003 behavior is regression-tested end-to-end.

**Why P2**: IMPL §9 rename case; P1 `small-ts` covers basic E2E only.

**Acceptance Criteria**:

1. WHEN fixture history includes a file renamed multiple times THEN scan SHALL attribute churn to the canonical current path
2. WHEN rename ambiguity exists THEN scan MAY emit rename warnings via `onWarning` without aborting

**Independent Test**: Integration test on `with-renames` fixture (optional P2 gate).

**Requirements**: HOTSPOT-57

---

### P2: Fixture `merge-heavy`

**User Story**: As a test author, I want `tests/fixtures/repos/merge-heavy/` with merge commits and file deletes so that git miner edge cases are validated in a full scan.

**Why P2**: Complements unit fixtures in `tests/fixtures/git-log/` with E2E coverage.

**Acceptance Criteria**:

1. WHEN fixture includes merge commits THEN scan SHALL complete with exit 0
2. WHEN deleted files appear in history THEN they SHALL not break hotspot ranking for surviving files

**Independent Test**: Integration test on `merge-heavy` fixture (optional P2 gate).

**Requirements**: HOTSPOT-58

---

### P2: Manual performance benchmark

**User Story**: As a maintainer preparing v1, I want a documented manual benchmark procedure for a large synthetic repository so that RT-001 performance risk is assessed before release.

**Why P2**: IMPL §9 performance layer — not in CI.

**Acceptance Criteria**:

1. WHEN benchmark procedure is documented THEN it SHALL describe how to generate or use a large repo (e.g., many commits / files)
2. WHEN benchmark is run manually THEN operator SHALL record elapsed time and commit count processed
3. WHEN benchmark script exists THEN it SHALL NOT be part of `pnpm test` (no CI gate on milliseconds)

**Independent Test**: Procedure review; optional manual run recorded in task notes.

**Requirements**: HOTSPOT-59

---

## Edge Cases

- WHEN repository has no commits in `--since` window THEN scan SHALL complete with empty rankings and git miner warning (existing M2 behavior)
- WHEN repository has TS files with no git history THEN those files MAY appear in hotspots with churn 0
- WHEN all complexity values are equal THEN hotspot scores MAY all be 0 (M4 degenerate normalization)
- WHEN `top` is passed to `runScan()` THEN it SHALL NOT slice results (reporter/CLI owns display limit per M5 D3)
- WHEN complexity analyzer skips invalid-syntax files THEN scan SHALL continue; warnings forwarded if callback set
- WHEN fixture repo is scanned with `--since` wider than fixture age THEN all fixture commits SHALL be included

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-51 | P1: Pipeline orchestration | Tasks T3 | Done |
| HOTSPOT-52 | P1: Diagnostics forwarding | Tasks T3 | Done |
| HOTSPOT-53 | P1: Git/path failure handling | Tasks T3, T4 | Done |
| HOTSPOT-54 | P1: Fixture `small-ts` | Tasks T1 | Done |
| HOTSPOT-55 | P1: Integration test assertions | Tasks T4 | Done |
| HOTSPOT-56 | P1: CLI validation on fixture | Tasks T5 | Done |
| HOTSPOT-57 | P2: Fixture `with-renames` | Tasks T6 | Done |
| HOTSPOT-58 | P2: Fixture `merge-heavy` | Tasks T6 | Done |
| HOTSPOT-59 | P2: Manual benchmark | Tasks T2 | Done |
| HOTSPOT-60 | P1: Coverage gate | Tasks T7 | Done |

**Coverage:** 10 total, 10 mapped to tasks, 0 unmapped

---

## Success Criteria

- [x] All P1 acceptance criteria verifiable via Vitest + fixture (benchmark P2 excepted)
- [x] `pnpm build && pnpm test` passes after Execute
- [x] `orchestrator-implementer` can execute T1–T7 without ambiguous scope
- [x] `pnpm exec hotspot-scanner scan tests/fixtures/repos/small-ts` prints real rankings
- [x] No new runtime dependencies without [INTEGRATIONS.md](../../codebase/INTEGRATIONS.md) update
