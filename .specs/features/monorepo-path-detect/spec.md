# Milestone 43 — Monorepo Path Detect Specification

**Feature slug:** `monorepo-path-detect`  
**Milestone:** ROADMAP M43  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md)  
**Context:** [`.specs/features/monorepo-path-detect/context.md`](./context.md) — remount + auto-include locked  
**Sisters:** [path-scoping](../path-scoping/spec.md) (M7), [path-config-dx](../path-config-dx/spec.md) (M30)  
**Depth:** Medium–Large  
**Requirement IDs:** HOTSPOT-570 … HOTSPOT-589

## Problem Statement

Developers often run the CLI from a monorepo package directory (`cd packages/api && hotspot-scanner scan .`). Today `validateGitRepository` requires `{repoPath}/.git`, so a nested package path fails even though a parent git root exists. The workaround (`scan` from the workspace root with `--include packages/api/**`) is correct but easy to forget. M30 improved excludes and config walk but explicitly deferred “scan-from-package without `.git`” to this milestone.

## Goals

- [ ] Detect git toplevel when the scan path is a subdirectory of a git workspace and remount pipeline `repoPath` to that root
- [ ] Auto-apply `--include` scoped to the package-relative prefix unless the user already passed `--include`
- [ ] Preserve unchanged behavior when the scan path is already a git root
- [ ] Keep CLI > config > defaults precedence; do not change default excludes
- [ ] Document the heuristic; `pnpm build && pnpm test` green after Execute

## Out of Scope

| Feature                                        | Reason                                         |
| ---------------------------------------------- | ---------------------------------------------- |
| Scanning without git                           | Explicitly out of scope                        |
| Changing `DEFAULT_EXCLUDE_PATTERNS`            | M30 owns that set                              |
| Breaking / rewriting CLI > config > defaults   | Precedence unchanged                           |
| Parsing `pnpm-workspace.yaml` / nx / turborepo | YAGNI — path-only heuristic                    |
| `--no-remount` disable flag                    | YAGNI — scan from git root or pass `--include` |
| Changing PathScope match semantics             | Reuse M7 `createPathScope`                     |

---

## User Stories

### P1: Remount nested path to git root ⭐ MVP

**User Story**: As a developer in `packages/api`, I want `hotspot-scanner scan .` to use the workspace git root so the miner validates and runs successfully.

**Why P1**: ROADMAP M43 primary failure mode; unlocks package-cwd scans.

**Acceptance Criteria**:

1. WHEN `requestPath` exists as a directory and `git rev-parse --show-toplevel` from that path returns a parent (or equal) directory THEN `runScan` SHALL use that toplevel as pipeline `repoPath`
2. WHEN `requestPath` is already the git toplevel THEN pipeline `repoPath` SHALL equal that path (normalized) and behavior SHALL match pre-M43 git-root scans
3. WHEN `requestPath` is not inside any git work tree THEN `runScan` / CLI SHALL fail with a clear non-zero exit (same class as today’s “not a git repository”) before mining
4. WHEN remount applies THEN `validateGitRepository` SHALL check `.git` on the **git root**, not on the nested package directory
5. WHEN an explicit relative or absolute nested package path is passed (not only `.`) THEN the same remount SHALL apply

**Independent Test**: Temp monorepo fixture with `.git` at root and `packages/api/`; `runScan({ repoPath: …/packages/api })` succeeds; git-root path still succeeds.

**Requirements**: HOTSPOT-570, HOTSPOT-571, HOTSPOT-572, HOTSPOT-573

---

### P1: Auto-include package prefix ⭐ MVP

**User Story**: As a developer scanning from a package directory, I want results scoped to that package by default so I do not get the entire monorepo ranking.

**Why P1**: Remount without include would silently scan the whole workspace — worse DX than failing.

**Acceptance Criteria**:

1. WHEN remount applies and CLI / `ScanOptions` did **not** supply `include` THEN the effective include SHALL contain `{posixRelativePrefix}/**` (e.g. `packages/api/**`)
2. WHEN remount applies and the user passed CLI `--include` (or programmatic `include` is defined) THEN auto-include SHALL **not** be applied; user patterns SHALL win
3. WHEN auto-include is applied THEN it SHALL participate as CLI-level include in `mergeScanOptions` (beats config `include`)
4. WHEN the scan path is the git root THEN no auto-include SHALL be injected
5. WHEN PathScope is built AFTER merge THEN complexity discovery and git stats SHALL honor the auto-include the same as an explicit `--include`

**Independent Test**: Nested fixture with files under `packages/api` and `packages/other`; scan from `packages/api` without `--include` → only `packages/api/**` paths in rankings; with `--include "packages/other/**"` → other package only.

**Requirements**: HOTSPOT-574, HOTSPOT-575, HOTSPOT-576, HOTSPOT-577

---

### P1: Config discovery stays on request path ⭐ MVP

**User Story**: As a monorepo user with `.hotspot-scanner.json` near my package or workspace, I want config discovery to keep M30 semantics from my cwd/path while git runs from the root.

**Why P1**: Avoid regressing M30 parent walk / `--config` when remounting.

**Acceptance Criteria**:

1. WHEN remount applies THEN `loadHotspotScannerConfig` (bin pre-merge and `resolveScanConfig` / `runScan`) SHALL still start discovery from the **original** `requestPath` unless `--config` / `configPath` is set
2. WHEN `--config` is set THEN explicit-load behavior SHALL remain unchanged (skip walk; missing → `ConfigError`)
3. WHEN CLI > config > defaults merge runs THEN only the locked auto-include injection may add a synthetic CLI `include`; no other precedence changes

