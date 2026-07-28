# Milestone 52 — Doctor Scope Parity Specification

**Feature slug:** `doctor-scope-parity`  
**Milestone:** ROADMAP M52  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md)  
**Context:** [`.specs/features/doctor-scope-parity/context.md`](./context.md) — prelude, remount git finding, `scope` finding, M46 forward-compat locked  
**Sisters:** [cli-init-doctor-dry-run](../cli-init-doctor-dry-run/spec.md) (M39), [monorepo-path-detect](../monorepo-path-detect/spec.md) (M43), [exclude-tests-by-default](../exclude-tests-by-default/spec.md) (M46)  
**Depth:** Medium  
**Requirement IDs:** HOTSPOT-800–819  
**Priority:** Medium

## Problem Statement

`runScan` and `previewScanScope` share `resolveScanPipelineContext` (M43 remount, M30 config walk, merge, git validation on the git root). `runDoctor` still calls `validateGitRepository` on the **request path**, so `doctor packages/api` fails while `scan packages/api` succeeds. Doctor also never reports PathScope / eligible-file semantics, so the adoption path `doctor → dry-run → scan` disagrees on “what would be scanned.” M46 will change default excludes; doctor must not fork a second scope builder that drifts from dry-run/`runScan`.

## Goals

- [x] `runDoctor` uses `resolveScanPipelineContext` (or shared prelude) so monorepo remount + path scope match scan
- [x] Doctor, dry-run, and `runScan` share one prelude chain (config merge, PathScope, eligible-count semantics)
- [x] New doctor `scope` finding reports inventory aligned with `previewScanScope` for the same options
- [x] Forward-compat with M46 `includeTests` / test excludes without owning PathScope defaults
- [x] Living docs updated; `pnpm build && pnpm test` green after Execute

## Out of Scope

| Feature                                                | Reason                                                   |
| ------------------------------------------------------ | -------------------------------------------------------- |
| `doctor --format json`                                 | M51 — additive findings only; do not implement JSON here |
| Changing PathScope / test-exclude defaults             | M46 owns that                                            |
| Workspace yaml / nx / turborepo parsers                | YAGNI (M43 lock)                                         |
| Doctor `--include` / `--exclude` / `--since` CLI flags | YAGNI — use config or `scan --dry-run`                   |
| Auto-fix / mutating repo from doctor                   | Diagnose only (M39)                                      |
| Ranking / miner / AST / JSON contract changes          | Unrelated                                                |

---

## User Stories

### P1: Doctor remount + git-root parity ⭐ MVP

**User Story**: As a developer in a monorepo package directory, I want `hotspot-scanner doctor .` to succeed the same way `scan .` does so pre-flight matches the real scan path.

**Why P1**: Core ROADMAP gap; false hard fail blocks adoption DX.

**Acceptance Criteria**:

1. WHEN `runDoctor` runs on a nested path inside a git workspace THEN it SHALL resolve via `resolveScanPipelineContext` (remount to git toplevel) rather than requiring `.git` on the nested directory
2. WHEN remount applies THEN the `git-repo` finding SHALL pass and SHALL name the **pipeline git root** (and MAY mention remount / auto-include)
3. WHEN the request path is already the git root THEN behavior SHALL remain a healthy pass with that path as the repo
4. WHEN the path is not in a git work tree THEN doctor SHALL still hard-fail (`git-repo` fail, exit `1`)
5. WHEN Node / `git` on PATH checks run THEN they SHALL remain unchanged and precede prelude

**Independent Test**: `monorepo-nested` (or temp nested tree): doctor from package dir exit `0`; assert `git-repo` message references git root; non-git temp dir still exit `1`.

**Requirements**: HOTSPOT-800, HOTSPOT-801, HOTSPOT-802, HOTSPOT-810

---

### P1: Shared prelude + PathScope chain ⭐ MVP

**User Story**: As a maintainer, I want doctor, dry-run, and `runScan` to build PathScope from the same merged config + optional `includeTests` so eligible counts cannot silently diverge.

**Why P1**: ROADMAP “one prelude chain”; prevents M46 drift.

**Acceptance Criteria**:

