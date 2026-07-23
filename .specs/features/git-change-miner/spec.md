# Milestone 2 — Git Change Miner Specification

**Feature slug:** `git-change-miner`  
**Milestone:** ROADMAP M2  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [CONCERNS.md](../../codebase/CONCERNS.md), [TESTING.md](../../codebase/TESTING.md)

## Problem Statement

The hotspot-scanner pipeline needs reliable per-file churn and per-commit co-change data from a **single pass** over `git log`. Without the Git Change Miner, scoring (M4) and reporting (M5) have no input. Incorrect parsing distorts every downstream signal ([CONCERNS.md](../../codebase/CONCERNS.md)).

M1 delivered typed contracts in `src/git/index.ts` and domain types in `src/types/domain.ts`, but `createGitMiner()` still throws. Fixture directories exist empty under `tests/fixtures/git-log/`.

## Goals

- [ ] Streaming parse of `git log --numstat --name-only` (no `execSync` / full-buffer load)
- [ ] `Map<string, FileChangeStats>` aggregation (`commitCount`, `linesChanged`, `authors`, `lastModified`)
- [ ] `CoChangeEvent[]` extraction (one event per commit with `filesChanged`)
- [ ] Rename handling with churn preservation (RT-003) and warning when history may be incomplete
- [ ] Real fixtures in `tests/fixtures/git-log/` (merge, rename, delete, binary)
- [ ] Functional `createGitMiner().mine()`; ≥80% line coverage on `src/git/**`

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| Scoring formulas (`hotspotScore`, `couplingStrength`) | Milestone 4 — Scoring |
| Wiring into `runScan()` / CLI `--since` default | M5/M6 — miner testable in isolation |
| Extension filter (`.ts`/`.tsx`/`.js`/`.jsx`) in miner | Downstream (M3/M4) intersects; miner records all paths from log |
| `commander`, reporter, JSON output | Milestone 5 — Reporter + CLI |
| Versioned Git fixture repo (`tests/fixtures/repos/`) | Milestone 6 — Integration |
| Progress logs ("processing commit 5,000/40,000") | Milestone 5 |
| Worker-thread parallelization | Deferred in [STATE.md](../../project/STATE.md) |

---

## User Stories

### P1: Git subprocess invocation ⭐ MVP

**User Story**: As an implementer agent, I want `createGitMiner().mine()` to spawn `git log` with the correct flags so that churn and co-change data come from one authoritative Git read.

**Why P1**: ADR-2026-020 mandates a single `git log` pass; all downstream stages depend on this invocation.

**Acceptance Criteria**:

1. WHEN `createGitMiner().mine({ repoPath, since })` is called on a valid repo THEN the miner SHALL spawn `git log` with `--numstat`, `--name-only`, and `--pretty=format:"COMMIT|%H|%ad|%an"`
2. WHEN `since` is provided THEN the miner SHALL pass `--since=<since>` to `git log`
3. WHEN `since` is omitted THEN the miner SHALL omit `--since` (Git default window; CLI default `12 months` is M5)
4. WHEN the repo is invalid or `git log` exits non-zero THEN the miner SHALL reject with an error containing `repoPath` and a stderr snippet ([INTEGRATIONS.md](../../codebase/INTEGRATIONS.md))

**Independent Test**: Mock or fixture repo; call `mine()` and assert `git` argv includes expected flags; invalid path throws with context.

**Requirements**: HOTSPOT-09, HOTSPOT-16

---

### P1: Streaming parser ⭐ MVP

**User Story**: As a developer scanning large repos, I want line-by-line parsing of `git log` output so that memory stays bounded on tens of thousands of commits.

**Why P1**: RT-001 — performance on large repos; streaming is mandatory from v1 (IMPL §7.2, §8.3).

**Acceptance Criteria**:

1. WHEN `git log` output arrives line by line THEN the parser SHALL process without accumulating the full log in memory
2. WHEN a line matches the commit header format (`COMMIT|hash|date|author`) THEN the parser SHALL extract `hash`, `date`, and `author`
3. WHEN a line matches numstat format (`additions\tdeletions\tpath`) THEN the parser SHALL associate it with the current commit
4. WHEN numstat shows `-` `-` (binary file) THEN the parser SHALL count the file in the commit without adding to `linesChanged`
5. WHEN a line matches rename format (`old => new`) THEN the parser SHALL record a rename event for path canonicalization

**Independent Test**: Feed fixture file line-by-line via `parseGitLogStream()`; assert parsed commits without loading entire fixture as one string buffer in production code path.

**Requirements**: HOTSPOT-10, HOTSPOT-15

---

### P1: Dual-output aggregation (ADR-2026-020) ⭐ MVP

**User Story**: As a scoring module consumer, I want `FileChangeStats` and `CoChangeEvent[]` from the same parse pass so that churn and coupling are consistent and I/O is not duplicated.

**Why P1**: Core data contract for M4 scoring; single-pass is an architectural invariant.

**Acceptance Criteria**:

1. WHEN a commit changes N files THEN the aggregator SHALL emit one `CoChangeEvent` with canonical `filesChanged` paths
2. WHEN the stream completes THEN the aggregator SHALL produce `FileChangeStats` per file with:
   - `commitCount` = number of distinct commits touching the file
   - `linesChanged` = sum of (additions + deletions) across commits
   - `authors` = `Set<string>` of distinct author names from commits touching the file
   - `lastModified` = date of the most recent commit touching the file
3. WHEN the same input stream is parsed THEN both `fileStats` and `coChangeEvents` SHALL derive from that single pass (no second `git log` invocation)

**Independent Test**: Parse a multi-commit fixture; assert both `Map` entries and `CoChangeEvent[]` length match expected values from fixture.

