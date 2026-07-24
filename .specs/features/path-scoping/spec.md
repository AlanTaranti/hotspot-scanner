# Milestone 7 — Path Scoping Specification

**Feature slug:** `path-scoping`  
**Milestone:** ROADMAP M7  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md)  
**Context:** [`.specs/features/path-scoping/context.md`](./context.md)

## Problem Statement

M6 delivers a full scan pipeline, but path handling is unscoped: complexity discovery walks every directory (including `node_modules`, `dist`, and build artifacts), and the Git miner aggregates churn and co-change stats for all paths in history. Scans on real monorepos waste time and produce noisy rankings. Non-Git directories fail late with an opaque `git log` error instead of a clear validation message.

M7 adds unified path scoping: default excludes, early Git repository validation, and repeatable CLI `--include` / `--exclude` globs applied consistently to complexity discovery and Git-derived stats.

## Goals

- [x] Default excludes (`node_modules`, `.git`, `dist`, `coverage`, `build`) in complexity discovery and Git stats
- [x] Validate `repoPath` is a Git repository (`.git` exists) before mining or analyzing
- [x] CLI flags `--include <glob>` and `--exclude <glob>` (repeatable) forwarded to `ScanOptions`
- [x] Unified scope rules: include narrows; exclude (defaults + user) always applies
- [x] `pnpm build && pnpm test` passing after Execute

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| `--no-default-excludes` | ROADMAP does not require; user `--exclude` is additive only |
| Intersect complexity paths with git paths (M6 C1) | M7 filters by **scope rules**, not by presence in both stages |
| `.gitignore` / `.hotspotignore` file support | Future; explicit globs suffice for M7 |
| Path scoping via `git log -- pathspec` | Preserves single-pass ADR-2026-020; post-aggregation filter instead |
| Rich JSON raw metrics | Milestone 9 — [rich-output/spec.md](../rich-output/spec.md) |
| Export formats / markdown output | Milestone 10 |
| CI fail thresholds / exit codes on metric breach | Not planned — removed from roadmap (see STATE.md) |

---

## User Stories

### P1: Default excludes in complexity discovery ⭐ MVP

**User Story**: As a developer scanning a monorepo, I want the analyzer to skip `node_modules`, build output, and VCS metadata by default so that complexity analysis stays fast and relevant.

**Why P1**: ROADMAP M7; `discoverSourceFiles()` currently walks all directories with no pruning.

**Acceptance Criteria**:

1. WHEN `discoverSourceFiles` walks the repository THEN it SHALL NOT descend into directories matching default exclude patterns (`node_modules`, `.git`, `dist`, `coverage`, `build`)
2. WHEN a file path such as `node_modules/pkg/index.ts` exists THEN it SHALL NOT appear in discovery results even if reachable without descending (defense in depth via `isPathInScope`)
3. WHEN default excludes apply THEN eligible extensions (`.ts`, `.tsx`, `.js`, `.jsx`) outside excluded paths SHALL still be discovered
4. WHEN discovery completes THEN returned paths SHALL remain posix-relative to `repoPath` and sorted

**Independent Test**: Unit test on temp directory tree with `src/app.ts` and `node_modules/lib/index.ts` — only `src/app.ts` returned.

**Requirements**: HOTSPOT-61

---

### P1: Default excludes in Git stats and co-change events ⭐ MVP

**User Story**: As a developer, I want churn and temporal coupling to ignore build artifacts and dependencies by default so that hotspot and coupling rankings reflect application source code.

**Why P1**: ROADMAP M7; Git miner currently aggregates all paths from `git log`.

**Acceptance Criteria**:

1. WHEN Git mining completes THEN `fileStats` entries for out-of-scope paths SHALL be removed before scoring
2. WHEN a `CoChangeEvent` is filtered THEN each `filesChanged` entry SHALL be reduced to in-scope paths only
3. WHEN a co-change event has fewer than 2 in-scope files after filtering THEN the event SHALL be discarded
4. WHEN both files of a coupling pair are in scope THEN co-change counts and coupling strength SHALL reflect filtered events only
5. WHEN a path was renamed and canonicalized THEN scope filtering SHALL apply to the canonical path

