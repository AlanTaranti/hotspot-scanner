# Milestone 49 — Pipeline Perf Controls Specification

**Feature slug:** `pipeline-perf-controls`  
**Milestone:** ROADMAP M49  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md) § Pipeline stage overlap (M34), [CONCERNS.md](../../codebase/CONCERNS.md) § Performance  
**Context:** [`.specs/features/pipeline-perf-controls/context.md`](./context.md)  
**Sisters:** [pipeline-stage-overlap](../pipeline-stage-overlap/) (M34), [ast-parallelization](../ast-parallelization/) (M15), [scan-observability](../scan-observability/) (M51 — bench excluded), `scripts/benchmark-scan.md`

## Problem Statement

File-mode scans default to M34 git∥complexity overlap for wall-clock wins, but operators cannot opt out when they need lower peak RSS, deterministic stage order for debugging, or clean A/B timing. Manual `time` notes in `scripts/benchmark-scan.md` are not a repeatable harness. M49 adds a sequential opt-out flag pair and an automated `pnpm bench` harness that stays outside the project test gate.

## Goals

- [ ] `--sequential` (primary) / `--no-overlap` (alias) disable file-mode M34 overlap
- [ ] Default scan behavior unchanged when flags omitted
- [ ] Automated `pnpm bench` reports wall-clock + counts; optional overlap vs sequential A/B
- [ ] Bench **not** wired into `pnpm test` / CI timing thresholds
- [ ] Rankings and JSON contract unchanged; `pnpm build && pnpm test` green

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Pathspec batching / mega-commit threshold (M47) | Separate milestone |
| SIGINT / process-level AbortSignal (M51) | Separate milestone; M51 also excludes bench harness |
| `.hotspot-scanner.json` `sequential` key | Locked CLI-only ([context.md](./context.md)) |
| CI wall-clock / fail-on-slow gates | Existing performance policy |
| Changing `--concurrency` / worker pool defaults | M28/M36; orthogonal to stage overlap |
| Function-churn ∥ numstat | M34 boundary unchanged |
| Ranking / JSON schema / warning code changes | Locked unchanged |

---

## User Stories

### P1: Sequential opt-out for file-mode overlap ⭐ MVP

**User Story**: As an operator, I want `--sequential` (or `--no-overlap`) so that git mining and complexity analysis run one after the other instead of overlapping, lowering peak memory and making stage order predictable.

**Why P1**: Primary ROADMAP M49 deliverable; unlocks debug and memory-constrained hosts.

**Acceptance Criteria**:

1. WHEN `scan` (or other wired command) is invoked with `--sequential` THEN `runScan` SHALL set sequential stage order for file mode (`await` git mine, then `await` complexity analyze) so the two stages are not concurrently in-flight
2. WHEN `scan` is invoked with `--no-overlap` THEN behavior SHALL be identical to `--sequential`
3. WHEN both `--sequential` and `--no-overlap` are present THEN the system SHALL treat them as the same opt-out (no `CliUsageError`)
4. WHEN neither flag is present THEN file-mode M34 overlap SHALL remain the default
5. WHEN `--sequential` / `--no-overlap` is used THEN rankings and JSON `version: "1.0"` semantics SHALL match an overlapped scan under the same fixed options (aside from non-semantic timing)

**Independent Test**: Unit mocks prove non-overlap when sequential; CLI forwards flag; fixture rankings match.

**Requirements**: HOTSPOT-710, HOTSPOT-711, HOTSPOT-712, HOTSPOT-716

---

### P1: ScanOptions + CLI surface ⭐ MVP

**User Story**: As a maintainer, I want a typed `ScanOptions.sequential` flag wired from CLI (not config) so programmatic and CLI callers share one control.

**Why P1**: Clean API boundary; matches CLI-only lock.

**Acceptance Criteria**:

1. WHEN `ScanOptions.sequential === true` THEN `runScan` SHALL use sequential file-mode orchestration
2. WHEN `ScanOptions.sequential` is omitted or falsy THEN file-mode overlap SHALL remain default
3. WHEN resolving config THEN `.hotspot-scanner.json` SHALL NOT accept a `sequential` key as a supported merge field (CLI / `ScanOptions` only)
4. WHEN `--sequential` or `--no-overlap` appears on help for wired commands THEN help text SHALL document primary + alias relationship and that they disable M34 file-mode overlap
5. WHEN function granularity is used with `--sequential` THEN the CLI SHALL accept the flag without error (function mode already sequences git→complexity for allowlist)

**Independent Test**: CLI unit tests for forward + help; config loader unchanged / rejects or ignores if someone puts the key (YAGNI: ignore unknown keys remains existing behavior — do not add a new schema key).

**Requirements**: HOTSPOT-713, HOTSPOT-714, HOTSPOT-717

---

### P1: Failure semantics under sequential ⭐ MVP

**User Story**: As an operator, when a stage fails under sequential mode, I want the same fail-closed behavior as today (original error, non-zero exit, no partial rankings).

**Why P1**: Must not regress M34 cancel/error contract for the default path; sequential must fail cleanly.

**Acceptance Criteria**:

1. WHEN git mine fails under `sequential: true` THEN `runScan` SHALL reject with the original error and SHALL NOT run scoring / coupling
2. WHEN complexity fails under `sequential: true` THEN `runScan` SHALL reject with the original error and SHALL NOT run scoring / coupling
3. WHEN default overlap path is used THEN existing sibling-abort + `Promise.allSettled` semantics SHALL remain unchanged

**Independent Test**: Extend `src/scan.test.ts` failure cases for sequential path; overlap cancel tests remain green.

**Requirements**: HOTSPOT-715

---

### P1: Automated benchmark harness ⭐ MVP

