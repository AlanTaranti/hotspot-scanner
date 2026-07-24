# Milestone 11 — Function Granularity Specification

**Feature slug:** `function-granularity`  
**Milestone:** ROADMAP M11  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [TESTING.md](../../codebase/TESTING.md)  
**Context:** [`.specs/features/function-granularity/context.md`](./context.md)

## Problem Statement

M1–M10 rank maintenance hotspots at file granularity. A single file may contain one highly complex function buried among many simple ones — the file-level sum obscures the worst offender. Developers triaging refactoring targets need to see which **functions** carry the most decision-path load, ranked with the same hotspot signal (complexity + churn) used at file level.

M11 adds per-function McCabe extraction (`functionName`, `line`, `complexity`) and a `--granularity file|function` CLI flag. Function mode ranks top functions by `hotspotScore` using function McCabe + parent file churn (inherited). File mode (default) is unchanged from M9/M10.

## Goals

- [x] Per-function McCabe in complexity output (`functionName`, `line`, `complexity`)
- [x] `--granularity file|function` (default `file`; function mode ranks top functions)
- [x] Function hotspot scoring with inherited file churn and M8 harmonic combiner
- [x] Table, JSON, and markdown reporters support function mode
- [x] `pnpm build && pnpm test` passing after Execute

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| Per-function git churn | No blame/history AST in v1 — churn inherited from parent file |
| Coupling at function granularity | Co-change events are file-level (M2); unchanged in M11 |
| CI fail thresholds / exit codes on metric breach | Not planned — removed from roadmap (see STATE.md) |
| `scan compare` / baseline delta | Milestone 13 — Scan Compare |
| Static import analysis on functions | Milestone 14 — Enriched Coupling |
| Worker-thread AST parallelization | Milestone 15 — AST Parallelization |
| Alter McCabe decision node definition | CONCERNS RT-005 — reuse `complexityForFunction()` |
| Bump JSON `version` to `"1.1"` | Additive schema under `"1.0"` |
| Change file-mode hotspot scoring or coupling | M8/M9 boundary |

---

## User Stories

### P1: Per-function complexity extraction ⭐ MVP

**User Story**: As a scoring module consumer, I want per-function McCabe results with name and line so that function-level ranking has accurate complexity input.

**Why P1**: Core data extraction; all downstream scoring and reporting depends on this.

**Acceptance Criteria**:

1. WHEN `analyzeSourceFile()` runs on a file with functions THEN it SHALL emit `FunctionComplexityResult[]` with `filePath`, `functionName`, `line`, and `complexity` for each function enumerated by `collectFunctionsInScope`
2. WHEN a function is analyzed THEN `complexity` SHALL equal `complexityForFunction(node)` (McCabe decision nodes + 1)
3. WHEN nested functions exist THEN each inner and outer function SHALL appear as separate entries
4. WHEN file-level `ComplexityResult` is produced THEN `cyclomaticComplexity` SHALL still equal the sum of per-function complexities and `functionCount` SHALL equal the array length
5. WHEN a file has no functions THEN `FunctionComplexityResult[]` SHALL be empty

**Independent Test**: Fixture files with named function, method, constructor, arrow in const, anonymous arrow — assert `functionName`, `line`, `complexity`.

**Requirements**: HOTSPOT-92

---

### P1: Function naming fixtures ⭐ MVP

**User Story**: As a test author, I want fixtures documenting expected function names and lines so that naming regressions are caught before scoring.

**Why P1**: Naming rules are user-facing; fragile area similar to McCabe decision nodes.

**Acceptance Criteria**:

1. WHEN fixtures exist for named function, class method, constructor, `const` arrow, and anonymous arrow THEN each SHALL document expected `functionName` and `line` in a header comment
2. WHEN anonymous arrow/function expression is analyzed THEN `functionName` SHALL be `<anonymous>:L{line}`
3. WHEN `const foo = () => {}` is analyzed THEN `functionName` SHALL be `foo`
4. WHEN constructor is analyzed THEN `functionName` SHALL be `constructor`

**Independent Test**: `analyze-file.test.ts` against naming fixtures.

**Requirements**: HOTSPOT-93

---

