# Milestone 28 — Performance & Diagnostics UX Specification

**Feature slug:** `perf-diagnostics-ux`  
**Milestone:** ROADMAP M28  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [CONCERNS.md](../../codebase/CONCERNS.md) (AST concurrency / RT-001), [TESTING.md](../../codebase/TESTING.md)  
**Context:** [`.specs/features/perf-diagnostics-ux/context.md`](./context.md)  
**Sisters:** [ast-parallelization](../ast-parallelization/) (M15 pool default), [per-function-churn](../per-function-churn/) (patch stream), [reporter-cli](../reporter-cli/) (diagnostics)

## Problem Statement

M15 parallelized complexity analysis behind an injectable pool default of `min(availableParallelism(), 4)`, but operators cannot tune concurrency from the CLI/config. Function mode runs a second patch stream (`FunctionChurnMiner`) that already emits `onProgress`, yet stderr messages look identical to the numstat pass and counters restart without a phase label — large-repo scans feel stuck or confusing. Warnings are unstructured strings: scan warnings exist only on stderr (not in `ScanResult.meta`), compare uses `meta.warnings: string[]`, and there is no severity model or interpretation guide for operators.

M28 adds operator concurrency control, phase-aware progress for function-mode mining, and consolidated warning severity / `meta.warnings` contracts — without reopening M26 rename-confidence content.

## Goals

- [ ] CLI `--concurrency` (and config key) wired to the complexity worker pool; default documented and unchanged
- [ ] Phase-aware progress for `git` and `function-churn` streams (patch-stream clearly labeled)
- [ ] Structured `ScanWarning` with severity; `ScanResult.meta.warnings` + compare meta migration; stderr prefixes; interpretation docs
- [ ] `pnpm build && pnpm test` passing after Execute

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| RT-003 / rename-confidence / pós-rename overlap avisos | M26 boundary — do not duplicate |
| `--batch-size` / changing `DEFAULT_BATCH_SIZE` | M15 YAGNI; not in M28 ROADMAP |
| Changing default concurrency formula | Document only; keep `min(availableParallelism(), 4)` |
| Complexity / batch progress phases | YAGNI — ROADMAP targets function-mode patch-stream |
| Parallel git mining or overlapping pipeline stages | ADR / integration context — stages stay sequential |
| CI wall-clock performance gates | Manual benchmark only (existing policy) |
| Historical AST / McCabe decision-node changes | Unrelated; CONCERNS RT-005 |
| Coupling enrichment / path-config DX | M27 / M30 |

---

## User Stories

### P1: CLI `--concurrency` for complexity workers ⭐ MVP

**User Story**: As an operator scanning a large repo, I want to set `--concurrency` so that I can raise or lower the complexity worker pool for my machine/CI memory profile.

**Why P1**: Primary ROADMAP M28 deliverable; M15 left concurrency internal.

**Acceptance Criteria**:

1. WHEN `--concurrency <n>` is passed THEN `n` SHALL be a positive integer ≥ 1 and SHALL be applied as the complexity worker-pool concurrency
2. WHEN `--concurrency` is omitted THEN concurrency SHALL default to `min(os.availableParallelism(), 4)` (`DEFAULT_WORKER_CONCURRENCY`)
3. WHEN `concurrency` is set in `.hotspot-scanner.json` THEN it SHALL apply unless overridden by CLI (CLI > config > default)
4. WHEN `n` is not a positive integer THEN the CLI/config SHALL fail with a clear usage/config error (non-zero exit) before scan work
5. WHEN `concurrency === 1` THEN existing inline/no-spawn pool behavior SHALL remain (M15 D6)
6. WHEN help/README/ARCHITECTURE document concurrency THEN they SHALL state the default formula and that the flag only affects the complexity stage (not git mining)

**Independent Test**: Unit — parse/merge concurrency; CLI integration — `--concurrency 1` on fixture exits 0; invalid `--concurrency 0` exits ≠ 0.

**Requirements**: HOTSPOT-251, HOTSPOT-252, HOTSPOT-253, HOTSPOT-254

---

