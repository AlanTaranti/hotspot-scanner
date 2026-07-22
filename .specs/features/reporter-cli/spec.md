# Milestone 5 — Reporter + CLI Specification

**Feature slug:** `reporter-cli`  
**Milestone:** ROADMAP M5  
**Design SoT:** [IMPL-2026-003 §4.3, §6.1, §6.2, §8.5, §9](../../../specifications/IMPL-2026-003-hotspot-scanner.md)  
**Context:** [`.specs/features/reporter-cli/context.md`](./context.md)

## Problem Statement

M1–M4 delivered domain modules (git miner, complexity analyzer, scoring) and typed contracts, but the CLI still accepts only `scan <path>`, `createReporter()` throws, and `runScan()` returns empty rankings. Developers cannot view hotspot or coupling results, configure scan windows, or receive progress/warning feedback during long scans.

M5 delivers the user-facing Reporter and CLI layer plus diagnostics infrastructure. Full git→complexity→scoring pipeline wiring remains M6; M5 validates output and flags on stub/empty `ScanResult` and independently testable module pieces.

## Goals

- [ ] CLI table output: top hotspots + top coupling pairs (separate sections)
- [ ] JSON output: `version`, `hotspots`, `coupling`, `meta` (includes `since` window)
- [ ] Flags: `--since`, `--format`, `--top`, `--min-cochange` with documented defaults
- [ ] Progress and warning logs on `stderr` for large-repo UX (IMPL §8.5)
- [ ] `commander` dependency for CLI parsing (per INTEGRATIONS.md)
- [ ] `GitMiner` progress callback hook (tested with mocked stream; full E2E in M6)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| Full `runScan()` pipeline (git → complexity → scoring) | Milestone 6 — Integration |
| Versioned Git fixture repo E2E (`tests/fixtures/repos/`) | Milestone 6 |
| Coverage ≥80% on `src/git/**` or `src/scoring/**` (already M2/M4) | No regression; M5 targets `src/report/**`, `src/diagnostics/**` |
| `authors` field in JSON output | STATE.md — not exposed in v1 |
| Raw `cyclomaticComplexity` / `commitCount` in JSON | M4 deferred; reporter uses scored types only |
| Worker-thread parallelization | Deferred in STATE.md |
| CI fail thresholds / non-zero exit on high hotspot score | IMPL §6.2 non-goal |
| Configurable progress throttle interval flag | YAGNI — hardcode sensible default (e.g., every 1000 commits) |

---

## User Stories

### P1: CLI flags and defaults ⭐ MVP

**User Story**: As a developer running hotspot-scanner, I want `scan <path>` with `--since`, `--format`, `--top`, and `--min-cochange` flags so that I can control history window, output format, ranking depth, and coupling sensitivity.

**Why P1**: IMPL §6.1 defines the CLI contract; all reporting depends on parsed options.

**Acceptance Criteria**:

1. WHEN `hotspot-scanner scan <path>` runs without flags THEN CLI SHALL pass `since: "12 months ago"`, `format: "table"`, `top: 20` (pending user confirmation in context.md), and `minCochange: 3` to `runScan()`
2. WHEN `--since "6 months ago"` is provided THEN `runScan()` SHALL receive that exact string
3. WHEN `--format json` is provided THEN output SHALL be JSON on stdout
4. WHEN `--format table` is provided or omitted THEN output SHALL be CLI tables on stdout
5. WHEN `--top <N>` is provided THEN reporter SHALL limit both hotspot and coupling arrays to N items
6. WHEN `--min-cochange <N>` is provided THEN `runScan()` SHALL receive that value (used by pipeline in M6; accepted and stored in M5)

**Independent Test**: Vitest CLI tests with mocked `runScan` / `createReporter` asserting parsed options.

**Requirements**: HOTSPOT-39, HOTSPOT-40

---

### P1: CLI validation and exit codes ⭐ MVP

**User Story**: As a developer, I want clear errors for invalid invocations so that misconfiguration is obvious before a long scan.

**Why P1**: IMPL §8.4 and AGENTS.md define exit code semantics.

**Acceptance Criteria**:

1. WHEN argv is missing `scan` command or `<path>` argument THEN CLI SHALL print usage to stderr and exit with code `2`
2. WHEN `--format` is not `table` or `json` THEN CLI SHALL print error to stderr and exit with code `!= 0`
3. WHEN `--top` or `--min-cochange` is not a positive integer THEN CLI SHALL print error to stderr and exit with code `!= 0`
4. WHEN scan completes successfully THEN CLI SHALL exit with code `0`
5. WHEN `repoPath` does not exist or is not a directory THEN CLI SHALL exit with code `!= 0` before scan (basic path validation in `runScan()`)

**Independent Test**: Vitest with mocked `process.exit` and stderr capture.

**Requirements**: HOTSPOT-41

---

