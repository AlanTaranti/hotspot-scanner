# Milestone 35 — Function-Mode Scan Efficiency Specification

**Feature slug:** `function-mode-scan-efficiency`  
**Milestone:** ROADMAP M35  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [TESTING.md](../../codebase/TESTING.md), [CONCERNS.md](../../codebase/CONCERNS.md)  
**Context:** [`.specs/features/function-mode-scan-efficiency/context.md`](./context.md)  
**Sisters:** [per-function-churn](../per-function-churn/spec.md), [function-granularity](../function-granularity/spec.md), [rename-confidence](../rename-confidence/spec.md)

## Problem Statement

Function mode is expensive: a second full-repo `git log -p --unified=0` stream plus AST over every in-scope source file, then O(functions × hunks) overlap in `aggregatePatchCommit`. Large repos pay wall time for patches and parses that cannot affect rankings of functions with in-window churn. M35 cuts that cost without historical AST, without changing file-mode cost, and without silently reordering typical triage rankings.

## Goals

- [ ] Restrict the function-mode patch stream with git pathspecs (churn ∩ eligible / function files)
- [ ] In function mode, limit AST to churn ∩ scope without worsening expected rankings for typical (churned) cases
- [ ] Replace naive function×hunk nested loops with an interval index (sort/sweep) in `aggregate.ts`
- [ ] Keep file mode at **zero** patch spawn (regression test)
- [ ] `pnpm build && pnpm test` passing after Execute

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Historical AST / per-commit function ranges | User locked; CONCERNS deferred |
| Changing McCabe decision nodes or AST collection constructs | RT-005 / M22/M29 — collection policy unchanged |
| Scoring formula / JSON `version` / public score fields | Rankings semantics preserved for typical cases only |
| Parallelizing function-churn with numstat | M34 boundary |
| Persistent AST workers / discovery `git ls-files` | M31 / M36 |
| Changing file-mode numstat argv or coupling | ADR-2026-020 preserved |
| Global `git log --follow` | Forbidden (ARCHITECTURE / CONCERNS) |

---

## User Stories

### P1: Restrict patch stream with pathspecs ⭐ MVP

**User Story**: As a developer scanning with `--granularity function`, I want the patch stream limited to paths that can contribute function churn so that wall time and I/O drop on large repos.

**Why P1**: ROADMAP primary I/O win for function mode.

**Acceptance Criteria**:

1. WHEN `buildGitPatchLogArgv` / `streamGitPatchLog` receives a non-empty path allowlist THEN the argv SHALL include those paths as git pathspecs after `--` (or equivalent documented form)
2. WHEN the allowlist is empty THEN the function-churn miner SHALL NOT spawn `git log -p` and SHALL return empty stats (same early-exit spirit as empty `functions`)
3. WHEN pathspecs are applied THEN argv SHALL still include `-M`, `-p`, `--unified=0`, and the same optional `--since` as today
4. WHEN the allowlist size exceeds a documented soft threshold THEN the miner SHALL fall back to an unrestricted patch stream (correctness over ARG_MAX risk) and SHALL remain streaming line-by-line
5. WHEN pathspecs are used THEN the miner SHALL NOT buffer the full patch output in memory (RT-001)

**Independent Test**: Unit tests on argv builder with/without paths; miner early-exit with empty paths; mock spawn asserts no call when empty.

**Requirements**: HOTSPOT-380, HOTSPOT-381, HOTSPOT-382, HOTSPOT-383

---

### P1: Limit function-mode AST to churn ∩ scope ⭐ MVP

**User Story**: As a function-mode user, I want complexity analysis only on files that had in-window churn (within scope) so that AST work tracks files that can affect non-zero rankings.

**Why P1**: ROADMAP AST win; pairs with pathspec allowlist.

**Acceptance Criteria**:

1. WHEN `granularity === "function"` THEN `runScan()` SHALL limit complexity analysis to eligible source paths present in scoped `fileStats` (churn ∩ scope ∩ TS/JS eligibility)
2. WHEN `granularity === "file"` (default) THEN complexity discovery/analysis SHALL remain full in-scope discovery (unchanged)
3. WHEN the ComplexityAnalyzer accepts an allowlist/filter THEN it SHALL analyze only those paths (still apply existing parse-fail warn-skip behavior)
4. WHEN a scoped source file has zero file-level churn in the window THEN function mode SHALL omit it from AST and from `ScanResult.functions` (**intentional edge** — document)
5. WHEN comparing typical churned fixtures (e.g. functions in files with commits in-window) THEN top rankings / relative order SHALL match pre-M35 expected behavior for those functions

**Independent Test**: Unit — analyzer with allowlist analyzes only listed files; integration — function mode on fixture omits never-touched paths; file mode still analyzes them.

**Requirements**: HOTSPOT-384, HOTSPOT-385, HOTSPOT-386, HOTSPOT-387, HOTSPOT-388

---

### P1: Interval index for function×hunk overlap ⭐ MVP

**User Story**: As the function-churn aggregator, I want interval-indexed overlap so that large files with many functions do not pay naive nested-loop cost.

**Why P1**: ROADMAP CPU win inside `aggregate.ts` without semantic drift.

**Acceptance Criteria**:

1. WHEN attributing hunks to functions for a file THEN `aggregatePatchCommit` (or helper) SHALL use a sort/sweep (or equivalent interval index) over function `[line, endLine]` ranges rather than a pure nested loop of every function × every hunk as the hot path
2. WHEN a hunk intersects N nested/overlapping functions THEN the commit SHALL still count toward **all N** (unchanged M23 semantics)
3. WHEN `linesChanged` is aggregated THEN intersecting hunks SHALL still contribute full hunk line deltas (unchanged M23 D6)
4. WHEN equivalence tests run THEN interval-index attribution SHALL match the previous intersection predicate (`hunkIntersectsFunction`) on fixtures covering nested, adjacent, non-overlap, and multi-hunk cases

**Independent Test**: Unit tests in `src/git/function-churn/` — same stats from naive vs indexed path on shared fixtures.

**Requirements**: HOTSPOT-389, HOTSPOT-390, HOTSPOT-391

---

### P1: Pipeline wiring + file-mode zero patch spawn ⭐ MVP

**User Story**: As the scan pipeline, I want function-mode efficiency wired only on the function branch and a hard guarantee that file mode never spawns the patch stream.

**Why P1**: Correct orchestration and non-regression of the default path.

**Acceptance Criteria**:

1. WHEN `granularity === "function"` THEN `runScan()` SHALL build the churn/AST allowlist from scoped numstat `fileStats`, pass it into complexity, then pass resulting function file paths (or the same allowlist) into `FunctionChurnMiner` pathspecs
2. WHEN `granularity === "file"` THEN `runScan()` SHALL NOT call `createFunctionChurnMiner` / `streamGitPatchLog` / patch spawn
3. WHEN function-mode mining runs THEN progress SHALL still use `phase: "function-churn"` with commit counts from the (possibly pathspec-restricted) stream
4. WHEN implementing M35 THEN the design SHALL NOT introduce historical AST or blame-based attribution
5. WHEN integration tests run THEN file mode SHALL assert zero patch spawn; function mode SHALL assert pathspec-restricted argv (or documented fallback) when allowlist non-empty

**Independent Test**: Integration / unit with injectable spawn deps — spy file vs function branches.

**Requirements**: HOTSPOT-392, HOTSPOT-393, HOTSPOT-394, HOTSPOT-395, HOTSPOT-397

---

### P2: Living docs + rename/pathspec edges + gate

**User Story**: As a maintainer, I want ARCHITECTURE/CONCERNS/TESTING to describe pathspecs, AST allowlist, interval index, intentional ranking edges, and rename/pathspec limits so that future milestones do not regress efficiency contracts.

