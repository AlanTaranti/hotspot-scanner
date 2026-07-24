# Milestone 36 — Discovery & concurrency defaults Specification

**Feature slug:** `discovery-concurrency-defaults`  
**Milestone:** ROADMAP M36  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [CONCERNS.md](../../codebase/CONCERNS.md) (RT-001 / AST concurrency), [INTEGRATIONS.md](../../codebase/INTEGRATIONS.md), [TESTING.md](../../codebase/TESTING.md)  
**Context:** [`.specs/features/discovery-concurrency-defaults/context.md`](./context.md)  
**Sisters:** [path-scoping](../path-scoping/) (PathScope + discover prune), [path-config-dx](../path-config-dx/) (default excludes), [ast-parallelization](../ast-parallelization/) (pool default), [perf-diagnostics-ux](../perf-diagnostics-ux/) (`--concurrency` override)

## Problem Statement

Source discovery still walks the filesystem with directory prune (`discoverSourceFiles`), which is correct for PathScope but slower on large monorepos where Git already knows tracked paths. Separately, the complexity worker default remains `min(availableParallelism(), 4)` from M15 — conservative for memory, but underuses common multi-core machines even though M28 already exposes `--concurrency`. Operators need a faster default discovery path and a higher out-of-box concurrency cap, with clear memory guidance.

## Goals

- [x] Prefer `git ls-files` + PathScope/extension filter for discovery, with filesystem walk fallback — `src/complexity/discover.ts`
- [x] Raise `DEFAULT_WORKER_CONCURRENCY` to `min(availableParallelism(), 8)`; keep CLI/config override; document memory vs `--concurrency`
- [x] Update README, living SoT docs, and benchmark notes
- [x] `pnpm build && pnpm test` passing after Execute

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Changing `--concurrency` / config precedence or validation | M28 lock; only the default formula changes |
| Changing `DEFAULT_BATCH_SIZE` or exposing `--batch-size` | M15/M28 YAGNI |
| `git ls-files --others` / include untracked on primary path | Locked: tracked-only; walk remains fallback |
| New diagnostics / `ScanWarning` for discovery fallback | YAGNI |
| PathScope pattern changes or `--no-default-excludes` | M7/M30 locks |
| Parallel pipeline stages / overlapping git+AST | Separate milestones (e.g. M34) |
| CI wall-clock performance gates | Manual benchmark only |
| Rewriting historical M15/M28 feature specs to say “always 8” | Past locks stay archival; living docs update |
| McCabe / scoring / git log parsing changes | Unrelated |

---

## User Stories

### P1: Prefer `git ls-files` for source discovery ⭐ MVP

**User Story**: As a developer scanning a large Git repo, I want complexity discovery to list tracked source files via Git so that discovery skips walking huge trees like `node_modules` without relying only on prune.

**Why P1**: Primary ROADMAP M36 deliverable for discovery.

**Acceptance Criteria**:

1. WHEN `discoverSourceFiles` runs against a valid Git repository THEN it SHALL prefer listing candidates via `git ls-files` (null-delimited) rather than walking first
2. WHEN paths are listed via `git ls-files` THEN the system SHALL retain only eligible extensions (`.ts`, `.tsx`, `.js`, `.jsx`) and paths that pass `isPathInScope` for the provided (or default) `PathScope`
3. WHEN discovery completes successfully via the Git path THEN returned paths SHALL be posix-relative to `repoPath` and sorted (same contract as today)
4. WHEN `git ls-files` succeeds with an empty tracked set THEN the system SHALL return `[]` and SHALL NOT fall through to a filesystem walk merge
5. WHEN Git listing is used THEN untracked working-tree files SHALL NOT appear in the result set

**Independent Test**: Unit — inject or mock `listTrackedFiles` returning mixed extensions + out-of-scope paths; assert filtered/sorted output. Optional: real `git init` + `git add` temp repo asserts tracked-only.

**Requirements**: HOTSPOT-400, HOTSPOT-401, HOTSPOT-405, HOTSPOT-413

---

### P1: Filesystem walk fallback ⭐ MVP

**User Story**: As a library caller or test author using a non-Git temp tree, I want discovery to still work when `git ls-files` cannot run so that existing walk-based behavior remains available.

**Why P1**: Preserves current unit tests and API robustness; ROADMAP requires fallback.

**Acceptance Criteria**:

1. WHEN `git ls-files` spawn fails or exits non-zero THEN `discoverSourceFiles` SHALL fall back to the existing recursive filesystem walk with directory prune + `isPathInScope`
2. WHEN fallback walk runs THEN default excludes and user include/exclude semantics SHALL remain unchanged from M7/M30
3. WHEN fallback is used THEN the system SHALL NOT abort the scan solely because Git listing failed (silent fallback; no new warning code required)
4. WHEN `repoPath` does not exist or is not a directory THEN existing error behavior SHALL be preserved (throw before listing)

**Independent Test**: Existing `discover.test.ts` cases on non-git temp dirs continue to pass via fallback; add explicit unit for “listTrackedFiles rejects → walk results”.

**Requirements**: HOTSPOT-402, HOTSPOT-403, HOTSPOT-412

---

### P1: Git spawn encapsulation ⭐ MVP

**User Story**: As a maintainer, I want `git ls-files` spawned only behind the Git adapter boundary so that INTEGRATIONS rules stay intact.

**Why P1**: INTEGRATIONS forbids git subprocess outside `src/git/`.

**Acceptance Criteria**:

