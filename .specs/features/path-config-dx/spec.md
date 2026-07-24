# Milestone 30 — Path & Config DX Specification

**Feature slug:** `path-config-dx`  
**Milestone:** ROADMAP M30  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md)  
**Context:** [`.specs/features/path-config-dx/context.md`](./context.md) — exclude set + parent walk + `--config` locked  
**Sisters:** [config-file](../config-file/spec.md) (M21), [path-scoping](../path-scoping/spec.md) (M7)  
**Depth:** Large  
**Requirement IDs:** HOTSPOT-266 … (subset of 266–280)

## Problem Statement

Real monorepos accumulate framework build dirs (`.next`, Storybook static, `vendor`) and snapshot folders that M7 defaults do not skip, so scans stay noisy and slow. Teams also keep a single `.hotspot-scanner.json` above the scanned git root (workspace layout) or need CI to point at an explicit config path — M21 loads only `<repoPath>/.hotspot-scanner.json` with no walk and no `--config`.

## Goals

- [ ] Extend always-on default excludes with the locked monorepo set (`.next`, `out`, `vendor`, `storybook-static`, `__snapshots__`)
- [ ] Discover `.hotspot-scanner.json` via nearest-wins parent walk from `repoPath`
- [ ] Support `--config <path>` / `ScanOptions.configPath` (skips walk; missing file errors)
- [ ] Preserve M21 precedence: **CLI > config > defaults**; filename for discovery remains **only** `.hotspot-scanner.json`
- [ ] Document discovery + excludes in README / ARCHITECTURE; `pnpm build && pnpm test` green after Execute

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| `.hotspotrc` / dual filename lookup | **M21 locked — forbidden** |
| `--no-default-excludes` | M7 locked; defaults always on |
| Extra exclude names beyond locked set | YAGNI — see context.md cuts |
| Rewriting M7 patterns to `**/…/**` | Separate behavior change |
| Relaxing `repoPath/.git` validation / scan-from-package without `.git` | Not in ROADMAP M30 |
| New config keys (`format`, `output`, `baseline`, hooks) | M21 CLI-only lock |
| YAML/TOML config | JSON only |
| `.gitignore` / `.hotspotignore` | Future |

---

## User Stories

### P1: Extra default excludes ⭐ MVP

**User Story**: As a developer scanning a Next/Storybook monorepo, I want common build and snapshot directories excluded by default so rankings stay focused on application source.

**Why P1**: ROADMAP M30 primary DX item; builds on M7 `DEFAULT_EXCLUDE_PATTERNS`.

**Acceptance Criteria**:

1. WHEN `createPathScope()` is built with no user excludes THEN `DEFAULT_EXCLUDE_PATTERNS` SHALL include patterns covering `.next`, `out`, `vendor`, `storybook-static`, and `__snapshots__` per [context.md](./context.md) (`**/.next/**`, `**/out/**`, `**/vendor/**`, `**/storybook-static/**`, `**/__snapshots__/**`)
2. WHEN a path such as `apps/web/.next/static/chunk.js` or `packages/ui/src/__snapshots__/Button.test.ts.snap` is evaluated THEN `isPathInScope` SHALL return false under the default scope
3. WHEN discovery walks the tree THEN directories matching those patterns SHALL be pruned (`shouldPruneDirectory`) consistently with existing exclude semantics
4. WHEN M7 defaults (`node_modules`, `.git`, `dist`, `coverage`, `build`) are present THEN they SHALL remain in the default set unchanged
5. WHEN the user passes `--exclude` or config `exclude` THEN those patterns SHALL remain additive on top of all defaults

**Independent Test**: Unit tests on `DEFAULT_EXCLUDE_PATTERNS` / `isPathInScope` / `shouldPruneDirectory` with nested fixture paths.

**Requirements**: HOTSPOT-266, HOTSPOT-267

---

### P1: Parent-directory config walk ⭐ MVP

**User Story**: As a monorepo/workspace user, I want `.hotspot-scanner.json` found by walking parents of `repoPath` so one config can sit above the git root I scan.

**Why P1**: ROADMAP M30; unlocks workspace-level config without repeating files per clone.

**Acceptance Criteria**:

1. WHEN `<repoPath>/.hotspot-scanner.json` exists THEN it SHALL be loaded (nearest; no further walk)
2. WHEN the file is missing at `repoPath` but present in an ancestor directory THEN the nearest ancestor’s `.hotspot-scanner.json` SHALL be loaded
3. WHEN no `.hotspot-scanner.json` exists on the walk to filesystem root THEN load SHALL return `null` (not an error)
4. WHEN walking THEN the loader SHALL look **only** for `.hotspot-scanner.json` (never `.hotspotrc` or alternate names)
5. WHEN the nearest file is invalid JSON or has invalid key types THEN the CLI/`runScan` SHALL fail with `ConfigError` (non-zero exit) — same class as M21

**Independent Test**: Temp directory chain `workspace/.hotspot-scanner.json` + nested `workspace/repo/` (with `.git`); load from `repo` resolves workspace config.

**Requirements**: HOTSPOT-268, HOTSPOT-269, HOTSPOT-270, HOTSPOT-274

---