**Independent Test**: Unit test on `filterGitMinerResult` with fixture `fileStats` and `coChangeEvents` containing excluded paths.

**Requirements**: HOTSPOT-62

---

### P1: Git repository validation ⭐ MVP

**User Story**: As a developer, I want a clear error when the scan path is not a Git repository so that misconfiguration is obvious before a long analysis run.

**Why P1**: ROADMAP M7; current behavior fails at `git log` spawn with a generic message.

**Acceptance Criteria**:

1. WHEN `repoPath` exists and is a directory but `{repoPath}/.git` is not accessible THEN `runScan()` SHALL throw before invoking `git log` or complexity analysis
2. WHEN the error is thrown THEN the message SHALL indicate the path is not a Git repository and include `repoPath`
3. WHEN `{repoPath}/.git` is a file (git worktree) THEN validation SHALL succeed
4. WHEN `repoPath` does not exist or is not a directory THEN existing M5/M6 path validation behavior SHALL be preserved (throw before Git check)
5. WHEN validation fails THEN CLI SHALL exit with code `!= 0`

**Independent Test**: `scan.test.ts` with temp directory (no `.git`) expecting `not a git repository` (or equivalent) — not `git log failed`.

**Requirements**: HOTSPOT-63

---

### P1: CLI `--include` and `--exclude` flags ⭐ MVP

**User Story**: As a developer working in a monorepo, I want repeatable `--include` and `--exclude` globs so that I can focus scans on specific packages or folders.

**Why P1**: ROADMAP M7; primary user-facing scoping control.

**Acceptance Criteria**:

1. WHEN `hotspot-scanner scan <path> --include "src/**"` is invoked THEN `runScan()` SHALL receive `include: ["src/**"]`
2. WHEN `--include` is passed multiple times THEN CLI SHALL collect all values into `include: string[]`
3. WHEN `--exclude "generated/**"` is passed THEN `runScan()` SHALL receive `exclude: ["generated/**"]` in addition to default excludes
4. WHEN `--exclude` is passed multiple times THEN CLI SHALL collect all values; duplicate patterns MAY be deduplicated
5. WHEN flags are omitted THEN `include` SHALL be undefined and only default excludes SHALL apply

**Independent Test**: Vitest CLI tests with mocked `runScan` asserting parsed `include` / `exclude` arrays.

**Requirements**: HOTSPOT-64

---

### P1: Unified scope semantics ⭐ MVP

**User Story**: As a developer combining include and exclude globs, I want predictable scope rules so that I can narrow scans without accidentally including build artifacts.

**Why P1**: Core product decision; confirmed in [context.md](./context.md).

**Acceptance Criteria**:

1. WHEN no `--include` is provided THEN all eligible paths minus excludes (default + user) SHALL be in scope
2. WHEN one or more `--include` patterns are provided THEN a path SHALL be in scope only if it matches at least one include pattern AND matches no exclude pattern (defaults + user)
3. WHEN a path matches both an include and an exclude pattern THEN exclude SHALL win (path out of scope)
4. WHEN `runScan` builds scope THEN complexity discovery and Git filtering SHALL use the same `PathScope` instance
5. WHEN paths contain forward slashes THEN matching SHALL use posix-style relative paths (no backslashes)

**Independent Test**: Unit tests on `createPathScope` / `isPathInScope` covering include-only, exclude-only, combined, and exclude-wins cases.

**Requirements**: HOTSPOT-65

---

### P2: CLI validation for scope flags

**User Story**: As a developer, I want clear errors for malformed scope flags so that typos are caught before a scan starts.

**Why P2**: Improves UX; invalid globs are edge cases.

**Acceptance Criteria**:

1. WHEN `--include` or `--exclude` is passed with an empty string THEN CLI SHALL print an error to stderr and exit with code `2`
2. WHEN scope patterns compile successfully THEN scan SHALL proceed normally
3. WHEN scan completes successfully with valid scope flags THEN CLI SHALL exit with code `0`