1. WHEN the production discovery path invokes Git THEN the spawn SHALL live under `src/git/` (e.g. `listTrackedFiles` / `ls-files` helper)
2. WHEN `discover.ts` needs tracked paths THEN it SHALL call that helper (or an injectable seam that defaults to it) — not `child_process` directly
3. WHEN the helper fails THEN it SHALL surface a clear error to the caller (discover catches and falls back)

**Independent Test**: Unit tests for the git helper mock `child_process.spawn` at the git module boundary (same pattern as `spawn.test.ts`).

**Requirements**: HOTSPOT-404

---

### P1: Raise default worker concurrency to cap 8 ⭐ MVP

**User Story**: As an operator on a multi-core machine, I want the default complexity pool to use up to 8 workers so that out-of-box scans finish faster without requiring a flag.

**Why P1**: ROADMAP “revisit DEFAULT_WORKER_CONCURRENCY”; parent lock `min(availableParallelism(), 8)`.

**Acceptance Criteria**:

1. WHEN neither CLI nor config sets concurrency THEN `DEFAULT_WORKER_CONCURRENCY` SHALL equal `Math.min(availableParallelism(), 8)`
2. WHEN `--concurrency <n>` or config `concurrency` is set THEN that value SHALL still win (CLI > config > default) with existing validation (≥ 1 integer)
3. WHEN `concurrency === 1` THEN inline/no-spawn pool behavior SHALL remain (M15)
4. WHEN code or merge defaults import `DEFAULT_WORKER_CONCURRENCY` THEN they SHALL pick up the new formula without a duplicated literal `8` in config

**Independent Test**: Unit — assert `DEFAULT_WORKER_CONCURRENCY <= 8` and equals `min(availableParallelism(), 8)`; merge-options unset path still uses the exported constant; CLI `--concurrency 1` still works.

**Requirements**: HOTSPOT-406, HOTSPOT-407

---

### P2: Document discovery preference and memory vs concurrency

**User Story**: As an operator, I want README / SoT / benchmark notes to state the new default and that higher concurrency uses more memory so that I can tune `--concurrency` safely.

**Why P2**: ROADMAP docs bullet; reduces RT-001 surprises when default rises to 8.

**Acceptance Criteria**:

1. WHEN README documents `--concurrency` THEN it SHALL state default `min(availableParallelism(), 8)` and that raising concurrency increases memory (N workers × batch AST heap)
2. WHEN ARCHITECTURE / INTEGRATIONS / CONCERNS describe the complexity default THEN they SHALL say cap **8** (not 4) and note discovery prefers `git ls-files` with walk fallback
3. WHEN `scripts/benchmark-scan.md` notes parallelism THEN it SHALL include an M36 note (discovery preference + default concurrency 8) without adding a CI timing gate
4. WHEN docs mention override THEN they SHALL keep precedence CLI > config > default

**Independent Test**: Doc review checklist in tasks; no automated doc test required.

**Requirements**: HOTSPOT-408, HOTSPOT-409, HOTSPOT-410, HOTSPOT-411

---

## Edge Cases

- WHEN `git ls-files` returns paths with backslashes or odd characters THEN null-delimited parse SHALL treat entries as opaque path strings and normalize to posix separators before scope checks
- WHEN a tracked file sits under an excluded directory (e.g. accidentally tracked `node_modules/...`) THEN PathScope SHALL still exclude it
- WHEN include globs narrow scope THEN Git-listed paths outside includes SHALL be dropped
- WHEN available parallelism is 1–2 THEN default concurrency SHALL be that small number (cap 8 never raises above availableParallelism)
- WHEN operator sets `--concurrency 16` on a 4-core host THEN the system SHALL honor 16 (override unrestricted except ≥ 1) — document memory risk

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-400 | P1: Prefer git ls-files | Tasks | In Tasks |
| HOTSPOT-401 | P1: Prefer git ls-files (PathScope + extensions) | Tasks | In Tasks |
| HOTSPOT-402 | P1: Walk fallback | Tasks | In Tasks |
| HOTSPOT-403 | P1: Silent fallback | Tasks | In Tasks |
| HOTSPOT-404 | P1: Git spawn encapsulation | Tasks | In Tasks |
| HOTSPOT-405 | P1: Tracked-only primary path | Tasks | In Tasks |
| HOTSPOT-406 | P1: Default concurrency cap 8 | Tasks | In Tasks |
| HOTSPOT-407 | P1: Override unchanged | Tasks | In Tasks |
| HOTSPOT-408 | P2: Memory vs concurrency docs | Tasks | In Tasks |
| HOTSPOT-409 | P2: README | Tasks | In Tasks |
| HOTSPOT-410 | P2: Living SoT docs | Tasks | In Tasks |
| HOTSPOT-411 | P2: Benchmark notes | Tasks | In Tasks |
| HOTSPOT-412 | P1: Non-git temp trees via fallback | Tasks | In Tasks |
| HOTSPOT-413 | P1: Sorted posix-relative contract | Tasks | In Tasks |

**ID range used:** HOTSPOT-400–HOTSPOT-413 (HOTSPOT-414–419 reserved unused)  
**Coverage:** 14 total, 14 mapped to tasks, 0 unmapped

---

## Success Criteria

- [x] Discovery on Git repos uses `git ls-files` + PathScope; non-git / failed listing uses walk
- [x] `DEFAULT_WORKER_CONCURRENCY === min(availableParallelism(), 8)`; `--concurrency` still overrides
- [x] README + ARCHITECTURE + INTEGRATIONS + CONCERNS + benchmark notes reflect M36
- [x] `pnpm build && pnpm test` green