### P1: `--config <path>` / `configPath` ⭐ MVP

**User Story**: As a CI author, I want `--config <path>` so I can point at an explicit config file and skip discovery.

**Why P1**: ROADMAP M30 locked together with parent walk.

**Acceptance Criteria**:

1. WHEN `hotspot-scanner scan <path> --config <file>` is invoked THEN the tool SHALL load `<file>` and SHALL NOT parent-walk for discovery
2. WHEN `ScanOptions.configPath` is set for programmatic `runScan` / `resolveScanConfig` THEN the same explicit-load behavior SHALL apply
3. WHEN the explicit path does not exist THEN the tool SHALL throw `ConfigError` (or equivalent) and exit non-zero — unlike discovery miss
4. WHEN `--config` is omitted THEN discovery walk behavior SHALL apply
5. WHEN `--help` lists scan options THEN `--config` SHALL appear with a short description

**Independent Test**: CLI unit test with mocked/temp config path; unit test for `configPath` on loader.

**Requirements**: HOTSPOT-271, HOTSPOT-272, HOTSPOT-275

---

### P1: Precedence preserved ⭐ MVP

**User Story**: As a developer, I want CLI flags to still override config keys after discovery or `--config` so one-off runs do not require editing the file.

**Why P1**: M21 lock; M30 must not regress merge semantics.

**Acceptance Criteria**:

1. WHEN config (from walk or `--config`) and CLI both set the same option THEN the CLI value SHALL win
2. WHEN only the discovered/explicit config sets an option THEN that value SHALL override built-in defaults
3. WHEN neither sets an option THEN built-in defaults SHALL apply
4. WHEN `--config` only changes which file is read THEN option-value precedence SHALL remain CLI > config > defaults (discovery precedence is orthogonal)

**Independent Test**: Existing merge tests remain green; add cases with walked/explicit config path + CLI override.

**Requirements**: HOTSPOT-273

---

### P1: Documentation ⭐ MVP

**User Story**: As a reader, I want README and ARCHITECTURE to document the expanded defaults, parent walk, and `--config`.

**Why P1**: Living docs rule; M21 text currently says no parent walk and no `--config`.

**Acceptance Criteria**:

1. WHEN README config section is read THEN it SHALL describe parent walk, `--config`, filename-only discovery, and precedence
2. WHEN ARCHITECTURE config / path-scoping sections are read THEN default exclude list and discovery rules SHALL match this spec
3. WHEN STRUCTURE mentions `src/config/` THEN it SHOULD note walk + optional explicit path (brief)

**Independent Test**: Doc review against context.md locks.

**Requirements**: HOTSPOT-276, HOTSPOT-277

---

## Edge Cases

- WHEN `repoPath` is `.` THEN walk starts at resolved/ given path as today and still walks parents
- WHEN `--config` is a relative path THEN it SHALL resolve relative to **process cwd** (CLI convention), not necessarily `repoPath`
- WHEN `--config` points at a valid JSON file with a non-standard basename THEN it SHALL still parse with the same key schema
- WHEN both `<repoPath>/.hotspot-scanner.json` and a parent config exist THEN nearest (`repoPath`) wins
- WHEN explicit `--config` is set AND a nearer walk target also exists THEN explicit path wins (walk skipped)
- WHEN `out/` or `vendor/` is intentional application source THEN paths under those names are out of scope by default (same class of tradeoff as M7 `build/`); user must rely on narrower `--include` only where exclude does not win — document; no opt-out flag in M30
- WHEN bin pre-merges config for `top` AND `runScan` loads again THEN both SHALL use the same `configPath` / discovery rules (no divergent results)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-266 | P1: Extra default excludes (patterns) | Tasks | Pending |
| HOTSPOT-267 | P1: Excludes apply via PathScope | Tasks | Pending |
| HOTSPOT-268 | P1: Parent walk discovery | Tasks | Pending |
| HOTSPOT-269 | P1: Nearest-wins + root stop | Tasks | Pending |
| HOTSPOT-270 | P1: Walk miss → null | Tasks | Pending |
| HOTSPOT-271 | P1: `--config` CLI | Tasks | Pending |
| HOTSPOT-272 | P1: Explicit missing → error | Tasks | Pending |
| HOTSPOT-273 | P1: Precedence preserved | Tasks | Pending |
| HOTSPOT-274 | P1: Discovery filename only `.hotspot-scanner.json` | Tasks | Pending |
| HOTSPOT-275 | P1: `ScanOptions.configPath` + wiring | Tasks | Pending |
| HOTSPOT-276 | P1: README / ARCHITECTURE | Tasks | Pending |
| HOTSPOT-277 | P1: Help text for `--config` | Tasks | Pending |

**Unused band:** HOTSPOT-278 … HOTSPOT-280 (reserved; gaps OK)  
**Coverage:** 12 total, mapped in tasks.md

---

## Success Criteria

- [ ] Locked exclude patterns present and tested at nested paths
- [ ] Parent walk + `--config` behaviors proven by unit/CLI tests
- [ ] No dual filename lookup; precedence unchanged
- [ ] Docs match context.md
- [ ] Full gate `pnpm build && pnpm test` green
