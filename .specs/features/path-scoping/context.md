# Milestone 7 — Path Scoping Context

**Feature slug:** `path-scoping`  
**Captured:** 2026-07-22  
**Trigger:** ROADMAP M7 scope, M6 integration decisions, user confirmation on include/exclude semantics

---

## Decision: Include and exclude semantics

**Question:** When the user passes `--include` (one or more globs), what scope rules apply relative to default and user excludes?

**Choice:** **Include narrows; exclude always applies (defaults + user).**

| Condition | In scope when |
| --------- | ------------- |
| No `--include` | Path matches no exclude pattern (default + user) |
| One or more `--include` | Path matches at least one include **and** matches no exclude pattern |
| Include vs exclude conflict | **Exclude wins** — path is out of scope |

**Rationale:**

- Default excludes (`node_modules`, `.git`, `dist`, `coverage`, `build`) protect scan quality even when user narrows with `--include`
- Matches common tooling expectations (eslint ignore + override patterns)
- User confirmed this option during planning (2026-07-22)

**Status:** **Confirmed**

**Applies to:** `createPathScope()`, CLI flags, T1, T5, T6.

---

## Decision: Default excludes are always active

**Question:** Should users be able to disable default excludes (e.g. scan `node_modules` intentionally)?

**Choice:** **No** — default excludes always apply in M7; user `--exclude` is **additive** only. No `--no-default-excludes` flag.

**Rationale:**

- ROADMAP M7 lists default excludes as a deliverable, not as optional
- Scanning `node_modules` is rarely useful; defer opt-out to a future milestone if requested
- YAGNI — avoids extra CLI surface

**Status:** **Confirmed**

**Applies to:** `DEFAULT_EXCLUDE_PATTERNS`, T1.

---

## Decision: Glob matching library

**Question:** How should `--include` / `--exclude` patterns be evaluated?

**Choice:** Add runtime dependency **`picomatch`**; encapsulate in `src/paths/scope.ts`.

**Rationale:**

- Node has no built-in glob matcher for arbitrary patterns
- `picomatch` is small, widely used, supports `**` and brace patterns
- Single integration point keeps `INTEGRATIONS.md` update minimal

**Status:** **Confirmed** — document in INTEGRATIONS.md on Execute.

**Applies to:** T1, T8.

---

## Decision: Git path filtering location

**Question:** Filter paths during `git log` streaming, inside `GitMiner`, or after mining?

**Choice:** **Post-`mine()` filter** in orchestration layer — `filterGitMinerResult(result, scope)` called from `runScan()` (implementation may live in `src/paths/filter-git.ts`).

**Rationale:**

- Preserves single-pass streaming (ADR-2026-020) — no second git invocation or pathspec changes
- Keeps `GitMiner` API stable; scope is a scan concern, not a git-parse concern
- Filter applies to canonicalized paths after rename resolution

**Status:** **Confirmed**

**Applies to:** T3, T5.

---

## Decision: Git repository validation

**Question:** How should `runScan()` verify the target is a Git repository?

**Choice:** Check accessibility of `{repoPath}/.git` (file or directory) **before** git spawn or complexity analysis. Throw with message containing `not a git repository` (or equivalent).

**Rationale:**

- ROADMAP literal requirement
- `.git` as a file covers linked worktrees
- Faster fail than spawning `git log` on a plain directory
- Replaces current test expectation (`git log failed`) in `scan.test.ts`

**Status:** **Confirmed**

**Applies to:** T4, T5.

---

## Decision: Scope vs M6 intersection filter (C1)

**Question:** M6 [context.md](../integration/context.md) chose **no** orchestration intersection between git-touched paths and complexity-discovered paths. Does M7 reintroduce intersection?

**Choice:** **No git∩complexity intersection** — M7 applies the **same `PathScope` rules** independently to each stage. In-scope files may still appear with churn 0 if they have complexity but no git history (M4 behavior). Out-of-scope files are removed from both git stats and discovery regardless of the other stage.

**Rationale:**

- M6 C1 remains valid for cross-stage presence
- M7 adds explicit user-controlled and default path boundaries
- Avoids conflating "in git history" with "in scope"

**Status:** **Confirmed**

**Applies to:** T2, T3, T5; spec out-of-scope table.

---

## Decision: Directory prune during discovery walk

**Question:** Should excluded directories be pruned during filesystem walk or only filtered after full walk?

**Choice:** **Prune during walk** — when a directory name matches an exclude pattern (segment or full path), do not descend.

**Rationale:**

- Performance on large `node_modules` trees
- `node_modules` default exclude prevents expensive traversal
- File-level `isPathInScope` as secondary guard

**Status:** **Confirmed**

**Applies to:** T2.

---

## Related closed decisions (STATE.md)

| Decision | Value | Relevance to M7 |
| -------- | ----- | ----------------- |
| Default `--since` | `"12 months ago"` | Unchanged |
| Default `--min-cochange` | `3` | Unchanged |
| Exit code on success | `0` | Unchanged; validation errors `!= 0` |
| Requirement ID start | `HOTSPOT-61` | Continues after M6 (`HOTSPOT-60`) |

---