### P1: Phase-aware progress (function-mode patch stream) ⭐ MVP

**User Story**: As an operator running `--granularity function`, I want progress lines that identify the patch-stream phase so that I know whether the tool is still in numstat mining or function-churn.

**Why P1**: ROADMAP “progress reporting in function mode (patch-stream phase)”; current UX conflates two streams.

**Acceptance Criteria**:

1. WHEN `GitMiner` invokes `onProgress` THEN the payload SHALL include `phase: "git"` and `commitsProcessed`
2. WHEN `FunctionChurnMiner` invokes `onProgress` THEN the payload SHALL include `phase: "function-churn"` and `commitsProcessed`
3. WHEN the CLI logs progress THEN stderr SHALL include the phase label (e.g. `Processing function-churn commit 1,000...`)
4. WHEN throttling applies THEN it SHALL remain every `PROGRESS_LOG_INTERVAL` (1000) commits **per phase**, without requiring a total count
5. WHEN `granularity === "file"` THEN only `phase: "git"` progress SHALL appear (no function-churn miner / no patch progress)
6. WHEN `onProgress` is omitted THEN miners SHALL complete without error (callback optional)

**Independent Test**: Unit — miners emit phase; diagnostics — `maybeLogProgress` / phase-aware logger; integration — function-mode scan invokes progress with both phases (mocked or fixture).

**Requirements**: HOTSPOT-255, HOTSPOT-256, HOTSPOT-257

---

### P1: Structured warnings + severity + `meta.warnings` ⭐ MVP

**User Story**: As an operator or JSON consumer, I want warnings with severity in `meta.warnings` (and consistent stderr) so that I can interpret scan health without scraping free-form strings alone.

**Why P1**: ROADMAP “consolidate warning UX / meta.warnings severity and interpretation docs”.

**Acceptance Criteria**:

1. WHEN the domain defines warnings THEN it SHALL use `ScanWarning` with `severity: "info" | "warning" | "error"`, `message: string`, and optional `code?: string`
2. WHEN a scan completes THEN `ScanResult.meta.warnings` SHALL be a `ScanWarning[]` (possibly empty) aggregating pipeline warnings (git, complexity, function-churn)
3. WHEN compare emits since-mismatch (or other compare warnings) THEN `CompareResult.meta.warnings` SHALL be `ScanWarning[]` (not bare `string[]`)
4. WHEN `onWarning` is provided THEN it SHALL receive `ScanWarning` (not a bare string)
5. WHEN CLI writes diagnostics THEN stderr prefix SHALL match severity (`info:` / `warning:` / `error:`)
6. WHEN existing warn-and-continue sites emit THEN they SHALL map to codes `EMPTY_SINCE_WINDOW`, `RENAME_HISTORY_INCOMPLETE`, `PARSE_FAILED`, `COMPARE_SINCE_MISMATCH` as applicable — **without** adding new M26 rename-confidence messages
7. WHEN JSON schemas/contract tests are updated THEN `version` SHALL remain `"1.0"`; scan/compare schemas SHALL describe `ScanWarning`
8. WHEN reporters render compare/scan JSON or human formats that surface warnings THEN they SHALL render structured warnings without dropping severity/message

**Independent Test**: Unit — warning helper + logger prefixes; scan unit — `meta.warnings` populated; compare unit — structured since-mismatch; contract schema tests green.

**Requirements**: HOTSPOT-258, HOTSPOT-259, HOTSPOT-260, HOTSPOT-261, HOTSPOT-263

---

### P1: Warning interpretation docs ⭐ MVP

**User Story**: As an operator, I want a short interpretation guide for warning codes/severities so that I know whether to act, ignore, or re-run with different flags.

**Why P1**: Explicit ROADMAP deliverable; closes the UX loop.

**Acceptance Criteria**:

1. WHEN docs are updated THEN README (or linked `.specs`/CONTRIBUTING section) SHALL document severity meaning and that severity does not change exit codes by itself
2. WHEN codes are listed THEN each M28 code (`EMPTY_SINCE_WINDOW`, `RENAME_HISTORY_INCOMPLETE`, `PARSE_FAILED`, `COMPARE_SINCE_MISMATCH`) SHALL have a one-line interpretation and suggested operator action
3. WHEN M26 is mentioned THEN docs SHALL state that rename-confidence / RT-003 avisos are owned by M26 (not invented here)
4. WHEN ARCHITECTURE/CONCERNS are updated THEN they SHALL note CLI `--concurrency` override and structured `meta.warnings`

**Independent Test**: Doc review checklist in task Done when; no code gate beyond full project gate.

**Requirements**: HOTSPOT-262, HOTSPOT-264

---

### P2: Integration verification + project gate

**User Story**: As a maintainer, I want fixture/CLI coverage proving concurrency, phased progress, and structured warnings together so that M28 does not regress the scan pipeline.

**Why P2**: Cross-cutting wiring proof after unit slices.

**Acceptance Criteria**:

1. WHEN `pnpm build && pnpm test` runs THEN the suite SHALL pass with coverage thresholds intact
2. WHEN CLI runs a function-mode fixture with `--concurrency 1` THEN exit code SHALL be 0 and JSON `meta.warnings` SHALL be an array of objects (when format json)
3. WHEN invalid `--concurrency` is passed THEN exit code SHALL be ≠ 0

**Independent Test**: CLI/integration tests + full gate.

**Requirements**: HOTSPOT-265

---

## Edge Cases

- WHEN `--concurrency 1` on a multi-batch repo THEN scan SHALL succeed using inline pool path
- WHEN config has `concurrency` and CLI omits the flag THEN config value SHALL apply
- WHEN function mode has fewer than 1000 commits in patch stream THEN progress MAY emit nothing (throttle) — acceptable; phase label still required when a line is emitted
- WHEN both phases emit commit 1000 THEN two distinct stderr lines (one per phase) SHALL be allowed
- WHEN `meta.warnings` is empty THEN JSON SHALL include `"warnings": []` (not omit the key)
- WHEN a warning has no `code` THEN reporters/schemas SHALL still accept `{ severity, message }`
- WHEN compare baseline is used THEN compare warnings SHALL use `ScanWarning` shape in meta and stderr

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-251 | P1: CLI `--concurrency` | Tasks | Pending |
| HOTSPOT-252 | P1: Config `concurrency` + merge | Tasks | Pending |
| HOTSPOT-253 | P1: Wire concurrency into analyzer via scan | Tasks | Pending |
| HOTSPOT-254 | P1: Document default concurrency | Tasks | Pending |
| HOTSPOT-255 | P1: Progress `phase` on miners | Tasks | Pending |
| HOTSPOT-256 | P1: Phase-labeled stderr progress | Tasks | Pending |
| HOTSPOT-257 | P1: Per-phase throttle | Tasks | Pending |
| HOTSPOT-258 | P1: `ScanWarning` type + severity | Tasks | Pending |
| HOTSPOT-259 | P1: `ScanResult.meta.warnings` | Tasks | Pending |
| HOTSPOT-260 | P1: Severity-aware stderr | Tasks | Pending |
| HOTSPOT-261 | P1: Compare `meta.warnings` as `ScanWarning[]` | Tasks | Pending |
| HOTSPOT-262 | P1: Interpretation docs | Tasks | Pending |
| HOTSPOT-263 | P1: Map existing sites to codes | Tasks | Pending |
| HOTSPOT-264 | P1: Living docs (ARCHITECTURE/CONCERNS/…) | Tasks | Pending |
| HOTSPOT-265 | P2: Integration + full gate | Tasks | Pending |

**ID format:** `HOTSPOT-NNN`  
**Coverage:** 15 total — all mapped in Tasks phase

---

## Success Criteria

- [ ] Operators can set `--concurrency` / config and see documented default
- [ ] Function-mode stderr progress distinguishes `git` vs `function-churn`
- [ ] Scan and compare JSON expose structured `meta.warnings` with severity
- [ ] Interpretation docs cover M28 codes; M26 boundary respected
- [ ] `pnpm build && pnpm test` green
