# Milestone 3 — Complexity Analyzer Specification

**Feature slug:** `complexity-analyzer`  
**Milestone:** ROADMAP M3  
**Design SoT:** [IMPL-2026-003 §4.3, §5.1, §7.1–7.2, §8.4, §9, §13](../../../specifications/IMPL-2026-003-hotspot-scanner.md) (RT-001, RT-002, RT-005)

## Problem Statement

The hotspot-scanner pipeline needs real cyclomatic complexity per file (AST-based, not LOC) to cross with Git churn in M4 scoring. Without the Complexity Analyzer, `HotspotScorer` has no complexity input and every downstream hotspot signal is incomplete.

M1 delivered the `ComplexityResult` domain type and a throwing stub in `src/complexity/index.ts`. `ts-morph` is planned but not yet a runtime dependency. The fixture directory `tests/fixtures/complexity/` exists empty. McCabe counting is a fragile area ([CONCERNS.md](../../codebase/CONCERNS.md) RT-005) — decision node definitions must be explicit and fixture-verified.

## Goals

- [x] ts-morph adapter for `.ts`/`.tsx`/`.js`/`.jsx` from working tree (not history)
- [x] Project-owned McCabe cyclomatic complexity with documented decision nodes
- [x] Invalid syntax: warning + skip file (do not abort scan)
- [x] Fixture TS files with manually verified McCabe values in `tests/fixtures/complexity/`
- [x] Functional `createComplexityAnalyzer().analyze()`; ≥80% line coverage on `src/complexity/**`

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| `hotspotScore` / normalization formulas | Milestone 4 — Scoring |
| Wiring into `runScan()` / CLI | M5/M6 — analyzer testable in isolation |
| Historical file versions from Git | IMPL §4.3 — working tree only |
| Intersection with Git Miner file paths | M4/M6 — M3 analyzes all eligible files under `repoPath` |
| Extension filter in Git Miner | M2 records all paths; M3 filters by extension at discovery |
| Worker-thread parallelization | Deferred in [STATE.md](../../project/STATE.md) |
| Exclusion of `node_modules` / `dist` | YAGNI v1 — no directory denylist unless added later |
| `commander`, reporter, JSON output | Milestone 5 — Reporter + CLI |
| Versioned Git fixture repo (`tests/fixtures/repos/`) | Milestone 6 — Integration |

---

## User Stories

### P1: ts-morph adapter and file discovery ⭐ MVP

**User Story**: As an implementer agent, I want `createComplexityAnalyzer().analyze()` to load TS/JS files from the working tree via ts-morph so that complexity is derived from real AST, not LOC proxies.

**Why P1**: ADR-2026-019 mandates ts-morph for AST access with project-owned McCabe; all scoring depends on this stage.

**Acceptance Criteria**:

1. WHEN `analyze({ repoPath })` is called on a valid directory THEN the analyzer SHALL recursively discover all `.ts`, `.tsx`, `.js`, and `.jsx` files under `repoPath`
2. WHEN a discovered file is loaded THEN the analyzer SHALL parse it via ts-morph from the working tree (not Git history)
3. WHEN `repoPath` does not exist or is not a directory THEN the analyzer SHALL reject with an error containing `repoPath`
4. WHEN a file has a non-eligible extension THEN the analyzer SHALL ignore it silently during discovery

**Independent Test**: Point analyzer at a temp directory with mixed extensions; assert only eligible files appear in results.

**Requirements**: HOTSPOT-19, HOTSPOT-20, HOTSPOT-25

---

### P1: McCabe decision nodes ⭐ MVP

**User Story**: As a scoring module consumer, I want cyclomatic complexity calculated with a documented, project-owned McCabe definition so that hotspot rankings are consistent and auditable.

**Why P1**: RT-005 — abandoned third-party complexity packages; project owns the decision node definition.

**Acceptance Criteria**:

1. WHEN a function body contains `if` or `else if` THEN each SHALL count as one decision node
2. WHEN a function body contains `for`, `while`, or `do-while` THEN each loop SHALL count as one decision node
3. WHEN a function body contains `switch` THEN each `case` and `default` clause SHALL count as one decision node (per-case, not block-level)
4. WHEN a function body contains `catch` THEN each `catch` clause SHALL count as one decision node
5. WHEN a condition expression contains `&&`, `||`, or `??` THEN each operator SHALL count as one decision node
6. WHEN a ternary expression appears in a function body THEN it SHALL count as one decision node
7. WHEN a function is analyzed THEN its cyclomatic complexity SHALL equal decision nodes + 1 (McCabe formula)

**Independent Test**: Unit tests on `mccabe.ts` with inline AST snippets or fixture files per construct.

**Requirements**: HOTSPOT-21

---

### P1: Per-file aggregation (sum) ⭐ MVP

**User Story**: As a scoring module consumer, I want `ComplexityResult` per file with summed function complexity so that files with many complex functions rank appropriately.

**Why P1**: Closed user decision — file-level metric reflects total decision-path load, not just the worst function.

**Acceptance Criteria**:

1. WHEN a file contains N top-level functions, methods, and assigned arrow functions THEN `functionCount` SHALL equal N
2. WHEN a file contains N functions with individual complexities C₁…Cₙ THEN `cyclomaticComplexity` SHALL equal C₁ + … + Cₙ (sum)
3. WHEN a file contains nested functions THEN each function SHALL be analyzed in its own scope; inner and outer complexities SHALL both contribute to the file sum
4. WHEN a file has no functions (types, constants, empty) THEN `cyclomaticComplexity` SHALL be 0 and `functionCount` SHALL be 0

