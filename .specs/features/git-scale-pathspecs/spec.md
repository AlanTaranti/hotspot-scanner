# Milestone 47 — Git Scale Pathspecs Specification

**Feature slug:** `git-scale-pathspecs`  
**Milestone:** ROADMAP M47  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [TESTING.md](../../codebase/TESTING.md), [CONCERNS.md](../../codebase/CONCERNS.md)  
**Context:** [`.specs/features/git-scale-pathspecs/context.md`](./context.md)  
**Sisters:** [function-mode-scan-efficiency](../function-mode-scan-efficiency/spec.md) (M35), [coupling-stream-aggregate](../coupling-stream-aggregate/spec.md) (M32), [cli-init-doctor-dry-run](../cli-init-doctor-dry-run/spec.md) (M39)

## Problem Statement

Large repos hit two scale cliffs: (1) function-mode path allowlists over `PATCH_PATHSPEC_FALLBACK_THRESHOLD` (1000) currently drop pathspecs entirely (M35 unrestricted fallback), reintroducing full-repo patch I/O; (2) mega-commit coupling skips are hard-coded at 100 unique in-scope files with no operator dial. Dry-run also gives no early signal that eligible scale will force pathspec batching. M47 fixes these without changing ranking formulas, numstat coupling semantics, or M46 test-exclude work.

## Goals

- [ ] Batch function-mode patch pathspecs when allowlist `> 1000`; avoid unrestricted fallback except the documented ARG_MAX emergency
- [ ] Make mega-commit unique-file threshold configurable (CLI + config; default 100) with M32 skip+warn policy unchanged
- [ ] Warn in `previewScanScope` / dry-run when eligible file count exceeds the pathspec threshold
- [ ] `pnpm build && pnpm test` passing after Execute

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| `--sequential` / benchmark harness | M49 |
| Historical AST / blame | CONCERNS deferred |
| Ranking formula / JSON `version` / public score fields | Unchanged |
| Numstat pathspecs | Context lock — coupling needs full stream |
| M46 exclude-tests-by-default | Separate milestone |
| Parallel patch batch spawns | Peak RSS; sequential only |
| Sampling / partial mega-commit coupling | Keep skip semantics |

---

## User Stories

### P1: Batch patch pathspecs over threshold ⭐ MVP

**User Story**: As a developer scanning with `--granularity function` on a large churned tree, I want pathspec-restricted patch mining to continue when the allowlist exceeds 1000 paths so that I do not silently pay full-repo patch I/O.

**Why P1**: ROADMAP primary scale win; closes M35 unrestricted fallback gap.

**Acceptance Criteria**:

1. WHEN the function-mode path allowlist length is `> PATCH_PATHSPEC_FALLBACK_THRESHOLD` THEN the miner SHALL partition paths into chunks of size `≤` that threshold and SHALL spawn pathspec-restricted `git log -p` for each chunk (after `--`)
2. WHEN partitioning THEN paths SHALL be stably sorted before chunking (deterministic argv)
3. WHEN multiple chunks exist THEN batches SHALL run **sequentially** (one stream at a time)
4. WHEN batch results are merged THEN per-function churn attribution SHALL match a single logical pathspec-restricted mine over the full allowlist (disjoint partitions → no double-count of the same file’s functions)
5. WHEN `paths` is empty THEN the miner SHALL still not spawn (M35)
6. WHEN `1 ≤ paths.length ≤ threshold` THEN behavior SHALL remain a single pathspec-restricted spawn (M35)
7. WHEN pathspecs are applied (single or batched) THEN argv SHALL still include `-M`, `-p`, `--unified=0`, and optional `--since`
8. WHEN a chunk spawn fails with an ARG_MAX / `E2BIG`-class error THEN the miner SHALL retry once with half chunk size (min 1) and only then MAY fall back to unrestricted streaming for the failing remainder, emitting a documented `ScanWarning`
9. WHEN `granularity === "file"` THEN the pipeline SHALL still not spawn any patch stream

**Independent Test**: Unit tests on partition helper + argv per chunk; miner tests with `paths.length = threshold + 1` assert ≥2 pathspec spawns and no count-based unrestricted argv; file-mode zero-spawn regression.