1. WHEN `runScan`, `previewScanScope`, and doctor inventory run THEN they SHALL all obtain merge/remount via `resolveScanPipelineContext` (doctor directly or through preview)
2. WHEN PathScope is constructed for scan / dry-run / doctor inventory THEN it SHALL go through one shared helper (or equivalent single call site pattern) that accepts `merged.include` / `merged.exclude` and optional `includeTests`
3. WHEN M46 is Done and `includeTests` is omitted/false THEN PathScope SHALL include built-in test excludes (M46 defaults) for all three entry points
4. WHEN M46 is Done and `includeTests: true` THEN all three entry points SHALL lift only built-in test patterns the same way
5. WHEN M46 is not yet Done THEN the shared helper SHALL still compile and behave with current PathScope API (optional flag ignored or absent)
6. WHEN config discovery runs under remount THEN it SHALL still start from the **original request path** (M30/M43 unchanged)

**Independent Test**: Unit/integration asserting doctor eligible count === `previewScanScope(...).eligibleFileCount` for identical options; after M46, same with/without `includeTests`.

**Requirements**: HOTSPOT-803, HOTSPOT-804, HOTSPOT-806, HOTSPOT-807, HOTSPOT-814

---

### P1: Doctor `scope` finding (eligible-count parity) ⭐ MVP

**User Story**: As an operator running doctor before dry-run, I want a scope finding that shows the same eligible file count dry-run would report so I trust the pre-flight.

**Why P1**: Makes “parity” observable without inventing doctor JSON.

**Acceptance Criteria**:

1. WHEN prelude succeeds THEN doctor SHALL emit a finding with `id: "scope"` and `status: "pass"`
2. WHEN `scope` is emitted THEN its message (or structured fields used to build the message) SHALL reflect pipeline `repoPath`, effective include/exclude consistent with dry-run, and `eligible files: N` where `N` equals `previewScanScope` for the same options
3. WHEN remount applied THEN the `scope` (and/or `git-repo`) message SHALL make remount observable (aligned with `MONOREPO_PATH_REMOUNT` intent)
4. WHEN eligible count is `0` THEN `scope` SHALL still be `pass` (not a hard fail)
5. WHEN path/git prelude fails THEN doctor SHALL NOT invent a misleading successful `scope` finding
6. WHEN doctor runs THEN it SHALL NOT invoke Git Change Miner, Complexity Analyzer workers/AST scoring path, hotspot/coupling scorers, or report ranking renderers

**Independent Test**: Spy/assert no mine/analyze; compare doctor scope count to `previewScanScope` on `small-ts` and nested fixture.

**Requirements**: HOTSPOT-805, HOTSPOT-808, HOTSPOT-815

---

### P1: Config soft-warn preserved ⭐ MVP

**User Story**: As a first-time adopter without a config file, I want doctor to keep warning about missing config while still reporting remounted scope so I know defaults apply.

**Why P1**: M39 soft-warn UX must not regress when wiring prelude.

**Acceptance Criteria**:

1. WHEN no `.hotspot-scanner.json` is found on the request-path walk THEN `config` SHALL remain a soft warn and exit `0` if no hard failures
2. WHEN config is invalid or explicit `--config` is missing THEN `config` SHALL fail and exit `2`
3. WHEN valid config exists THEN `config` SHALL pass with a resolved path message

**Independent Test**: Existing doctor config tests remain green; nested path without config still warns + exit `0` when otherwise healthy.

**Requirements**: HOTSPOT-809

---

### P1: Documentation & architecture sync ⭐ MVP

**User Story**: As a reader of ARCHITECTURE / README, I want doctor documented as sharing the scan prelude (including M43 remount and, when M46 Done, test excludes) so docs match behavior.

**Why P1**: Living docs rule; adoption path must stay truthful.

**Acceptance Criteria**:

1. WHEN reading ARCHITECTURE CLI / monorepo / doctor sections THEN doctor SHALL be described as using `resolveScanPipelineContext` + scope inventory parity with dry-run
2. WHEN reading STRUCTURE THEN doctor / scan-preview / shared helper notes SHALL reflect the wiring
3. WHEN reading README adoption path (`init` → `doctor` → dry-run → scan) THEN monorepo package-cwd doctor SHALL not be described as requiring local `.git` on the package dir
4. WHEN M51 is referenced THEN docs/spec MAY note that `scope` is an additive finding id for future JSON (no JSON implementation in M52)