**Independent Test**: Fixture `nested.ts` and `empty.ts` with documented expected sums.

**Requirements**: HOTSPOT-22, HOTSPOT-23

---

### P1: Invalid syntax — warn and skip ⭐ MVP

**User Story**: As a developer scanning a real repo, I want parse failures on individual files to produce warnings without aborting the entire analysis.

**Why P1**: IMPL §8.4 failure mode — one bad file must not block the scan (RT-002).

**Acceptance Criteria**:

1. WHEN ts-morph fails to parse a file THEN the analyzer SHALL add a warning string containing `filePath` and the parse error message to `ComplexityAnalyzerResult.warnings`
2. WHEN a file fails to parse THEN it SHALL be excluded from `results` (no `ComplexityResult` entry)
3. WHEN one file fails and others succeed THEN `analyze()` SHALL return results for valid files and warnings for invalid files without throwing
4. WHEN all files fail to parse THEN `analyze()` SHALL return empty `results` and non-empty `warnings` without throwing

**Independent Test**: Fixture `invalid-syntax.ts` alongside valid fixtures; assert partial results + warning.

**Requirements**: HOTSPOT-24

---

### P2: Batch processing (RT-001)

**User Story**: As a developer scanning a large repo, I want AST files processed in batches so that heap usage stays bounded.

**Why P2**: IMPL §7.2 — batch processing mitigates RT-001; not required for small fixture repos but needed for production scale.

**Acceptance Criteria**:

1. WHEN the analyzer processes more files than the configured batch size THEN it SHALL load and analyze files in batches (default batch size: 50)
2. WHEN batches are processed THEN the analyzer SHALL NOT load all source files into a single ts-morph `Project` instance at once

**Independent Test**: Unit test on `project.ts` asserting batch boundaries with a mock file list > batch size.

**Requirements**: HOTSPOT-26

---

### P1: Fixtures and coverage gate ⭐ MVP

**User Story**: As a CI maintainer, I want McCabe fixtures with manually verified values and ≥80% coverage on `src/complexity/**` so that complexity regressions are caught before scoring.

**Why P1**: TESTING.md mandates ≥80% on `src/complexity/**`; CONCERNS.md requires fixture coverage for fragile areas.

**Acceptance Criteria**:

1. WHEN listing `tests/fixtures/complexity/` THEN files SHALL exist for: if/else, switch, loops, try/catch, logical operators, ternary, nested functions, empty file, and invalid syntax
2. WHEN each fixture is analyzed THEN observed McCabe values SHALL match the expected values documented in the fixture header comment
3. WHEN `pnpm test` runs with coverage THEN `src/complexity/**` SHALL report ≥80% line coverage
4. WHEN `pnpm build && pnpm test` runs THEN all tests SHALL pass with zero regressions

**Independent Test**: `pnpm build && pnpm test` + coverage report for `src/complexity/`.

**Requirements**: HOTSPOT-27, HOTSPOT-28

---

## Edge Cases

- WHEN a file is empty THEN `cyclomaticComplexity` SHALL be 0 and `functionCount` SHALL be 0
- WHEN a `switch` has a `default` clause THEN `default` SHALL count as one decision node (same as a `case`)
- WHEN an arrow function is assigned to a `const` THEN it SHALL be counted as a function
- WHEN a class method is defined THEN it SHALL be counted as a function in `functionCount`
- WHEN `.jsx`/`.tsx` contains JSX markup THEN complexity SHALL reflect JS/TS logic only (JSX elements are not extra decision nodes unless they embed expressions with decision logic)
- WHEN valid and invalid files are analyzed together THEN system SHALL return partial `results` and `warnings` for failures
- WHEN a nested function exists inside another function THEN each scope SHALL be analyzed independently; both complexities SHALL contribute to the file sum
- WHEN `else if` appears THEN it SHALL count as a decision node (equivalent to `if` in McCabe)
- WHEN a file path contains spaces or unicode THEN discovery and analysis SHALL handle it correctly

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-19 | P1: ts-morph adapter and file discovery | Tasks T1, T5 | Done |
| HOTSPOT-20 | P1: ts-morph adapter and file discovery | Tasks T2, T5 | Done |
| HOTSPOT-21 | P1: McCabe decision nodes | Tasks T3, T7 | Done |
| HOTSPOT-22 | P1: Per-file aggregation (sum) | Tasks T4, T5 | Done |
| HOTSPOT-23 | P1: Per-file aggregation (sum) | Tasks T4, T5 | Done |
| HOTSPOT-24 | P1: Invalid syntax — warn and skip | Tasks T5, T7 | Done |
| HOTSPOT-25 | P1: ts-morph adapter and file discovery | Tasks T2 | Done |
| HOTSPOT-26 | P2: Batch processing | Tasks T1 | Done |
| HOTSPOT-27 | P1: Fixtures and coverage gate | Tasks T6, T7 | Done |
| HOTSPOT-28 | P1: Fixtures and coverage gate | Tasks T8 | Done |

**Coverage:** 10 total, 10 mapped to tasks, 0 unmapped

---

## Success Criteria

- [x] All P1 acceptance criteria verifiable via Vitest + fixtures (no human judgment)
- [x] `pnpm build && pnpm test` passes after Execute
- [x] `src/complexity/**` ≥80% line coverage per [TESTING.md](../../codebase/TESTING.md)
- [x] ts-morph imported only inside `src/complexity/` ([INTEGRATIONS.md](../../codebase/INTEGRATIONS.md))
- [x] `orchestrator-implementer` can execute T1–T8 without ambiguous scope