### P1: Function hotspot scorer ⭐ MVP

**User Story**: As a developer, I want functions ranked by hotspotScore using inherited file churn so that function triage uses the same dual-signal formula as file mode.

**Why P1**: ROADMAP M11 primary ranking deliverable; user decision in context.md.

**Acceptance Criteria**:

1. WHEN `scoreFunctionHotspots(fileStats, functions)` runs THEN each output entry SHALL include `filePath`, `functionName`, `line`, `complexity`, `complexityNormalized`, `churnNormalized`, `hotspotScore`, `commitCount`, `linesChanged`, and `authorCount`
2. WHEN complexity is normalized THEN normalization SHALL apply `log1p` + min-max across all function complexity values
3. WHEN churn is normalized THEN each function SHALL inherit `commitCount` from its parent file's `FileChangeStats`; normalization SHALL apply across all inherited churn values
4. WHEN `c + h === 0` THEN `hotspotScore` SHALL be `0`
5. WHEN `c + h > 0` THEN `hotspotScore` SHALL equal `2ch / (c + h)` (M8 harmonic mean)
6. WHEN parent file has no `fileStats` entry THEN `commitCount`, `linesChanged`, and `authorCount` SHALL be `0`
7. WHEN scoring completes THEN results SHALL be sorted by `hotspotScore` descending, then `filePath` ascending, then `line` ascending

**Independent Test**: Fixed `FunctionComplexityResult[]` + `FileChangeStats` map → assert scores, inherited churn, sort order.

**Requirements**: HOTSPOT-94

---

### P1: Domain types + pipeline wiring ⭐ MVP

**User Story**: As the scan pipeline, I want a granularity branch so that file mode and function mode produce the correct `ScanResult` shape.

**Why P1**: Connects complexity extraction, scoring, and reporters.

**Acceptance Criteria**:

1. WHEN `ScanOptions.granularity` is omitted THEN it SHALL default to `"file"`
2. WHEN `granularity` is `"file"` THEN `runScan()` SHALL call `scoreHotspots()` and return populated `hotspots` with empty `functions`
3. WHEN `granularity` is `"function"` THEN `runScan()` SHALL flatten per-file `FunctionComplexityResult[]`, call `scoreFunctionHotspots()`, and return populated `functions` with empty `hotspots`
4. WHEN `runScan()` completes THEN `meta.granularity` SHALL reflect the active mode
5. WHEN `runScan()` completes THEN `coupling` SHALL be populated regardless of granularity (file-level, unchanged)
6. WHEN `version` is present THEN its value SHALL remain `"1.0"`

**Independent Test**: `runScan({ granularity: "function" })` on fixture → assert `functions.length > 0`, `hotspots.length === 0`, `meta.granularity === "function"`.

**Requirements**: HOTSPOT-95

---

### P1: CLI `--granularity` flag ⭐ MVP

**User Story**: As a CLI user, I want `--granularity function` so that I can switch ranking from files to functions without changing other flags.

**Why P1**: ROADMAP M11 user-facing deliverable.

**Acceptance Criteria**:

1. WHEN `--granularity file` or `--granularity function` is provided THEN the CLI SHALL accept the value and pass it to `runScan()`
2. WHEN `--granularity` is omitted THEN default SHALL be `file`
3. WHEN `--granularity` has an invalid value THEN the CLI SHALL print an error to stderr and exit with code `!= 0`
4. WHEN `--granularity function` is combined with `--format json` THEN JSON output SHALL include `functions` array and `meta.granularity`

**Independent Test**: `bin/hotspot-scanner.test.ts` — `parseGranularity()` valid/invalid values.

**Requirements**: HOTSPOT-96

---

### P1: Table reporter (function mode) ⭐ MVP

**User Story**: As a developer triaging in the terminal, I want a **Top Functions** table so that I can see ranked functions with complexity and inherited churn.

**Why P1**: Primary human-readable output for function mode.

**Acceptance Criteria**:

1. WHEN `meta.granularity` is `"function"` THEN table output SHALL render a **Top Functions** section per [design.md](./design.md) § Table Layout (function mode)
2. WHEN `meta.granularity` is `"file"` THEN table output SHALL render **Top Hotspots** unchanged from M9
3. WHEN integer raw values are displayed THEN they SHALL use integer formatting (no decimal places)
4. WHEN normalized values and `hotspotScore` are displayed THEN they SHALL use 4 decimal places
5. WHEN `functions` array is empty in function mode THEN section SHALL render `(none)` without throwing
6. WHEN coupling section renders THEN it SHALL be unchanged from M5/M9

**Independent Test**: `table.test.ts` with function-mode fixture — assert column headers and values.

**Requirements**: HOTSPOT-97

---

### P1: JSON schema (function mode) ⭐ MVP

**User Story**: As a pipeline consumer, I want JSON function rankings so that I can build dashboards at function granularity.

**Why P1**: Machine-readable output for CI and tooling.

**Acceptance Criteria**:

1. WHEN `meta.granularity` is `"function"` THEN JSON SHALL include populated `functions` array with all `FunctionHotspotScore` fields
2. WHEN `meta.granularity` is `"function"` THEN `hotspots` SHALL be an empty array
3. WHEN `meta.granularity` is `"file"` THEN `functions` SHALL be an empty array and `hotspots` populated (M9 schema)
4. WHEN `version` is present THEN its value SHALL remain `"1.0"`
5. WHEN `coupling` is serialized THEN its schema SHALL be unchanged from M5

**Independent Test**: `json.test.ts` with `sample-result-functions.json` fixture.

**Requirements**: HOTSPOT-98

---

### P1: Markdown reporter (function mode) ⭐ MVP

**User Story**: As a developer sharing scan results in a PR, I want markdown function rankings so that complex functions are visible in review context.

**Why P1**: M10 deferred per-function markdown sections; absorbed by M11.

**Acceptance Criteria**:

1. WHEN `meta.granularity` is `"function"` THEN markdown SHALL include a **Top Functions** GFM table per [design.md](./design.md) § Markdown Layout (function mode)
2. WHEN `meta.granularity` is `"file"` THEN markdown hotspots section SHALL be unchanged from M10
3. WHEN file paths or function names contain pipe `|` characters THEN cells SHALL be escaped for valid GFM
4. WHEN a section has no rows THEN it SHALL render `_No results._` without throwing
5. WHEN numeric values are displayed THEN scores/normalized: 4 decimals; integers: no decimals

**Independent Test**: `markdown.test.ts` with function-mode fixture.

**Requirements**: HOTSPOT-99

---

### P1: Reporter factory + slice ⭐ MVP

**User Story**: As the CLI entry point, I want `sliceScanResult` and `createReporter` to handle both granularities so that `--top` works consistently.

**Why P1**: Render-time slicing must target the active ranking array.

**Acceptance Criteria**:

1. WHEN `sliceScanResult(result, top)` runs with `meta.granularity === "function"` THEN it SHALL slice `functions` (not `hotspots`)
2. WHEN `sliceScanResult(result, top)` runs with `meta.granularity === "file"` THEN it SHALL slice `hotspots` (unchanged from M5)
3. WHEN `sliceScanResult` runs THEN `coupling` SHALL always be sliced independently
4. WHEN `createReporter().render()` is called THEN all three formats SHALL dispatch based on `meta.granularity`

**Independent Test**: `index.test.ts` and `slice.test.ts` — function mode slicing.

**Requirements**: HOTSPOT-100

---

### P1: Tests + integration ⭐ MVP

**User Story**: As a CI maintainer, I want unit and integration tests for function granularity so that regressions are caught before release.

**Why P1**: Touches fragile areas (`src/complexity/`, `src/scoring/`, `src/report/`); ≥80% coverage required.

**Acceptance Criteria**:

1. WHEN `analyze-file.test.ts` runs THEN it SHALL cover per-function extraction and naming conventions
2. WHEN `function-hotspot-scorer.test.ts` runs THEN it SHALL cover inherited churn, zero guard, and sort order
3. WHEN reporter tests run THEN they SHALL use `sample-result-functions.json` fixture for function mode
4. WHEN `bin/hotspot-scanner.test.ts` runs THEN it SHALL cover `parseGranularity`
5. WHEN integration test runs on `small-ts` with `--granularity function` THEN CLI SHALL exit `0` and `functions[0]` SHALL have `functionName`, `line`, `complexity`, and `hotspotScore`