**Independent Test**: Nested path with ancestor `.hotspot-scanner.json` setting `since` or `top`; scan from package dir loads that config; remount still uses git root.

**Requirements**: HOTSPOT-578, HOTSPOT-579, HOTSPOT-580

---

### P1: Remount diagnostic ⭐ MVP

**User Story**: As a developer, I want a clear info diagnostic when the tool remounts my path so the heuristic is not silent magic.

**Why P1**: ROADMAP requires documented heuristic; stderr/info warning makes it observable in tests and UX.

**Acceptance Criteria**:

1. WHEN remount applies THEN `meta.warnings` / `onWarning` SHALL include a `ScanWarning` with `code: "MONOREPO_PATH_REMOUNT"`, `severity: "info"`, and a message naming the git root (and auto-include pattern when applied)
2. WHEN no remount applies THEN that code SHALL NOT appear
3. WHEN remount applies with user `--include` THEN the warning SHALL still report remount without claiming auto-include was added

**Independent Test**: Unit/integration assert warning code present/absent for nested vs root paths.

**Requirements**: HOTSPOT-581, HOTSPOT-582

---

### P2: Documentation

**User Story**: As a new user, I want README / ARCHITECTURE to explain package-cwd scans so I know when remount and auto-include happen.

**Why P2**: ROADMAP “documented heuristic only”; reduces support confusion.

**Acceptance Criteria**:

1. WHEN docs are updated THEN README (or linked recipe) SHALL describe: nested path → git root + `{prefix}/**` unless `--include` set
2. WHEN ARCHITECTURE path-scoping / config sections are updated THEN they SHALL mention remount order (config from request path; pipeline from git root)
3. WHEN documenting YAGNI THEN docs SHALL state no workspace-yaml / nx special cases

**Independent Test**: Doc review in docs task; no runtime test.

**Requirements**: HOTSPOT-583, HOTSPOT-584

---

## Edge Cases

- WHEN `requestPath` resolves to the same directory as git toplevel (including `.` at repo root) THEN system SHALL NOT remount or auto-include
- WHEN `relative(gitRoot, requestPath)` would escape the root (path outside work tree) THEN system SHALL fail clearly (not invent a prefix)
- WHEN git worktree uses a `.git` **file** at the root THEN remount + validation SHALL succeed (M7 worktree rule preserved on the root)
- WHEN nested path is itself a separate git repo (own `.git`) THEN `show-toplevel` returns that nested root → no parent remount (correct)
- WHEN `include` is empty array from explicit CLI `--include` with no patterns — existing CLI validation rejects empty patterns; no change required
- WHEN only config `include` is set and remount applies THEN auto-include SHALL still inject and override config `include` (locked)

---

## Requirement Traceability

| Requirement ID | Story                                                       | Phase | Status   |
| -------------- | ----------------------------------------------------------- | ----- | -------- |
| HOTSPOT-570    | P1: Remount                                                 | Tasks | In Tasks |
| HOTSPOT-571    | P1: Remount (git root unchanged)                            | Tasks | In Tasks |
| HOTSPOT-572    | P1: Remount (not a git work tree)                           | Tasks | In Tasks |
| HOTSPOT-573    | P1: Remount (explicit nested path)                          | Tasks | In Tasks |
| HOTSPOT-574    | P1: Auto-include pattern                                    | Tasks | In Tasks |
| HOTSPOT-575    | P1: Auto-include suppressed by CLI include                  | Tasks | In Tasks |
| HOTSPOT-576    | P1: Auto-include beats config include                       | Tasks | In Tasks |
| HOTSPOT-577    | P1: Scope applied to git + complexity                       | Tasks | In Tasks |
| HOTSPOT-578    | P1: Config from requestPath                                 | Tasks | In Tasks |
| HOTSPOT-579    | P1: `--config` unchanged                                    | Tasks | In Tasks |
| HOTSPOT-580    | P1: Precedence preserved                                    | Tasks | In Tasks |
| HOTSPOT-581    | P1: `MONOREPO_PATH_REMOUNT` warning                         | Tasks | In Tasks |
| HOTSPOT-582    | P1: No warning on git-root path                             | Tasks | In Tasks |
| HOTSPOT-583    | P2: README / recipe docs                                    | Tasks | In Tasks |
| HOTSPOT-584    | P2: ARCHITECTURE docs                                       | Tasks | In Tasks |
| HOTSPOT-585    | (reserved) Fixture monorepo package tree                    | Tasks | In Tasks |
| HOTSPOT-586    | (reserved) CLI nested-cwd smoke                             | Tasks | In Tasks |
| HOTSPOT-587    | (reserved) Library API parity                               | Tasks | In Tasks |
| HOTSPOT-588    | (reserved) STRUCTURE / INTEGRATIONS note if git spawn added | Tasks | In Tasks |
| HOTSPOT-589    | (reserved) Full gate                                        | Tasks | In Tasks |

**Coverage:** 20 IDs in range; P1 mapped to HOTSPOT-570–582; P2 to 583–584; fixture/CLI/docs/gate 585–589.

---

## Success Criteria

- [ ] `scan` from a nested package directory exits 0 and ranks only that package (unless `--include` overrides)
- [ ] `scan` from git root behaves as before (no surprise include)
- [ ] Config walk / `--config` / merge precedence unchanged aside from locked auto-include
- [ ] Heuristic documented; no workspace-tool parsers
- [ ] `pnpm build && pnpm test` passes after Execute
