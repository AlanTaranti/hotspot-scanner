# Milestone 26 — Rename Confidence Specification

**Slug:** `rename-confidence`  
**Milestone:** M26 — Rename confidence (RT-003)  
**Depth:** Large  
**Context:** [context.md](./context.md)  
**Design:** [design.md](./design.md)

## Problem Statement

File-mode rankings can silently split history across paths when git does not emit `old => new` (copy-paste moves, renames outside `--since`, or find-renames off). Function-mode hunk overlap uses **current** working-tree `[line, endLine]` against **historical** hunk lines, so after renames/moves attribution can be wrong without any user-visible signal. Today only PathAliasMap **ambiguous** paths warn; CONCERNS tracks the remaining blind spots as M26.

## Goals

- [ ] Emit actionable warnings for file-miner rename blind spots (copy-paste / unlinked, `--since` truncation, ambiguous chains)
- [ ] Enable git find-renames (`-M`) so real repos can produce `old => new` for PathAliasMap
- [ ] Strengthen file-miner fixtures (and `with-renames` E2E) proving unified churn + warning cases
- [ ] In function mode, emit a clear pós-rename overlap / confidence warning when renames were observed
- [ ] Document limits in living docs; do **not** invent historical AST

## Out of Scope

| Feature                                                               | Reason                                                    |
| --------------------------------------------------------------------- | --------------------------------------------------------- |
| Historical AST / per-commit function ranges                           | User locked — avisos only                                 |
| Blame-based attribution                                               | Locked hunk-overlap approach (M23)                        |
| `git log --follow` on global mine                                     | CONCERNS / ARCHITECTURE — still forbidden                 |
| `ScanResult.meta.warnings` or score `confidence` fields               | YAGNI; stderr/`onWarning` only; avoid JSON contract churn |
| Warning severity levels / progress UX / `--concurrency`               | M28                                                       |
| tsconfig `paths` / package `exports`                                  | M27                                                       |
| Dedicated fix for renamed-but-unlinked → `hasStaticDependency: false` | CONCERNS: no dedicated M26 milestone                      |

---

## User Stories

### P1: File-miner rename blind-spot warnings ⭐ MVP

**User Story**: As a developer scanning a repo with moves/renames, I want actionable warnings when history may be incomplete so that I do not trust split churn silently.

**Why P1**: CONCERNS risk A; RT-003 core trust gap (“No warning today”).

**Acceptance Criteria**:

1. WHEN PathAliasMap reports ambiguous paths THEN the file miner SHALL continue to emit a warning matching the existing incomplete-history pattern (`Rename history may be incomplete for: …` or equivalent stable prefix)
2. WHEN a commit shows a suspected copy-paste / unlinked rename (delete+add related paths with **no** `renameFrom` / `old => new`) THEN the miner SHALL add an actionable warning naming the suspected paths (or a capped summary)
3. WHEN `since` is set AND at least one in-window rename link was recorded THEN the miner SHALL emit a warning that history before the window (or before the first in-window rename) may be missing under the canonical path
4. WHEN no blind-spot signals apply THEN the miner SHALL NOT emit the new blind-spot warning families (noise control)

**Independent Test**: Synthetic `tests/fixtures/git-log/` cases for unlinked delete+add, rename-with-since, and ambiguous — assert `warnings` contents; clean basic fixture stays quiet for new families.

**Requirement IDs:** HOTSPOT-203, HOTSPOT-204, HOTSPOT-205

---

### P1: Find-renames on miner spawn ⭐ MVP

**User Story**: As a developer scanning a real git repo with proper renames, I want git find-renames enabled so that `old => new` reaches PathAliasMap and churn can unify under the canonical path.

**Why P1**: Without `-M`, real numstat often never emits rename lines; PathAliasMap is fixture-only today.

**Acceptance Criteria**:

1. WHEN the file miner builds `git log` argv THEN it SHALL include find-renames (`-M` or `--find-renames`)
2. WHEN the function-churn miner builds patch `git log` argv THEN it SHALL likewise include find-renames so rename metadata can appear in the patch stream when git detects it
3. WHEN argv changes THEN unit tests on `buildGitLogArgv` / `buildGitPatchLogArgv` SHALL assert the flag is present
4. WHEN find-renames is enabled THEN the miner SHALL still NOT use `--follow`

**Independent Test**: Argv unit tests + `with-renames` (or content-preserving rename fixture) E2E showing unified `commitCount` under final path when git emits rename metadata.

**Requirement IDs:** HOTSPOT-206

---

### P1: Stronger file-miner rename fixtures ⭐ MVP

**User Story**: As a maintainer, I want fixtures that encode copy-paste, truncated-window, and successful rename-chain cases so that RT-003 warnings and linking do not regress.

**Why P1**: ROADMAP ordered item 1 — “fixtures fortes no file miner”.

**Acceptance Criteria**:

1. WHEN listing `tests/fixtures/git-log/` THEN fixtures SHALL cover at least: successful multi-rename (existing), suspected unlinked delete+add (no `=>`), and a case used to assert `--since` truncation warning behavior (via injected stream + `since` option)
2. WHEN `tests/fixtures/repos/with-renames/` is scanned THEN integration/E2E SHALL assert canonical-path churn continuity **and** document/assert expected warning behavior for the fixture’s history
3. WHEN fixtures are added or updated THEN README or fixture headers SHALL state the expected warning / churn outcome

**Independent Test**: Targeted Vitest on new fixtures + scan/integration on `with-renames`.

**Requirement IDs:** HOTSPOT-207, HOTSPOT-208

---

### P1: Function-mode pós-rename overlap warning ⭐ MVP

**User Story**: As a developer using `--granularity function`, I want an explicit warning when renames were observed so that I know current-range hunk overlap may mis-attribute churn after moves.

**Why P1**: ROADMAP ordered item 2; CONCERNS function churn pós-rename.

**Acceptance Criteria**:

1. WHEN function-churn mining records at least one rename link OR ambiguous path THEN `FunctionChurnMinerResult.warnings` SHALL include a message stating that overlap uses current `[line, endLine]` vs historical hunks and that confidence may be reduced after renames/moves
2. WHEN function-churn mining records neither rename links nor ambiguous paths THEN that pós-rename overlap warning SHALL NOT be emitted
3. WHEN `granularity === "file"` THEN the scan SHALL NOT emit the function-mode overlap warning
4. WHEN the warning is emitted THEN it SHALL be forwarded via existing `onWarning` / stderr path like other miner warnings

**Independent Test**: Function-churn unit test with patch fixture containing `renameFrom` / `=>` → warning present; fixture without renames → absent.

**Requirement IDs:** HOTSPOT-209

---

### P2: Living docs for rename confidence

**User Story**: As a contributor, I want ARCHITECTURE / CONCERNS / TESTING (and user-facing README notes as needed) to describe blind-spot warnings and function pós-rename limits so that RT-003 is not tribal knowledge.

**Why P2**: Closes CONCERNS “document” path; unlocks matrix cleanup after mitigation ships.

**Acceptance Criteria**:

1. WHEN docs are updated THEN ARCHITECTURE SHALL note find-renames (`-M`), PathAliasMap, and warning families (not `--follow`)
2. WHEN CONCERNS is updated THEN rename blind spots and function pós-rename rows SHALL reflect **warning mitigation** (remove or rewrite “No warning today” for covered items)
3. WHEN TESTING is updated THEN new git-log / repo fixture purposes SHALL be listed

**Independent Test**: Doc review checklist in final task; no code gate beyond full project gate.

**Requirement IDs:** HOTSPOT-210

---

## Edge Cases

- WHEN many unlinked delete+add pairs appear in one scan THEN the miner SHALL cap or summarize warnings (no unbounded stderr spam)
- WHEN a rename is detected via `-M` AND `since` is set THEN both link-success warnings (`--since` truncation) and successful canonicalization MAY coexist — truncation warning still applies
- WHEN copy-paste heuristic false-positives (unrelated delete+add same commit) THEN prefer precision over recall (relatedness heuristic required; design documents the rule)
- WHEN function list is empty THEN function miner returns early with no pós-rename warning (existing behavior)
- WHEN binary or merge commits appear THEN blind-spot detection SHALL not crash; skip or ignore non-applicable paths

---

## Requirement Traceability

| Requirement ID | Story                                        | Phase | Status  |
| -------------- | -------------------------------------------- | ----- | ------- |
| HOTSPOT-203    | P1: Unlinked / copy-paste warning            | Tasks | Pending |
| HOTSPOT-204    | P1: `--since` truncation warning             | Tasks | Pending |
| HOTSPOT-205    | P1: Ambiguous PathAliasMap warnings retained | Tasks | Pending |
| HOTSPOT-206    | P1: Find-renames (`-M`) on spawns            | Tasks | Pending |
| HOTSPOT-207    | P1: Stronger `git-log` fixtures              | Tasks | Pending |
| HOTSPOT-208    | P1: `with-renames` E2E churn + warnings      | Tasks | Pending |
| HOTSPOT-209    | P1: Function-mode pós-rename overlap warning | Tasks | Pending |
| HOTSPOT-210    | P2: Living docs                              | Tasks | Pending |

**ID range reserved:** HOTSPOT-203–HOTSPOT-220 (unused IDs intentionally left free).

**Coverage:** 8 total, 8 mapped to tasks, 0 unmapped.

---

## Success Criteria

- [ ] Real rename chains with find-renames unify under canonical path in fixture E2E
- [ ] Unlinked delete+add and `--since`+rename cases produce actionable warnings in unit tests
- [ ] Function mode emits pós-rename overlap warning when renames observed; silent when not
- [ ] No historical AST; no new JSON score fields; M27/M28 boundaries respected
- [ ] `pnpm build && pnpm test` passes