**Requirements**: HOTSPOT-660, HOTSPOT-661, HOTSPOT-662, HOTSPOT-663, HOTSPOT-664, HOTSPOT-665, HOTSPOT-666, HOTSPOT-667, HOTSPOT-668, HOTSPOT-669

---

### P1: Configurable mega-commit threshold ⭐ MVP

**User Story**: As an operator on monorepos with large mechanical commits, I want to raise or lower the unique in-scope file threshold for coupling skips so that mega-commit noise matches my repo’s commit style.

**Why P1**: ROADMAP second scale dial; default and skip policy stay familiar.

**Acceptance Criteria**:

1. WHEN no CLI/config override is set THEN the mega-commit unique-file threshold SHALL default to `100` (`MEGA_COMMIT_UNIQUE_FILE_THRESHOLD`)
2. WHEN unique in-scope canonical paths in a commit are `>` the effective threshold THEN coupling pair increments SHALL be skipped for that commit and `MEGA_COMMIT_SKIPPED` warnings SHALL be emitted (capped as today)
3. WHEN a commit is skipped for coupling THEN file churn aggregation SHALL still run (unchanged)
4. WHEN `ScanOptions.megaCommitThreshold` / config `megaCommitThreshold` / `--mega-commit-threshold` is set to a positive integer THEN that value SHALL be the effective threshold
5. WHEN resolving options THEN precedence SHALL be CLI > config > default
6. WHEN config or CLI provides a non-positive / non-integer threshold THEN the system SHALL reject with the same validation class as `minCochange` / `--concurrency` (`ConfigError` / `CliUsageError`)
7. WHEN warning messages are formatted THEN they SHALL include the **effective** threshold (not a hard-coded `100`)
8. WHEN implementing M47 THEN the design SHALL NOT introduce sampling or partial pair counting for over-threshold commits

**Independent Test**: Unit — `aggregateOneCommit` with injected threshold; config parse/merge; CLI invalid/valid forward; warning string contains effective N.

**Requirements**: HOTSPOT-670, HOTSPOT-671, HOTSPOT-672, HOTSPOT-673, HOTSPOT-674, HOTSPOT-675, HOTSPOT-676, HOTSPOT-677, HOTSPOT-678, HOTSPOT-679

---

### P1: Dry-run pathspec scale warning ⭐ MVP

**User Story**: As an operator using `scan --dry-run`, I want an early warning when eligible file count exceeds the pathspec batch threshold so I can anticipate function-mode pathspec batching before a long mine.

**Why P1**: Completes the M47 triad; dry-run already previews scope without mining.

**Acceptance Criteria**:

1. WHEN `eligibleFileCount > PATCH_PATHSPEC_FALLBACK_THRESHOLD` THEN `previewScanScope` / `formatScanScopePreview` SHALL include a warning about pathspec scale / function-mode batching
2. WHEN `eligibleFileCount ≤ threshold` THEN no such pathspec-scale warning SHALL appear
3. WHEN the warning appears THEN dry-run SHALL still exit successfully and SHALL NOT invoke Git miner, complexity, scoring, or reporter ranking
4. WHEN warning THEN it SHALL be based on eligible discovery count (not churn allowlist — dry-run does not mine)

**Independent Test**: `src/scan-preview.test.ts` with mocked/temp trees or stubbed eligible counts above/below threshold.

**Requirements**: HOTSPOT-680, HOTSPOT-681, HOTSPOT-682, HOTSPOT-683

---

### P2: Living docs + gate

**User Story**: As a maintainer, I want ARCHITECTURE, CONCERNS, TESTING, README, and config exemplar to describe batching, mega-commit config, and dry-run warnings so M35 fallback docs do not mislead.

**Why P2**: Docs after behavior; full gate closes the milestone.

**Acceptance Criteria**:

1. WHEN reading ARCHITECTURE / CONCERNS THEN M35 “unrestricted over 1000” SHALL be replaced by batching + emergency ARG_MAX path; mega-commit threshold config SHALL be documented
2. WHEN reading README / exemplar config THEN `--mega-commit-threshold` and `megaCommitThreshold` SHALL appear with default 100
3. WHEN reading TESTING.md THEN M35 ARG_MAX fallback coverage notes SHALL be updated for batching regressions
4. WHEN Execute finishes THEN `pnpm build && pnpm test` SHALL pass

