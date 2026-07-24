# Milestone 23 — Per-Function Git Churn Specification

**Feature slug:** `per-function-churn`  
**Milestone:** ROADMAP M23  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [TESTING.md](../../codebase/TESTING.md), [CONCERNS.md](../../codebase/CONCERNS.md)  
**Context:** [`.specs/features/per-function-churn/context.md`](./context.md)

## Problem Statement

M11 ranks functions with McCabe complexity plus **inherited parent-file churn**. Two functions in the same hot file share identical `commitCount` / `linesChanged` / `authorCount`, so churn does not discriminate which function actually changed. Developers triage refactoring targets need function-level churn that reflects commits whose patches intersect each function’s current line range.

M23 adds a **function-mode-only** hunk-overlap miner: for each commit touching a file, if any hunk intersects `[line, endLine]`, that commit counts toward the function. File-mode `--numstat` GitMiner and coupling stay unchanged. Historical AST per commit is out of scope.

## Goals

- [ ] Emit `endLine` on `FunctionComplexityResult` for overlap ranges (`line` remains start)
- [ ] Stream hunk-overlap churn **only** when `--granularity function` (no file-mode patch cost)
- [ ] Populate `FunctionHotspotScore.commitCount` / `linesChanged` / `authorCount` from per-function overlap (stop inheriting `FileChangeStats`)
- [ ] Keep normalization + harmonic `2ch/(c+h)` and JSON `version: "1.0"` shape unchanged
- [ ] `pnpm build && pnpm test` passing after Execute

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Historical AST per commit | User locked — current range + hunk overlap only |
| Changing file-mode GitMiner / numstat parse | File mode must not regress; ADR-2026-020 preserved for churn+coupling |
| Function-level temporal coupling | Co-change remains file-pair (M2/M11) |
| JSON schema version bump or new public fields | Locked — `version: "1.0"`, no shape break |
| Blame-based attribution | Locked approach is hunk overlap, not `git blame` |
| Altering McCabe decision nodes or M22 collection | Complexity only adds `endLine` emission |
| Package DX / publish prep | Milestone 24 |

---

## User Stories

### P1: Emit function endLine ⭐ MVP

**User Story**: As the function churn miner, I want each function’s start and end line from the working-tree AST so that hunk overlap uses a stable current range.

**Why P1**: Without `endLine`, overlap cannot be computed; all downstream churn depends on ranges.

**Acceptance Criteria**:

1. WHEN `analyzeSourceFile()` emits a `FunctionComplexityResult` THEN it SHALL include `endLine` equal to the function node’s `getEndLineNumber()`
2. WHEN `line` is present THEN it SHALL remain the start line (`getStartLineNumber()`) — unchanged naming semantics
3. WHEN `endLine` is used in the pipeline THEN it MAY remain internal to scoring/mining (not required on public `FunctionHotspotScore` / JSON) unless a later additive decision says otherwise
4. WHEN nested functions exist THEN each entry SHALL carry its own `[line, endLine]` range

**Independent Test**: Unit test on a fixture file — assert `line` and `endLine` for outer and nested functions.

**Requirements**: HOTSPOT-181

---

### P1: Function churn miner (hunk overlap) ⭐ MVP

**User Story**: As a developer using `--granularity function`, I want per-function churn derived from patch hunks so that rankings reflect which functions actually changed.

**Why P1**: Core M23 deliverable; replaces M11 inherited file churn.

**Acceptance Criteria**:

1. WHEN function mode runs the churn miner THEN for each commit touching a file, if **any** hunk intersects a function’s `[line, endLine]` THEN that commit SHALL count toward that function’s `commitCount`
2. WHEN a hunk intersects N functions (nested or overlapping ranges) THEN the commit SHALL count toward **all N** functions
3. WHEN aggregating THEN `linesChanged` SHALL reflect added+deleted lines attributable to overlapping hunks for that function (same spirit as file-level line churn; exact per-hunk accounting documented in design)
4. WHEN aggregating THEN `authorCount` SHALL be the size of the distinct-author set for commits attributed to that function (same author rules as file-level miner)
5. WHEN `--since` is set THEN the patch stream SHALL honor the same window as file-level GitMiner
6. WHEN processing the patch stream THEN the miner SHALL use `--unified=0` (or minimal equivalent), process hunks line-by-line, and SHALL NOT buffer the entire repo patch in memory
7. WHEN renames occur THEN the miner SHALL reuse `PathAliasMap` / existing rename warning patterns and MAY attribute imprecisely after moves (current range vs historical hunk lines) — documented, not silent

**Independent Test**: Synthetic patch fixtures under `tests/fixtures/` — assert per-function `commitCount` / `linesChanged` / `authorCount` for overlap, nested, and non-overlap cases.

**Requirements**: HOTSPOT-182, HOTSPOT-184, HOTSPOT-187, HOTSPOT-188, HOTSPOT-190, HOTSPOT-191

---

### P1: Function hotspot scorer uses per-function churn ⭐ MVP

**User Story**: As a triage user, I want `hotspotScore` in function mode to combine McCabe with per-function churn so that two functions in one file can rank differently on the churn axis.

**Why P1**: Scoring is the user-visible ranking signal.

**Acceptance Criteria**:

1. WHEN `scoreFunctionHotspots` runs THEN it SHALL take a per-function churn map (not inherit parent `FileChangeStats.commitCount` for churn values)
2. WHEN normalizing churn THEN it SHALL apply `log1p` + min-max across all functions’ per-function `commitCount` values (universe = all functions)
3. WHEN `c + h === 0` THEN `hotspotScore` SHALL be `0`; otherwise `2ch/(c+h)` (unchanged)
4. WHEN a function has no churn entry THEN `commitCount`, `linesChanged`, and `authorCount` SHALL be `0`
5. WHEN scoring completes THEN sort order SHALL remain `hotspotScore` desc, `filePath` asc, `line` asc
6. WHEN output is produced THEN `FunctionHotspotScore` field names SHALL be unchanged (`commitCount`, `linesChanged`, `authorCount`, normalized scores, etc.)

**Independent Test**: Fixed `FunctionComplexityResult[]` + per-function churn map → assert different churn for siblings in same file; assert formula and sort.

**Requirements**: HOTSPOT-185

---

### P1: Pipeline wiring — function mode only ⭐ MVP

**User Story**: As the scan pipeline, I want the hunk miner invoked only on the function branch so that file mode stays fast and semantically identical.

**Why P1**: Correct orchestration and non-regression of the default path.

**Acceptance Criteria**:

1. WHEN `granularity === "function"` THEN `runScan()` SHALL run complexity (with `endLine`), then the function churn miner, then `scoreFunctionHotspots` with the per-function churn map
2. WHEN `granularity === "file"` (default) THEN `runScan()` SHALL NOT spawn the patch/hunk stream; existing numstat GitMiner + `scoreHotspots` path SHALL be unchanged
3. WHEN either mode completes THEN `coupling` SHALL still come from numstat co-change (unchanged)
4. WHEN JSON is emitted THEN `version` SHALL remain `"1.0"` and the `ScanResult` shape SHALL not break (no required new public fields for this milestone)

**Independent Test**: Integration — file mode scan does not invoke patch spawn (mock/spy); function mode returns per-function churn distinct from parent file totals where fixtures prove it.

**Requirements**: HOTSPOT-183, HOTSPOT-186, HOTSPOT-189

---

### P2: Living docs + gate

**User Story**: As a future agent, I want ARCHITECTURE / CONCERNS / TESTING updated so that inherited-file churn is no longer documented as current function-mode behavior.

**Why P2**: Living docs requirement; prevents M11 docs drift.

**Acceptance Criteria**:

1. WHEN docs are updated THEN ARCHITECTURE § Function granularity SHALL describe hunk-overlap churn and the function-only extra stream
2. WHEN CONCERNS is updated THEN it SHALL flag hunk-overlap / rename imprecision and streaming constraints for the new miner
3. WHEN TESTING is updated THEN it SHALL mention synthetic patch fixtures under `tests/fixtures/`
4. WHEN the feature completes THEN ROADMAP M23 checklist items SHALL be checkable and STATE SHALL record the superseding decision

**Independent Test**: Doc review in final task + `pnpm build && pnpm test`.

**Requirements**: HOTSPOT-192, HOTSPOT-193

---

## Edge Cases

- WHEN a hunk intersects nested outer and inner functions THEN both SHALL receive the commit (HOTSPOT-184)
- WHEN a commit touches a file but no hunk intersects any function range THEN no function in that file SHALL gain churn from that commit
- WHEN a function has zero overlapping commits THEN churn fields SHALL be `0` and ranking may be complexity-only via harmonic edge behavior
- WHEN a file is renamed THEN path canonicalization SHALL follow `PathAliasMap`; line overlap against **current** ranges MAY mis-attribute post-move history — warn/document, do not invent historical AST
- WHEN `--since` excludes all commits THEN all function churn SHALL be zero (same as empty fileStats window)
- WHEN patch stream fails (git error) THEN scan SHALL fail with contextual error (repoPath, command, stderr) consistent with `GitLogError` patterns
- WHEN function mode runs on a repo with no TS/JS functions THEN `functions` SHALL be empty and the miner MAY no-op or run with empty ranges without aborting

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-181 | P1: Emit endLine | Tasks | Pending |
| HOTSPOT-182 | P1: Function churn miner | Tasks | Pending |
| HOTSPOT-183 | P1: Pipeline — function only | Tasks | Pending |
| HOTSPOT-184 | P1: Nested overlap → all N | Tasks | Pending |
| HOTSPOT-185 | P1: Scorer per-function churn | Tasks | Pending |
| HOTSPOT-186 | P1: scan.ts wiring | Tasks | Pending |
| HOTSPOT-187 | P1: `--since` / authors parity | Tasks | Pending |
| HOTSPOT-188 | P1: Renames / PathAliasMap | Tasks | Pending |
| HOTSPOT-189 | P1: JSON `1.0` no shape break | Tasks | Pending |
| HOTSPOT-190 | P1: Streaming `--unified=0` | Tasks | Pending |
| HOTSPOT-191 | P1: Synthetic patch fixtures | Tasks | Pending |
| HOTSPOT-192 | P2: Living docs | Tasks | Pending |
| HOTSPOT-193 | P2: Integration + project gate | Tasks | Pending |

**ID format:** `HOTSPOT-NNN`  
**Coverage:** 13 total — all mapped in Tasks phase

---

## Success Criteria

- [ ] Function mode churn differs from parent-file inheritance when only a subset of functions overlap hunks
- [ ] File mode: no patch spawn; numstat + coupling behavior unchanged
- [ ] Nested overlap credits all intersecting functions
- [ ] JSON `version: "1.0"`; no schema shape break
- [ ] `pnpm build && pnpm test` green after Execute