**Independent Test**: Vitest CLI test with empty `--include ""`.

**Requirements**: HOTSPOT-66

---

### P1: Fixture coverage for excluded paths ⭐ MVP

**User Story**: As a test author, I want a fixture or test tree with `node_modules` present so that path scoping is verified end-to-end.

**Why P1**: Prevents regressions in walk prune and Git filter integration.

**Acceptance Criteria**:

1. WHEN integration test scans a fixture containing both `src/` sources and a `node_modules/` stub THEN hotspot `filePath` values SHALL NOT include paths under `node_modules/`
2. WHEN fixture includes a high-complexity file under `node_modules/` THEN it SHALL NOT appear in rankings despite being on disk
3. WHEN `--include "src/**"` is used on the fixture THEN only `src/` paths SHALL appear in output

**Independent Test**: Integration test on extended `small-ts` fixture or dedicated scoped fixture.

**Requirements**: HOTSPOT-67

---

### P1: Documentation sync ⭐ MVP

**User Story**: As a maintainer, I want architecture and integration docs updated so that path scoping behavior is discoverable without reading source.

**Why P1**: Workspace rule — significant pipeline changes update `.specs/codebase/`.

**Acceptance Criteria**:

1. WHEN M7 is complete THEN [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md) SHALL document path scoping in the data-flow section and list new CLI flags
2. WHEN `picomatch` is added THEN [INTEGRATIONS.md](../../codebase/INTEGRATIONS.md) SHALL document the dependency and usage boundary (`src/paths/` only)
3. WHEN planning completes THEN [ROADMAP.md](../../project/ROADMAP.md) M7 SHALL link to this spec
4. WHEN Execute completes THEN ROADMAP M7 checkboxes SHALL be marked done

**Independent Test**: Doc review; link validation.

**Requirements**: HOTSPOT-68

---

## Edge Cases

- WHEN repository has no in-scope files THEN scan SHALL complete with empty rankings (no throw)
- WHEN all files in a co-change commit are out of scope THEN the event SHALL be dropped entirely
- WHEN a file is in scope for complexity but has no git history THEN it MAY appear in hotspots with churn 0 (M4 behavior preserved for in-scope files)
- WHEN a file has git history but is out of scope THEN it SHALL NOT appear in hotspots or coupling output
- WHEN `--include` matches no files THEN scan SHALL complete with empty rankings
- WHEN user passes `--exclude` overlapping default excludes THEN behavior SHALL be unchanged (dedupe acceptable)
- WHEN path uses mixed case on case-sensitive filesystems THEN glob matching SHALL be case-sensitive (picomatch default)
- WHEN `repoPath` is a subdirectory of a Git repo (not the root) THEN `.git` check applies to the given path only — scanning subfolders without `.git` SHALL fail validation

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-61 | P1: Default excludes in complexity discovery | Tasks T1, T2 | Pending |
| HOTSPOT-62 | P1: Default excludes in Git stats | Tasks T1, T3 | Pending |
| HOTSPOT-63 | P1: Git repository validation | Tasks T4 | Pending |
| HOTSPOT-64 | P1: CLI include/exclude flags | Tasks T6 | Pending |
| HOTSPOT-65 | P1: Unified scope semantics | Tasks T1, T5 | Pending |
| HOTSPOT-66 | P2: CLI scope flag validation | Tasks T6 | Pending |
| HOTSPOT-67 | P1: Fixture coverage | Tasks T7 | Pending |
| HOTSPOT-68 | P1: Documentation sync | Tasks T8 | Pending |

**Coverage:** 8 total, 8 mapped to tasks, 0 unmapped

---

## Success Criteria

- [x] All P1 acceptance criteria verifiable via Vitest + fixture
- [x] `pnpm build && pnpm test` passes after Execute
- [x] `orchestrator-implementer` can execute T1–T8 without ambiguous scope
- [x] `pnpm exec hotspot-scanner scan tests/fixtures/repos/small-ts` succeeds; scoped paths excluded when fixture extended
- [x] `picomatch` documented in INTEGRATIONS.md