**Independent Test**: Docs checklist in Done when; full project gate.

**Requirements**: HOTSPOT-684, HOTSPOT-685, HOTSPOT-686

---

## Edge Cases

- WHEN allowlist length is exactly `1000` THEN a single pathspec spawn SHALL be used (no batching)
- WHEN allowlist length is `1001` THEN two batches (`1000` + `1`) SHALL be used
- WHEN a commit spans files in two batches THEN each batch attributes only its paths’ hunks (no cross-batch function double-count)
- WHEN mega threshold is `1` THEN any commit with `≥ 2` in-scope files skips coupling (still counts churn)
- WHEN mega threshold equals unique in-scope count (e.g. 100 files, threshold 100) THEN coupling SHALL still run (`>` not `≥` — preserve M32 inequality)
- WHEN dry-run eligible count is huge but granularity is `file` THEN the pathspec warning MAY still appear (scale signal; wording may reference function mode)
- WHEN emergency unrestricted fallback fires THEN rankings remain correct; operators see a warning (I/O cost accepted)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-660 | P1: Partition paths into ≤ threshold chunks | Tasks | Pending |
| HOTSPOT-661 | P1: Each chunk uses pathspec argv | Tasks | Pending |
| HOTSPOT-662 | P1: Sequential batch streams | Tasks | Pending |
| HOTSPOT-663 | P1: Merge equivalence / no double-count | Tasks | Pending |
| HOTSPOT-664 | P1: Stable sort before chunk | Tasks | Pending |
| HOTSPOT-665 | P1: Empty paths → no spawn | Tasks | Pending |
| HOTSPOT-666 | P1: Under/equal threshold single spawn | Tasks | Pending |
| HOTSPOT-667 | P1: ARG_MAX emergency unrestricted + warning | Tasks | Pending |
| HOTSPOT-668 | P1: File mode zero patch spawn | Tasks | Pending |
| HOTSPOT-669 | P1: function-churn progress across batches | Tasks | Pending |
| HOTSPOT-670 | P1: Default mega threshold 100 | Tasks | Pending |
| HOTSPOT-671 | P1: Injected threshold in aggregate | Tasks | Pending |
| HOTSPOT-672 | P1: Skip coupling over threshold | Tasks | Pending |
| HOTSPOT-673 | P1: Churn still counted | Tasks | Pending |
| HOTSPOT-674 | P1: Warnings use effective threshold | Tasks | Pending |
| HOTSPOT-675 | P1: `ScanOptions.megaCommitThreshold` | Tasks | Pending |
| HOTSPOT-676 | P1: Config `megaCommitThreshold` | Tasks | Pending |
| HOTSPOT-677 | P1: CLI `--mega-commit-threshold` | Tasks | Pending |
| HOTSPOT-678 | P1: Precedence CLI > config > default | Tasks | Pending |
| HOTSPOT-679 | P1: Invalid threshold rejected | Tasks | Pending |
| HOTSPOT-680 | P1: Dry-run warns when eligible > threshold | Tasks | Pending |
| HOTSPOT-681 | P1: Warning does not fail dry-run | Tasks | Pending |
| HOTSPOT-682 | P1: Preview text includes warning line | Tasks | Pending |
| HOTSPOT-683 | P1: Dry-run still no mine/AST | Tasks | Pending |
| HOTSPOT-684 | P2: ARCHITECTURE / CONCERNS update | Tasks | Pending |
| HOTSPOT-685 | P2: README + exemplar config | Tasks | Pending |
| HOTSPOT-686 | P2: TESTING.md + full gate | Tasks | Pending |
| HOTSPOT-687 | — | — | Reserved |
| HOTSPOT-688 | — | — | Reserved |
| HOTSPOT-689 | — | — | Reserved |

**Coverage:** 27 requirements mapped to tasks (660–686); 3 reserved (687–689).

---

## Success Criteria

- [ ] Function mode with allowlist `> 1000` uses batched pathspecs (not count-based unrestricted omit)
- [ ] Mega-commit threshold configurable; default 100; skip+warn policy unchanged
- [ ] Dry-run warns when eligible files `> 1000`
- [ ] File mode still never spawns patch stream
- [ ] `pnpm build && pnpm test` green