**Why P2**: Docs after behavior lands; full gate closes the milestone.

**Acceptance Criteria**:

1. WHEN M35 Execute completes THEN ARCHITECTURE SHALL document function-mode pathspecs, AST allowlist, and interval-index overlap
2. WHEN docs update THEN CONCERNS SHALL note intentional omission of zero-churn-file functions and pathspec/ARG_MAX fallback; TESTING SHALL note regression coverage for file-mode zero patch spawn
3. WHEN rename + pathspec interaction is documented THEN it SHALL state that pathspecs use current/canonical paths and that post-rename line imprecision remains M26-warned (no historical AST)
4. WHEN the final task runs THEN `pnpm build && pnpm test` SHALL pass

**Independent Test**: Doc review + full quality gate.

**Requirements**: HOTSPOT-396, HOTSPOT-398, HOTSPOT-399

---

## Edge Cases

- WHEN allowlist is empty (no churned eligible files) THEN function mode SHALL skip patch spawn and return empty/zero function rankings without error
- WHEN allowlist exceeds soft threshold THEN unrestricted patch stream SHALL preserve attribution correctness
- WHEN a path is renamed in-window THEN pathspecs based on canonical/current paths with `-M` SHALL remain best-effort; pós-rename overlap warning rules unchanged (M26)
- WHEN include/exclude scope removes a path THEN it SHALL NOT appear in allowlist (scope already applied to `fileStats` / discovery)
- WHEN file mode runs THEN AST allowlist SHALL NOT apply
- WHEN nested functions share a hunk THEN interval index SHALL credit all intersecting ranges
- WHEN only zero-churn files exist under scope THEN `functions` MAY be empty (intentional edge)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-380 | P1: Pathspecs | Tasks | Pending |
| HOTSPOT-381 | P1: Pathspecs | Tasks | Pending |
| HOTSPOT-382 | P1: Pathspecs | Tasks | Pending |
| HOTSPOT-383 | P1: Pathspecs | Tasks | Pending |
| HOTSPOT-384 | P1: AST limit | Tasks | Pending |
| HOTSPOT-385 | P1: AST limit | Tasks | Pending |
| HOTSPOT-386 | P1: AST limit | Tasks | Pending |
| HOTSPOT-387 | P1: AST limit | Tasks | Pending |
| HOTSPOT-388 | P1: AST limit | Tasks | Pending |
| HOTSPOT-389 | P1: Interval index | Tasks | Pending |
| HOTSPOT-390 | P1: Interval index | Tasks | Pending |
| HOTSPOT-391 | P1: Interval index | Tasks | Pending |
| HOTSPOT-392 | P1: Wiring / file mode | Tasks | Pending |
| HOTSPOT-393 | P1: Wiring / file mode | Tasks | Pending |
| HOTSPOT-394 | P1: Wiring / file mode | Tasks | Pending |
| HOTSPOT-395 | P1: Wiring / file mode | Tasks | Pending |
| HOTSPOT-396 | P2: Docs + gate | Tasks | Pending |
| HOTSPOT-397 | P1: Wiring / file mode | Tasks | Pending |
| HOTSPOT-398 | P2: Docs + gate | Tasks | Pending |
| HOTSPOT-399 | P2: Docs + gate | Tasks | Pending |

**ID format:** `HOTSPOT-NNN` (band **380–399** only)

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 20 total, 20 mapped to tasks (see `tasks.md`), 0 unmapped ✅

---

## Success Criteria

- [ ] Function-mode patch argv is pathspec-restricted (or documented fallback) for non-empty allowlists
- [ ] Function-mode AST limited to churn ∩ scope; file-mode AST unchanged
- [ ] Interval-index overlap matches prior semantics on fixtures
- [ ] File mode: zero patch spawn (automated regression)
- [ ] Typical churned ranking parity documented and tested
- [ ] Intentional zero-churn omission documented
- [ ] `pnpm build && pnpm test` green