**Independent Test**: Docs checklist in Done when (no automated doc tests).

**Requirements**: HOTSPOT-811, HOTSPOT-812

---

### P2: Doctor CLI `--include-tests` (when M46 Done)

**User Story**: As an operator auditing test-suite health, I want `doctor --include-tests` so the scope finding matches `scan --dry-run --include-tests`.

**Why P2**: Completes forward-compat at CLI; API field is P1.

**Acceptance Criteria**:

1. WHEN M46 is Done and `hotspot-scanner doctor … --include-tests` is invoked THEN `RunDoctorOptions.includeTests` SHALL be `true` and eligible count SHALL match dry-run with the same flag
2. WHEN `--include-tests` is omitted THEN doctor SHALL use default PathScope policy (tests excluded after M46)
3. WHEN M46 is not Done at Execute time THEN this story MAY be deferred to the same Execute once M46 lands, without blocking remount/`scope` P1

**Independent Test**: CLI parse/forward test mirroring scan’s `--include-tests` (after M46).

**Requirements**: HOTSPOT-813

---

## Edge Cases

- WHEN doctor target is nested and remounted AND user has package-local config THEN config walk from request path still finds it; scope uses merged values + auto-include unless CLI include were passed (doctor has no include flag — auto-include applies)
- WHEN doctor target is nested AND ancestor config sets `include` THEN merge precedence unchanged; remount auto-include still injects only when `ScanOptions.include === undefined` (doctor programmatic options follow same rule)
- WHEN `scope` pass coexists with `config` warn THEN exit remains `0`
- WHEN both `git-repo` fail and config would fail THEN print findings per M39 (all collected where possible); exit non-zero per aggregate policy
- WHEN M51 JSON formatter already exists THEN adding `id: "scope"` SHALL not require schema changes beyond listing known ids if any enum exists — prefer open string union already used

---

## Requirement Traceability

| Requirement ID  | Story                                        | Phase | Status  |
| --------------- | -------------------------------------------- | ----- | ------- |
| HOTSPOT-800     | P1: Doctor uses `resolveScanPipelineContext` | Tasks | Pending |
| HOTSPOT-801     | P1: Nested package doctor succeeds           | Tasks | Pending |
| HOTSPOT-802     | P1: `git-repo` names pipeline root / remount | Tasks | Pending |
| HOTSPOT-803     | P1: Config discovery from request path       | Tasks | Pending |
| HOTSPOT-804     | P1: Shared PathScope helper + `includeTests` | Tasks | Pending |
| HOTSPOT-805     | P1: Doctor `scope` finding                   | Tasks | Pending |
| HOTSPOT-806     | P1: Eligible count === dry-run               | Tasks | Pending |
| HOTSPOT-807     | P1: M46 `includeTests` forward-compat        | Tasks | Pending |
| HOTSPOT-808     | P1: Zero eligible still `scope` pass         | Tasks | Pending |
| HOTSPOT-809     | P1: Config soft-warn preserved               | Tasks | Pending |
| HOTSPOT-810     | P1: Exit policy / Node+git-path unchanged    | Tasks | Pending |
| HOTSPOT-811     | P1: Docs ARCHITECTURE/STRUCTURE/README       | Tasks | Pending |
| HOTSPOT-812     | P1: M51 additive finding note                | Tasks | Pending |
| HOTSPOT-813     | P2: Doctor CLI `--include-tests`             | Tasks | Pending |
| HOTSPOT-814     | P1: Single PathScope call-site pattern       | Tasks | Pending |
| HOTSPOT-815     | P1: Fixture / integration parity tests       | Tasks | Pending |
| HOTSPOT-816–819 | Reserved                                     | —     | —       |

**Coverage:** 16 mapped (800–815), 4 reserved (816–819).

---

## Success Criteria

- [x] `doctor` on `tests/fixtures/repos/monorepo-nested` package path exits `0` with remount-aware `git-repo` + `scope`
- [x] Doctor eligible count matches `previewScanScope` for the same options (including `includeTests` when M46 Done)
- [x] Healthy `small-ts` doctor regression still exit `0`
- [x] Non-git path still hard-fails
- [x] `pnpm build && pnpm test` green after Execute
