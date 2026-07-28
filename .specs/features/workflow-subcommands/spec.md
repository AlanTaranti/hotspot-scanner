# Milestone 40 — Workflow Subcommands Specification

**Feature slug:** `workflow-subcommands`  
**Milestone:** ROADMAP M40  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [TESTING.md](../../codebase/TESTING.md)  
**Context:** [`.specs/features/workflow-subcommands/context.md`](./context.md)  
**Sister:** [scan-compare](../scan-compare/spec.md) (M13)

## Problem Statement

M13 enables delta reports via `scan --baseline`, but saving a baseline still requires remembering `--format json --output …`, and compare is buried as a scan flag. CI recipes and README workflows need explicit **save** and **compare** verbs that wrap the existing JSON/compare path without a persistence layer or schema change.

## Goals

- [ ] `hotspot-scanner baseline save <repoPath>` writes a loadable `ScanResult` JSON baseline (default `./hotspot-baseline.json`)
- [ ] `hotspot-scanner compare <repoPath> --baseline <file>` produces the same delta report as `scan --baseline`
- [ ] `scan --baseline` remains fully supported (no removal)
- [ ] Domain logic stays in `src/` (`runScan`, `loadBaseline`, `compareScanResults`, reporters); bin wires only
- [ ] JSON files only — no DB or new persistence
- [ ] `pnpm build && pnpm test` passing after Execute

## Out of Scope

| Feature                                             | Reason                                 |
| --------------------------------------------------- | -------------------------------------- |
| Fail-on thresholds / non-zero exit on delta content | STATE / M12 removed                    |
| CI action packaging (GitHub Action, etc.)           | Future backlog                         |
| Changing `CompareResult` or `ScanResult` schema     | Reuse M13/M20 contracts                |
| Deprecating or removing `scan --baseline`           | Locked keep                            |
| Database / remote baseline store                    | Locked: JSON files only                |
| `--force` / `--no-clobber` on baseline save         | YAGNI — overwrite like `scan --output` |
| New scoring, git, or complexity behavior            | CLI surface only                       |

---

## User Stories

### P1: `baseline save` writes ScanResult JSON ⭐ MVP

**User Story**: As a CI maintainer, I want `baseline save` so that I can persist a baseline without remembering `--format json --output`.

**Why P1**: ROADMAP M40 primary save verb; enables explicit workflow with compare.

**Acceptance Criteria**:

1. WHEN `hotspot-scanner baseline save <repoPath>` runs THEN the CLI SHALL call `runScan()` with the same config/scan-option merge semantics as `scan` (CLI > config > defaults)
2. WHEN save completes THEN the CLI SHALL write a UTF-8 JSON file that `loadBaseline()` accepts as `ScanResult` `version: "1.0"` (full ranked arrays — JSON semantics; `--top` does not truncate the file)
3. WHEN `--output` is omitted THEN the CLI SHALL write to `./hotspot-baseline.json` (cwd-relative)
4. WHEN `--output <path>` is provided THEN the CLI SHALL write to that path (after `validateOutputPath`)
5. WHEN `--format` or `--baseline` is not registered on `baseline save` THEN Commander SHALL not accept those flags on this command
6. WHEN the output parent directory is missing or the path is a directory THEN the CLI SHALL exit `!= 0` with `CliUsageError`
7. WHEN save succeeds THEN exit code SHALL be `0`

**Independent Test**: Unit/CLI tests for default path, `--output` override, invalid output; fixture save then `loadBaseline` round-trip.

**Requirements**: HOTSPOT-490, HOTSPOT-491, HOTSPOT-492, HOTSPOT-493, HOTSPOT-494, HOTSPOT-495

---

### P1: `compare` subcommand (parity with `scan --baseline`) ⭐ MVP

**User Story**: As a developer, I want `hotspot-scanner compare <repoPath> --baseline <file>` so that compare is an explicit workflow step.

**Why P1**: ROADMAP M40 compare verb; must not fork domain logic.

**Acceptance Criteria**:

1. WHEN `compare` is invoked with `--baseline <file>` THEN the CLI SHALL validate the baseline path, run `runScan()`, `loadBaseline()`, `compareScanResults()`, and `createReporter().renderCompare()` — same sequence as `scan --baseline`
2. WHEN `--baseline` is omitted on `compare` THEN the CLI SHALL exit `!= 0` (required option / usage error)
3. WHEN `compare` is combined with `--format`, `--output`, and `--top` THEN behavior SHALL match `scan --baseline` for those flags (including CSV requiring `--output`)
4. WHEN compare succeeds THEN exit code SHALL be `0` regardless of delta content
5. WHEN granularity/`since` mismatches occur THEN behavior SHALL match M13 (`CompareError` hard fail vs stderr warnings)

**Independent Test**: CLI tests asserting compare and `scan --baseline` produce equivalent JSON for the same repo + baseline fixture.

**Requirements**: HOTSPOT-496, HOTSPOT-497, HOTSPOT-498

---

### P1: Retain `scan --baseline` ⭐ MVP

**User Story**: As an existing script author, I want `scan --baseline` unchanged so that my pipelines keep working.

**Why P1**: Locked — no removal; regression guard.

**Acceptance Criteria**:

1. WHEN `scan --baseline <file>` runs THEN behavior SHALL remain equivalent to pre-M40 (same flags, exit codes, output shapes)
2. WHEN `scan` runs without `--baseline` THEN behavior SHALL remain a normal scan report (no compare)

**Independent Test**: Existing `bin/hotspot-scanner.test.ts` / integration baseline cases still pass; explicit regression case if helpers are extracted.

**Requirements**: HOTSPOT-499

---

### P1: Bin wiring only (reuse domain APIs) ⭐ MVP

**User Story**: As a maintainer, I want new commands to reuse `src/` APIs so that compare/scan logic is not duplicated in bin.

**Why P1**: Locked boundary; prevents drift between `compare` and `scan --baseline`.

**Acceptance Criteria**:

1. WHEN `baseline save` runs THEN it SHALL obtain results only via `runScan()` (no ad-hoc miner/scorer calls in bin)
2. WHEN `compare` runs THEN it SHALL use `loadBaseline`, `compareScanResults`, and report `renderCompare` from `#compare` / `#report` (no reimplementation)
3. WHEN shared helpers are extracted in `bin/` THEN they SHALL contain CLI I/O and wiring only — no new compare classification or ScanResult shaping beyond `JSON.stringify` of `runScan()` output / existing reporters

**Independent Test**: Code review + tests that mock `#scan` / `#compare` / `#report` at bin boundary (existing CLI test pattern).

**Requirements**: HOTSPOT-500

---

### P1: Help and command registration ⭐ MVP

**User Story**: As a CLI user, I want `baseline save` and `compare` discoverable in help so that I can learn the workflow without reading source.

**Why P1**: Adoption DX for M40 verbs.

**Acceptance Criteria**:

1. WHEN `hotspot-scanner --help` (or program help) lists commands THEN it SHALL include `baseline` and `compare` (and/or nested `baseline save` per Commander nesting)
2. WHEN `hotspot-scanner baseline save --help` runs THEN it SHALL document `<repoPath>`, `--output`, and scan options supported on save
3. WHEN `hotspot-scanner compare --help` runs THEN it SHALL document required `--baseline` and format/output/top/scan options

**Independent Test**: Assert command names exist on `createCliProgram()`; help strings contain key flags.

**Requirements**: HOTSPOT-501

---

### P1: Tests ⭐ MVP

**User Story**: As a CI maintainer, I want unit and integration coverage for the new commands so that regressions are caught.

**Why P1**: TESTING.md covers `bin/**`; new branches need co-located tests.

**Acceptance Criteria**:

1. WHEN `bin/hotspot-scanner.test.ts` runs THEN it SHALL cover `baseline save` default path, `--output`, invalid output, and `compare` missing/valid `--baseline`
2. WHEN an integration test runs THEN it SHALL save a baseline from `tests/fixtures/repos/small-ts` (or isolated copy) and compare against it with exit `0` and parseable CompareResult JSON
3. WHEN `scan --baseline` regression tests run THEN they SHALL still pass after helper extraction
4. WHEN new/changed `bin/**` files are covered THEN per-file coverage thresholds in TESTING.md SHALL hold