**User Story**: As a maintainer, I want `pnpm bench` to measure scan wall-clock and scale counts (and optionally compare overlap vs sequential) without affecting CI gates.

**Why P1**: Second ROADMAP bullet; replaces purely manual `time` notes with a repeatable script.

**Acceptance Criteria**:

1. WHEN an operator runs `pnpm bench` (with documented args / env) THEN the harness SHALL execute at least one scan and print **wall-clock** duration
2. WHEN the harness completes THEN it SHALL print **counts** useful for scale (at least one of: commits processed, eligible source files, or equivalent documented metric)
3. WHEN comparing modes THEN the harness SHALL be able to run (or document a flag to run) both default overlap and `--sequential` on the same repo path
4. WHEN `pnpm test` runs THEN it SHALL NOT invoke the bench harness and SHALL NOT assert duration thresholds
5. WHEN documenting the harness THEN `scripts/benchmark-scan.md` SHALL describe `pnpm bench` usage and restate “not part of CI / `pnpm test`”

**Independent Test**: Doc + script smoke (manual or non-gated); package.json script present; `pnpm test` package script unchanged regarding bench.

**Requirements**: HOTSPOT-721, HOTSPOT-722, HOTSPOT-723, HOTSPOT-724, HOTSPOT-725, HOTSPOT-726

---

### P2: Living docs + structural / integration proofs

**User Story**: As a maintainer, I want ARCHITECTURE / CONCERNS / TESTING updated and automated structural proofs so sequential opt-out stays discoverable and regression-safe.

**Why P2**: Cross-cutting docs + test hardening after wiring.

**Acceptance Criteria**:

1. WHEN ARCHITECTURE documents M34 overlap THEN it SHALL also document `--sequential` / `--no-overlap` file-mode opt-out
2. WHEN CONCERNS / TESTING mention performance policy THEN they SHALL note sequential opt-out and that bench is outside the Vitest gate
3. WHEN unit tests run with delayed mine/analyze mocks and `sequential: true` THEN they SHALL assert stages are **not** concurrently in-flight
4. WHEN integration compares file-mode `small-ts` under overlap vs sequential THEN hotspot / coupling rankings SHALL match under fixed options
5. WHEN `pnpm build && pnpm test` runs THEN the suite SHALL pass with coverage thresholds intact

**Independent Test**: Doc checklist + `src/scan.test.ts` / `src/scan.integration.test.ts` + full gate.

**Requirements**: HOTSPOT-718, HOTSPOT-719, HOTSPOT-720, HOTSPOT-727, HOTSPOT-728, HOTSPOT-729

---

## Edge Cases

- WHEN `--sequential` is used with `--concurrency N` THEN concurrency SHALL still apply to the complexity pool only; sequential only affects git∥complexity stage overlap
- WHEN function mode + `--sequential` THEN churn still runs after complexity; never ∥ numstat
- WHEN repo validation fails THEN neither git nor complexity SHALL start (unchanged)
- WHEN empty `--since` window THEN existing empty-window warning behavior SHALL remain under sequential
- WHEN programmatic `ScanOptions.sequential: true` without CLI THEN orchestration SHALL honor the option
- WHEN unknown `sequential` appears in a config JSON file THEN existing unknown-key behavior SHALL apply (do not add first-class config support)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-710 | P1: Sequential file-mode opt-out | Tasks | In Tasks |
| HOTSPOT-711 | P1: `--no-overlap` alias | Tasks | In Tasks |
| HOTSPOT-712 | P1: Default overlap unchanged | Tasks | In Tasks |
| HOTSPOT-713 | P1: `ScanOptions.sequential` CLI-only | Tasks | In Tasks |
| HOTSPOT-714 | P1: Function mode accepts flag | Tasks | In Tasks |
| HOTSPOT-715 | P1: Fail-closed under sequential | Tasks | In Tasks |
| HOTSPOT-716 | P1: Rankings/JSON equivalence | Tasks | In Tasks |
| HOTSPOT-717 | P1: Help documents primary + alias | Tasks | In Tasks |
| HOTSPOT-718 | P2: Wired on scan/compare/baseline save | Tasks | In Tasks |
| HOTSPOT-719 | P2: Unit structural non-overlap proof | Tasks | In Tasks |
| HOTSPOT-720 | P2: Integration overlap vs sequential parity | Tasks | In Tasks |
| HOTSPOT-721 | P1: `pnpm bench` script | Tasks | In Tasks |
| HOTSPOT-722 | P1: Bench wall-clock | Tasks | In Tasks |
| HOTSPOT-723 | P1: Bench counts | Tasks | In Tasks |
| HOTSPOT-724 | P1: Bench A/B overlap vs sequential | Tasks | In Tasks |
| HOTSPOT-725 | P1: Bench not in `pnpm test` / CI timing | Tasks | In Tasks |
| HOTSPOT-726 | P1: Update `benchmark-scan.md` | Tasks | In Tasks |
| HOTSPOT-727 | P2: ARCHITECTURE sequential note | Tasks | In Tasks |
| HOTSPOT-728 | P2: CONCERNS / TESTING policy note | Tasks | In Tasks |
| HOTSPOT-729 | P2: Full project gate | Tasks | In Tasks |

**ID range:** HOTSPOT-710 … HOTSPOT-729 (exclusive use for M49)  
**Coverage:** 20 total, 20 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] `--sequential` / `--no-overlap` disable file-mode M34 overlap; default unchanged
- [ ] CLI-only `ScanOptions.sequential`; help documents alias relationship
- [ ] Function mode accepts flag without error; rankings/JSON unchanged
- [ ] `pnpm bench` reports wall-clock + counts; optional A/B; not part of `pnpm test`
- [ ] Docs synced; structural + integration proofs; `pnpm build && pnpm test` passes