### P1: JSON reporter ⭐ MVP

**User Story**: As a developer integrating with other tools, I want `--format json` output matching the versioned schema so that I can parse rankings programmatically.

**Why P1**: IMPL §6.2 JSON schema; primary machine-readable output.

**Acceptance Criteria**:

1. WHEN reporter renders JSON THEN output SHALL be valid JSON with top-level fields `version`, `hotspots`, `coupling`, and `meta`
2. WHEN `version` is present THEN its value SHALL be `"1.0"`
3. WHEN `hotspots` is serialized THEN each entry SHALL include `filePath`, `complexityNormalized`, `churnNormalized`, `hotspotScore` (no `authors`)
4. WHEN `coupling` is serialized THEN each entry SHALL include `fileA`, `fileB`, `coChangeCount`, `couplingStrength`
5. WHEN `meta` is serialized THEN it SHALL include `since` and `scannedAt` (ISO-8601)
6. WHEN `--top N` is set THEN JSON arrays SHALL contain at most N items each (sliced from already-sorted input)
7. WHEN input arrays are empty THEN JSON SHALL still include empty arrays and valid `meta`

**Independent Test**: Unit tests on `renderJson()` with fixture `ScanResult`.

**Requirements**: HOTSPOT-42, HOTSPOT-45

---

### P1: Table reporter ⭐ MVP

**User Story**: As a developer triaging maintenance risk, I want human-readable tables for top hotspots and top coupling pairs so that I can scan results quickly in the terminal.

**Why P1**: IMPL §4.3 Reporter; default output format.

**Acceptance Criteria**:

1. WHEN reporter renders table format THEN output SHALL include a header line showing the scan window (`meta.since`)
2. WHEN hotspots exist THEN output SHALL include a **Top Hotspots** section with columns: rank, file path, hotspot score, complexity (normalized), churn (normalized)
3. WHEN coupling pairs exist THEN output SHALL include a separate **Top Coupling Pairs** section with columns: rank, file A, file B, coupling strength, co-change count
4. WHEN `--top N` is set THEN each section SHALL show at most N rows
5. WHEN hotspots or coupling arrays are empty THEN the corresponding section SHALL indicate no results (e.g., `(none)`) without throwing
6. WHEN scores are displayed THEN numeric values SHALL use fixed decimal formatting (e.g., 4 decimal places) for stable test assertions

**Independent Test**: Unit tests on `renderTable()` with fixture `ScanResult` asserting substring content and row counts.

**Requirements**: HOTSPOT-43, HOTSPOT-44, HOTSPOT-45

---

### P1: Diagnostics — warnings ⭐ MVP

**User Story**: As a developer scanning a repo with parse issues or rename ambiguity, I want warnings on stderr so that I understand result limitations without corrupting stdout output.

**Why P1**: IMPL §8.5; git miner and complexity analyzer already return `warnings: string[]`.

**Acceptance Criteria**:

1. WHEN a warning is emitted THEN it SHALL be written to `stderr` with a `warning:` prefix (or equivalent consistent prefix)
2. WHEN `ScanOptions.onWarning` is provided THEN `runScan()` infrastructure SHALL support invoking it (M6 will forward module warnings; M5 tests callback plumbing)
3. WHEN JSON output is redirected to a file THEN warnings SHALL NOT appear on stdout

**Independent Test**: Unit tests on diagnostics logger; scan test with mock `onWarning` callback.

**Requirements**: HOTSPOT-46

---

### P1: Diagnostics — progress ⭐ MVP

**User Story**: As a developer scanning a large repo, I want periodic progress messages so that I know the tool is still working.

**Why P1**: IMPL §8.5 progress logs; primary UX concern for RT-001.

**Acceptance Criteria**:

1. WHEN `GitMinerOptions.onProgress` is provided THEN the miner SHALL invoke it after each processed commit with `{ commitsProcessed: number }`
2. WHEN progress is logged to CLI THEN messages SHALL go to stderr (not stdout)
3. WHEN commits are processed THEN progress messages SHALL be throttled (e.g., every 1000 commits) to avoid stderr flood
4. WHEN total commit count is unknown during streaming THEN progress message SHALL NOT require a total (e.g., `"Processing commit 5,000..."` per context.md)
5. WHEN tested THEN progress callback SHALL be verified with a mocked git log stream (no real repo required)

**Independent Test**: `src/git/index.test.ts` with injected stream; diagnostics logger unit test.

**Requirements**: HOTSPOT-47

---

### P1: `runScan()` M5 wiring ⭐ MVP

**User Story**: As a library consumer, I want `runScan()` to apply option defaults and expose diagnostics hooks while returning a typed `ScanResult` so that M6 can plug in the pipeline without CLI changes.

**Why P1**: Bridges CLI flags to domain; must not prematurely couple modules.

**Acceptance Criteria**:

1. WHEN `runScan()` is called THEN it SHALL NOT import or invoke `GitMiner`, `ComplexityAnalyzer`, or scorers (M6 scope)
2. WHEN options are omitted THEN `meta.since` SHALL default to `"12 months ago"` and `top`/`minCochange` defaults SHALL match CLI defaults
3. WHEN `repoPath` is not an existing directory THEN `runScan()` SHALL throw a clear error (propagated by CLI to exit `!= 0`)
4. WHEN scan succeeds in M5 THEN `hotspots` and `coupling` SHALL remain empty arrays (stub until M6)
5. WHEN `DEFAULT_SINCE`, `DEFAULT_TOP` are exported from `src/scan.ts` THEN CLI and tests MAY import them for consistency

**Independent Test**: `src/scan.test.ts` — defaults, path validation, no pipeline imports (static or behavioral).

**Requirements**: HOTSPOT-48

---

### P1: Reporter factory ⭐ MVP

**User Story**: As the CLI entry point, I want `createReporter()` to dispatch to table or JSON renderers so that output format is selected without domain logic in `bin/`.

**Why P1**: Existing stub contract in `src/report/index.ts`; replaces Milestone 5 throw.

**Acceptance Criteria**:

1. WHEN `createReporter().render(result, { format: "json", top })` is called THEN it SHALL return JSON string
2. WHEN `createReporter().render(result, { format: "table", top })` is called THEN it SHALL return table string
3. WHEN `createReporter()` is called THEN it SHALL NOT throw
4. WHEN `src/report/index.test.ts` runs THEN it SHALL no longer expect "Milestone 5" throw

**Independent Test**: `src/report/index.test.ts` integration with both formats.

**Requirements**: HOTSPOT-49

---

### P1: Coverage gate ⭐ MVP

**User Story**: As a CI maintainer, I want `pnpm build && pnpm test` passing with reporter/diagnostics tests so that M5 regressions are caught before M6 integration.

**Why P1**: Quality gate per TESTING.md and workspace rules.

**Acceptance Criteria**:

1. WHEN `pnpm build && pnpm test` runs THEN all tests SHALL pass
2. WHEN coverage is measured THEN `src/report/**` and `src/diagnostics/**` SHALL have co-located unit tests (best-effort coverage; no 80% hard threshold until policy extended)
3. WHEN M5 completes THEN ROADMAP M5 SHALL link to this spec and STRUCTURE.md SHALL reflect `src/report/` and `src/diagnostics/` as implemented
4. WHEN `commander` is added THEN `INTEGRATIONS.md` entry remains accurate

**Independent Test**: Full project gate.

**Requirements**: HOTSPOT-50

---

## Edge Cases

- WHEN `top` is greater than result length THEN output SHALL include all available items (no error)
- WHEN `top` is `1` THEN exactly one row per non-empty section
- WHEN hotspot scores are tied THEN table rank SHALL follow input array order (already sorted by scorer)
- WHEN file paths are long THEN table MAY truncate with ellipsis or wrap (implementer choice — document in design)
- WHEN `--format JSON` (wrong case) THEN CLI SHALL reject (case-sensitive `table` | `json`)
- WHEN scan runs on empty stub result THEN exit code SHALL still be `0`
- WHEN progress callback fires on commit 1 THEN throttler MAY suppress until interval reached

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-39 | P1: CLI flags | Tasks T7 | Pending |
| HOTSPOT-40 | P1: CLI flags (defaults) | Tasks T6, T7 | Pending |
| HOTSPOT-41 | P1: CLI validation | Tasks T6, T7 | Pending |
| HOTSPOT-42 | P1: JSON reporter | Tasks T3 | Pending |
| HOTSPOT-43 | P1: Table reporter | Tasks T4 | Pending |
| HOTSPOT-44 | P1: Table reporter (since header) | Tasks T4 | Pending |
| HOTSPOT-45 | P1: `--top` slicing | Tasks T3, T4 | Pending |
| HOTSPOT-46 | P1: Warning diagnostics | Tasks T1, T6, T7 | Pending |
| HOTSPOT-47 | P1: Progress diagnostics | Tasks T1, T2, T7 | Pending |
| HOTSPOT-48 | P1: runScan M5 wiring | Tasks T6 | Pending |
| HOTSPOT-49 | P1: Reporter factory | Tasks T5 | Pending |
| HOTSPOT-50 | P1: Coverage gate | Tasks T9 | Pending |

**Coverage:** 12 total, 12 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] All P1 acceptance criteria verifiable via Vitest (no human judgment for core behavior)
- [ ] `pnpm build && pnpm test` passes after Execute
- [ ] `orchestrator-implementer` can execute T1–T9 without ambiguous scope
- [ ] No full pipeline wiring in `src/scan.ts` (M6 boundary preserved)
- [ ] CLI manual smoke works: `pnpm exec hotspot-scanner scan .` prints table with since header