**Independent Test**: Vitest gates in tasks.md.

**Requirements**: HOTSPOT-502, HOTSPOT-503

---

### P1: Documentation sync ⭐ MVP

**User Story**: As a reader of project docs, I want the new subcommands documented so that the save→compare workflow is discoverable.

**Why P1**: Living docs rule for significant CLI changes.

**Acceptance Criteria**:

1. WHEN Execute completes THEN [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md) SHALL mention `baseline save` and `compare` alongside `scan --baseline`
2. WHEN docs sync THEN [STRUCTURE.md](../../codebase/STRUCTURE.md) / module map SHALL list the new commands (and any new `bin/` helper file)
3. WHEN [README.md](../../../README.md) CLI section is read THEN it SHALL document the save/compare workflow (or point to it) without removing `scan --baseline`
4. WHEN planning/Execute status updates THEN [ROADMAP.md](../../project/ROADMAP.md) M40 SHALL reflect Specs/Done appropriately

**Independent Test**: Doc review / grep for `baseline save` and `compare`.

**Requirements**: HOTSPOT-504

---

## Edge Cases

- WHEN `baseline save` targets an existing file THEN the CLI SHALL overwrite without prompting
- WHEN `baseline save` uses default path THEN the path SHALL be resolved relative to process cwd (not necessarily repo root)
- WHEN `compare` and `scan --baseline` use the same repo, baseline file, and flags THEN rendered CompareResult JSON SHALL be equivalent
- WHEN `baseline save` is given an empty `--output` string THEN the CLI SHALL reject with `CliUsageError`
- WHEN stderr progress/warnings occur during save or compare THEN they SHALL not be written into the baseline or report file (same channel split as M10/M13)
- WHEN no argv / unknown command THEN existing `CliUsageError` / Commander behavior remains; new commands do not change exit-code classes (`CliUsageError`/`ConfigError` → 2, other → 1)

---

## Requirement Traceability

| Requirement ID | Story                                 | Phase        | Status  |
| -------------- | ------------------------------------- | ------------ | ------- |
| HOTSPOT-490    | P1: baseline save runs `runScan`      | Tasks T2     | Pending |
| HOTSPOT-491    | P1: default `./hotspot-baseline.json` | Tasks T2     | Pending |
| HOTSPOT-492    | P1: `--output` override + validate    | Tasks T2     | Pending |
| HOTSPOT-493    | P1: JSON semantics (full ScanResult)  | Tasks T2     | Pending |
| HOTSPOT-494    | P1: scan options on save              | Tasks T2     | Pending |
| HOTSPOT-495    | P1: save errors / exit 0              | Tasks T2     | Pending |
| HOTSPOT-496    | P1: compare requires `--baseline`     | Tasks T3     | Pending |
| HOTSPOT-497    | P1: parity with `scan --baseline`     | Tasks T3     | Pending |
| HOTSPOT-498    | P1: compare format/output/top/csv     | Tasks T3     | Pending |
| HOTSPOT-499    | P1: retain `scan --baseline`          | Tasks T1, T4 | Pending |
| HOTSPOT-500    | P1: reuse domain APIs                 | Tasks T1–T3  | Pending |
| HOTSPOT-501    | P1: help / registration               | Tasks T2, T3 | Pending |
| HOTSPOT-502    | P1: CLI unit tests                    | Tasks T2–T4  | Pending |
| HOTSPOT-503    | P1: integration round-trip            | Tasks T4     | Pending |
| HOTSPOT-504    | P1: documentation sync                | Tasks T5     | Pending |

**Reserved:** HOTSPOT-505–509 (unused in M40; available for Execute follow-ups)

**Coverage:** 15 mapped, 0 unmapped P1; 5 reserved

---

## Success Criteria

- [ ] All P1 acceptance criteria verifiable via Vitest + fixture CLI runs
- [ ] `pnpm build && pnpm test` passes after Execute
- [ ] `bin/**` coverage thresholds maintained per TESTING.md
- [ ] `scan --baseline` and `compare` remain behaviorally aligned
- [ ] `orchestrator-implementer` can execute T1–T5 without ambiguous scope
