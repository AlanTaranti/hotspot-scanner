# Milestone 39 — CLI Init / Doctor / Dry-run Specification

**Feature slug:** `cli-init-doctor-dry-run`  
**Milestone:** ROADMAP M39  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md)  
**Context:** [`.specs/features/cli-init-doctor-dry-run/context.md`](./context.md) — doctor exit policy + init path + dry-run contract locked  
**Sisters:** [config-file](../config-file/spec.md) (M21), [path-config-dx](../path-config-dx/spec.md) (M30), [path-scoping](../path-scoping/spec.md) (M7)  
**Depth:** Large  
**Requirement IDs:** HOTSPOT-470–489  
**Items:** 3, 4, 26

## Problem Statement

Adopters need a safe on-ramp: an exemplar config file without hand-copying docs, a pre-flight check that the environment and repo can be scanned, and a cheap way to see which files would be in scope before paying for full git history + AST. Today only `scan` exists — misconfigured paths, missing git/Node, or overly wide includes are discovered only after a full run.

## Goals

- [ ] `hotspot-scanner init [dir]` writes exemplar `.hotspot-scanner.json` (no overwrite without `--force`)
- [ ] `hotspot-scanner doctor [path]` reports Node engines, git on PATH, git repo, config discovery/validity, tsconfig/jsconfig info — with locked exit policy
- [ ] `scan --dry-run` prints effective since/include/exclude, eligible file count, concurrency — without mine/AST/scoring
- [ ] Reuse M21/M30 config rules and M36 `discoverSourceFiles` / PathScope helpers
- [ ] Document commands in README / ARCHITECTURE / STRUCTURE; `pnpm build && pnpm test` green after Execute

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| M38 polish (`--quiet`, aliases, default scan `.`) | Separate milestone; do not depend on aliases |
| M40 `baseline save` / workflow subcommands | Separate milestone |
| Changing PathScope / default exclude set | Preview only; M7/M30 locks stand |
| Interactive init wizard / TTY prompts | YAGNI |
| Auto-fix from doctor | Diagnose only |
| JSON Schema for config file | YAGNI (parse rules already in `src/config/`) |
| npm publish / npx install path | Deferred backlog |
| Machine-readable doctor/dry-run JSON | YAGNI — text stdout |

---

## User Stories

### P1: `init` writes exemplar config ⭐ MVP

**User Story**: As a developer adopting hotspot-scanner, I want `hotspot-scanner init` to create a valid exemplar `.hotspot-scanner.json` in my project so I can edit shared defaults without copying from README.

**Why P1**: ROADMAP item 3; primary adoption DX.

**Acceptance Criteria**:

1. WHEN `hotspot-scanner init` runs with no path THEN the tool SHALL write `<cwd>/.hotspot-scanner.json` with the locked exemplar keys/values from [context.md](./context.md)
2. WHEN `hotspot-scanner init <dir>` runs and `<dir>` is an existing directory THEN the tool SHALL write `<dir>/.hotspot-scanner.json`
3. WHEN the target file does not exist THEN the tool SHALL create it (UTF-8, 2-space indent, trailing newline) and exit `0`
4. WHEN the target file already exists and `--force` is absent THEN the tool SHALL NOT overwrite and SHALL exit non-zero (`2`) with a message mentioning `--force`
5. WHEN `--force` is present and the file exists THEN the tool SHALL overwrite with the exemplar and exit `0`
6. WHEN `<dir>` is missing or not a directory THEN the tool SHALL fail with `CliUsageError` (exit `2`)
7. WHEN `--help` lists commands THEN `init` SHALL appear with a short description

**Independent Test**: Temp directory; run init; assert file contents; re-run without `--force` fails; with `--force` succeeds.

**Requirements**: HOTSPOT-470, HOTSPOT-471, HOTSPOT-472, HOTSPOT-473, HOTSPOT-474, HOTSPOT-475, HOTSPOT-476

---

### P1: `doctor` environment and repo checks ⭐ MVP

**User Story**: As a developer, I want `hotspot-scanner doctor [path]` to verify Node, git, repo, and config before a scan so I can fix setup failures quickly.

**Why P1**: ROADMAP item 4; reduces failed full scans.

**Acceptance Criteria**:

1. WHEN `doctor` runs with no path THEN the target SHALL be `process.cwd()`; WITH `<path>` THEN that path SHALL be the target
2. WHEN Node does not satisfy `engines.node` (`>=22`) THEN doctor SHALL report a hard failure and exit non-zero (`1`)
3. WHEN `git` is not found on `PATH` THEN doctor SHALL report a hard failure and exit non-zero (`1`)
4. WHEN the target is not a git repository (`<path>/.git` missing) THEN doctor SHALL report a hard failure and exit non-zero (`1`)
5. WHEN config discovery finds a valid `.hotspot-scanner.json` (walk or `--config`) THEN doctor SHALL report pass and the resolved path
6. WHEN no config is found on the walk THEN doctor SHALL report a soft warning/info and SHALL exit `0` if no hard failures exist
7. WHEN config is invalid (JSON/types) or explicit `--config` is missing THEN doctor SHALL fail hard with `ConfigError` class (exit `2`)
8. WHEN a nearest `tsconfig.json` or `jsconfig.json` exists under/at the target (informational walk) THEN doctor SHALL print its path; WHEN neither exists THEN doctor SHALL print an informational soft note and still exit `0` if otherwise healthy
9. WHEN multiple checks run THEN doctor SHALL print all findings (pass/warn/fail) before exiting with the aggregate policy in [context.md](./context.md)