**Independent Test**: Per-file Vitest gates in tasks.md.

**Requirements**: HOTSPOT-101

---

### P1: Documentation sync ⭐ MVP

**User Story**: As a maintainer, I want docs updated so that `--granularity` and function-mode output are discoverable without reading source.

**Why P1**: Workspace rule — significant schema and CLI changes update `.specs/codebase/`.

**Acceptance Criteria**:

1. WHEN M11 Execute completes THEN [STATE.md](../../project/STATE.md) SHALL record function-mode ranking decision (inherited file churn)
2. WHEN docs are synced THEN [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md) SHALL document granularity branch, `FunctionHotspotScore`, and `meta.granularity`
3. WHEN [README.md](../../../README.md) is read THEN CLI flags table SHALL include `--granularity`
4. WHEN [vitals-cli-validation](../../../.cursor/skills/vitals-cli-validation/SKILL.md) is read THEN validation examples SHALL include function mode
5. WHEN [vitals-pipeline-domain](../../../.cursor/skills/vitals-pipeline-domain/SKILL.md) is read THEN function granularity SHALL be documented
6. WHEN planning completes THEN [ROADMAP.md](../../project/ROADMAP.md) M11 SHALL link to this spec with `**Specs:** Done`

**Independent Test**: Doc review; grep for `--granularity` in listed files.

**Requirements**: HOTSPOT-102

---

## Edge Cases

- WHEN `FunctionComplexityResult[]` is empty (no functions in repo) THEN scorer SHALL return empty `functions` array
- WHEN a function's parent file has zero commits in scan window THEN inherited git fields SHALL be `0` while `complexity` reflects AST analysis
- WHEN multiple functions share the same parent file THEN they SHALL inherit identical churn values (expected — tie-break by `line`)
- WHEN `complexity` is `0` for a function (no decision nodes) THEN it SHALL serialize as `0`
- WHEN `--top N` slices results in function mode THEN sliced entries SHALL match full `FunctionHotspotScore` values (no recomputation at render)
- WHEN paths contain slashes and unicode THEN join and display SHALL use exact string match on `filePath`
- WHEN anonymous functions exist at different lines in same file THEN `functionName` SHALL disambiguate via `:L{line}` suffix
- WHEN file mode is active THEN `functions` SHALL always be `[]` in JSON (not omitted)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-92 | P1: Per-function complexity extraction | Tasks T1 | Planned |
| HOTSPOT-93 | P1: Function naming fixtures | Tasks T1 | Planned |
| HOTSPOT-94 | P1: Function hotspot scorer | Tasks T2 | Planned |
| HOTSPOT-95 | P1: Domain types + pipeline wiring | Tasks T3 | Planned |
| HOTSPOT-96 | P1: CLI `--granularity` flag | Tasks T4 | Planned |
| HOTSPOT-97 | P1: Table reporter (function mode) | Tasks T5 | Planned |
| HOTSPOT-98 | P1: JSON schema (function mode) | Tasks T5 | Planned |
| HOTSPOT-99 | P1: Markdown reporter (function mode) | Tasks T5 | Planned |
| HOTSPOT-100 | P1: Reporter factory + slice | Tasks T5 | Planned |
| HOTSPOT-101 | P1: Tests + integration | Tasks T6 | Planned |
| HOTSPOT-102 | P1: Documentation sync | Tasks T7 | Planned |

**Coverage:** 11 total, 11 mapped to tasks, 0 unmapped

---

## Success Criteria

- [x] All P1 acceptance criteria verifiable via Vitest + fixtures (no human judgment)
- [x] `pnpm build && pnpm test` passes after Execute
- [x] `src/complexity/**`, `src/scoring/**`, and `src/report/**` ≥80% line coverage per [TESTING.md](../../codebase/TESTING.md)
- [x] `orchestrator-implementer` can execute T1–T7 without ambiguous scope
- [x] File mode (default) behavior unchanged from M9/M10
- [x] McCabe decision node definition unchanged (existing complexity fixtures pass)