**Requirements**: HOTSPOT-11, HOTSPOT-12, HOTSPOT-13

---

### P1: Rename handling (RT-003) ⭐ MVP

**User Story**: As a developer analyzing churn, I want renamed files to retain their change history so that a file renamed multiple times does not appear as a brand-new file with zero history.

**Why P1**: RT-003 — rename distortion is a known failure mode (IMPL §5.2, §9).

**Acceptance Criteria**:

1. WHEN the log contains a rename (`old => new` or equivalent metadata) THEN churn SHALL be unified under the canonical current path
2. WHEN rename history cannot be fully resolved THEN the miner SHALL add a warning string to `GitMinerResult.warnings`
3. WHEN a file is renamed multiple times in the window THEN a dedicated fixture test SHALL assert unified `commitCount` under the final path

**Independent Test**: `tests/fixtures/git-log/rename-multi.txt` → `mine()` or parse pipeline → final path has expected `commitCount`.

**Requirements**: HOTSPOT-14

---

### P1: Merge, delete, and binary edge cases ⭐ MVP

**User Story**: As a test author, I want correct handling of merge commits, deleted files, and binary numstat lines so that real-world repos do not produce silent data corruption.

**Why P1**: IMPL §9 explicitly requires unit tests for rename, merge commits, and deleted files.

**Acceptance Criteria**:

1. WHEN a merge commit includes numstat for multiple parents THEN files SHALL be counted once per commit (not double-counted within the same commit)
2. WHEN a file is deleted in a commit THEN it SHALL appear in that commit's `filesChanged` and contribute to `commitCount`
3. WHEN a binary file appears with `-` `-` numstat THEN `commitCount` SHALL increment and `linesChanged` SHALL not increase for that file in that commit

**Independent Test**: Fixtures `merge-delete.txt` and `binary.txt` produce deterministic expected stats.

**Requirements**: HOTSPOT-15

---

### P2: Insufficient history

**User Story**: As a developer scanning a young repo with a wide `--since` window, I want an informative warning and empty results rather than a fatal error.

**Why P2**: IMPL §8.4 failure mode — repo without enough history should proceed gracefully.

**Acceptance Criteria**:

1. WHEN `--since` exceeds repo age and zero commits are returned THEN `mine()` SHALL return empty `fileStats` and `coChangeEvents` without throwing
2. WHEN zero commits are returned THEN `warnings` SHALL include an informative message about insufficient history

**Independent Test**: Fixture or mock with empty git output → empty result + warning, no throw.

**Requirements**: HOTSPOT-17

---

### P1: Fixtures and coverage gate ⭐ MVP

**User Story**: As a CI maintainer, I want real `git log` fixtures and ≥80% coverage on `src/git/**` so that parsing regressions are caught before they reach scoring.

**Why P1**: TESTING.md mandates ≥80% on `src/git/**`; CONCERNS.md requires fixture coverage for fragile areas.

**Acceptance Criteria**:

1. WHEN listing `tests/fixtures/git-log/` THEN files SHALL exist for merge, rename (including multi-rename), delete, and binary cases
2. WHEN `pnpm test` runs with coverage THEN `src/git/**` SHALL report ≥80% line coverage
3. WHEN `pnpm build && pnpm test` runs THEN all tests SHALL pass with zero regressions

**Independent Test**: `pnpm build && pnpm test` + coverage report for `src/git/`.

**Requirements**: HOTSPOT-18

---

## Edge Cases

- WHEN a merge commit has numstat from multiple parents THEN system SHALL count each file once within that commit's `CoChangeEvent`
- WHEN a file is deleted THEN it SHALL appear in the deleting commit's `filesChanged`
- WHEN a path contains spaces or special characters THEN parser SHALL handle the path correctly (tab-separated numstat, unquoted paths)
- WHEN a commit has no file changes THEN system SHALL emit no `CoChangeEvent` for that commit (skip empty events)
- WHEN `git log` returns only binary changes (`-` `-`) THEN `linesChanged` for that file in that commit SHALL be zero
- WHEN `since` is omitted THEN `git log` runs without `--since` (full history per Git default)
- WHEN repo path does not exist or is not a Git repo THEN `mine()` SHALL throw before parsing
- WHEN the same file appears twice in one commit (pathological) THEN system SHALL deduplicate within that commit's `filesChanged`

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-09 | P1: Git subprocess invocation | Tasks T1, T5 | Pending |
| HOTSPOT-10 | P1: Streaming parser | Tasks T2 | Pending |
| HOTSPOT-11 | P1: Dual-output aggregation | Tasks T4 | Pending |
| HOTSPOT-12 | P1: Dual-output aggregation | Tasks T4 | Pending |
| HOTSPOT-13 | P1: Dual-output aggregation | Tasks T4 | Pending |
| HOTSPOT-14 | P1: Rename handling | Tasks T3 | Pending |
| HOTSPOT-15 | P1: Merge/delete/binary | Tasks T2, T7 | Pending |
| HOTSPOT-16 | P1: Git subprocess invocation | Tasks T1 | Pending |
| HOTSPOT-17 | P2: Insufficient history | Tasks T7 | Pending |
| HOTSPOT-18 | P1: Fixtures and coverage | Tasks T6, T8 | Pending |

**Coverage:** 10 total, 10 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] All P1 acceptance criteria verifiable via Vitest + fixtures (no human judgment)
- [ ] `pnpm build && pnpm test` passes after Execute
- [ ] `src/git/**` ≥80% line coverage per [TESTING.md](../../codebase/TESTING.md)
- [ ] `orchestrator-implementer` can execute T1–T8 without ambiguous scope
- [ ] No `git` subprocess spawned outside `src/git/` ([INTEGRATIONS.md](../../codebase/INTEGRATIONS.md))