**Independent Test**: Unit tests with mocked Node version / `which git` / temp dirs with and without `.git` and config; CLI tests for exit codes.

**Requirements**: HOTSPOT-477, HOTSPOT-478, HOTSPOT-479, HOTSPOT-480, HOTSPOT-481, HOTSPOT-482, HOTSPOT-483, HOTSPOT-484

---

### P1: `scan --dry-run` scope preview ⭐ MVP

**User Story**: As a developer tuning include/exclude, I want `scan --dry-run` to show effective scope and eligible file count without running the full pipeline so I can iterate quickly.

**Why P1**: ROADMAP item 26; expensive mis-scope prevention.

**Acceptance Criteria**:

1. WHEN `hotspot-scanner scan <path> --dry-run` runs THEN the tool SHALL print a text preview including effective `since`, `include`, `exclude` (user/config), eligible source file count, and effective `concurrency`
2. WHEN dry-run runs THEN the tool SHALL NOT invoke Git Change Miner history mining, Complexity Analyzer AST/workers, hotspot/coupling scoring, or report ranking renderers
3. WHEN dry-run runs THEN the tool SHALL still validate repo path + git repo, load/merge config (CLI > config > defaults), build PathScope, and call `discoverSourceFiles` for the count
4. WHEN `--baseline` is combined with `--dry-run` THEN the tool SHALL reject with `CliUsageError`
5. WHEN `--format` or `--output` is set with `--dry-run` THEN the tool SHALL ignore them for preview (plain text stdout) without error
6. WHEN scope/config flags (`--since`, `--include`, `--exclude`, `--config`, `--concurrency`) are set THEN dry-run SHALL reflect the same merged values a full scan would use
7. WHEN `--help` for `scan` is shown THEN `--dry-run` SHALL be listed with a short description

**Independent Test**: CLI/unit test spies that miner/analyzer/scorer are not called; fixture `small-ts` asserts count > 0 and preview fields present.

**Requirements**: HOTSPOT-485, HOTSPOT-486, HOTSPOT-487, HOTSPOT-488, HOTSPOT-489

---

## Edge Cases

- WHEN `init` target directory exists but is not writable THEN the tool SHALL fail with a clear I/O error (non-zero)
- WHEN `doctor` target path does not exist THEN hard failure (exit `1`)
- WHEN dry-run discovery yields zero eligible files THEN preview SHALL show count `0` and exit `0` (not an error)
- WHEN dry-run config is invalid THEN exit `2` via `ConfigError` before preview (same as scan)
- WHEN doctor has both soft warnings and hard failures THEN exit non-zero and still print soft findings
- WHEN `init` is given a path that is an existing file (not a directory) THEN `CliUsageError`

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-470 | P1: init cwd write | Tasks | Pending |
| HOTSPOT-471 | P1: init optional dir | Tasks | Pending |
| HOTSPOT-472 | P1: no overwrite without `--force` | Tasks | Pending |
| HOTSPOT-473 | P1: `--force` overwrite | Tasks | Pending |
| HOTSPOT-474 | P1: exemplar keys/values | Tasks | Pending |
| HOTSPOT-475 | P1: init help | Tasks | Pending |
| HOTSPOT-476 | P1: init success exit 0 | Tasks | Pending |
| HOTSPOT-477 | P1: doctor Node engines | Tasks | Pending |
| HOTSPOT-478 | P1: doctor git on PATH | Tasks | Pending |
| HOTSPOT-479 | P1: doctor git repo | Tasks | Pending |
| HOTSPOT-480 | P1: doctor config discovery/validity | Tasks | Pending |
| HOTSPOT-481 | P1: doctor tsconfig/jsconfig info | Tasks | Pending |
| HOTSPOT-482 | P1: doctor hard-fail exit | Tasks | Pending |
| HOTSPOT-483 | P1: doctor soft warn exit 0 | Tasks | Pending |
| HOTSPOT-484 | P1: doctor path default cwd | Tasks | Pending |
| HOTSPOT-485 | P1: dry-run prints effective scope | Tasks | Pending |
| HOTSPOT-486 | P1: dry-run eligible file count | Tasks | Pending |
| HOTSPOT-487 | P1: dry-run concurrency | Tasks | Pending |
| HOTSPOT-488 | P1: dry-run skips mine/AST/scoring | Tasks | Pending |
| HOTSPOT-489 | P1: dry-run help + flag interactions | Tasks | Pending |

**Coverage:** 20 total (HOTSPOT-470–489), mapped in tasks.md.

---

## Success Criteria

- [ ] `init`, `doctor`, and `scan --dry-run` work on `tests/fixtures/repos/small-ts` (and temp dirs for init)
- [ ] Doctor exit policy matches [context.md](./context.md) for hard vs soft
- [ ] Dry-run completes without spawning git log mine / AST workers
- [ ] Living docs mention the three surfaces
- [ ] `pnpm build && pnpm test` green after Execute
