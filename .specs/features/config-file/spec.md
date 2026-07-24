# Milestone 21 — Config File Specification

**Feature slug:** `config-file`  
**Milestone:** ROADMAP M21  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md)  
**Context:** [`.specs/features/config-file/context.md`](./context.md) — **filename + precedence locked**  
**Depth:** Large

## Problem Statement

Teams repeat the same CLI flags (`--since`, includes/excludes, granularity, thresholds) across local runs and scripts. A single **`.hotspot-scanner.json`** in the repo should supply defaults while preserving explicit CLI overrides.

## Goals

- [x] Support **only** `.hotspot-scanner.json` at `repoPath` with keys: `since`, `include`, `exclude`, `granularity`, `minCochange`, `top`
- [x] Precedence: **CLI > config > defaults**
- [x] Document in README and ARCHITECTURE
- [x] Record decisions in `context.md` (done at planning) and STATE.md
- [x] `pnpm build && pnpm test` after Execute

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| `.hotspotrc` or dual filename lookup | **User locked — forbidden** |
| Parent-directory / home config walk | YAGNI — repoPath only |
| Config keys for `format`, `output`, `baseline` | CLI-only |
| YAML / TOML config | JSON only |
| Schema file for config (optional later) | YAGNI for M21 |

---

## User Stories

### P1: Load config from repoPath ⭐ MVP

**User Story**: As a developer, I want `<repo>/.hotspot-scanner.json` applied when I scan that repo so that shared defaults live with the code.

**Acceptance Criteria**:

1. WHEN `<repoPath>/.hotspot-scanner.json` exists and is valid THEN listed keys SHALL apply as defaults for the scan
2. WHEN the file is absent THEN scan SHALL behave as today (CLI + built-in defaults only)
3. WHEN the file is invalid JSON THEN the CLI SHALL exit non-zero with a clear error
4. WHEN a key has an invalid type/value THEN the CLI SHALL exit non-zero with a clear error naming the key

**Independent Test**: Temp dir with config file; run scan options resolution unit tests.

**Requirements**: HOTSPOT-166, HOTSPOT-167

---

### P1: Precedence CLI > config > defaults ⭐ MVP

**User Story**: As a CI author, I want CLI flags to override config so that one-off runs do not require editing the file.

**Acceptance Criteria**:

1. WHEN both config and CLI set the same option THEN the CLI value SHALL win
2. WHEN only config sets an option THEN that value SHALL be used instead of the built-in default
3. WHEN neither sets an option THEN built-in defaults SHALL apply (`DEFAULT_SINCE`, `DEFAULT_TOP`, `DEFAULT_MIN_COCHANGE`, granularity `file`, empty include/exclude beyond path-scoping defaults)

**Independent Test**: Matrix unit tests for merge function.

**Requirements**: HOTSPOT-168

---

### P1: Key mapping ⭐ MVP

**User Story**: As a repo maintainer, I want the six locked keys to map to existing scan options without new semantics.

**Acceptance Criteria**:

1. WHEN `include`/`exclude` are arrays of strings THEN they SHALL map to the same semantics as repeatable CLI flags
2. WHEN `granularity` is set THEN it SHALL accept only `file` \| `function`
3. WHEN `minCochange` / `top` are set THEN they SHALL be positive integers (same validation as CLI)
4. WHEN unknown keys appear THEN they SHALL be ignored (no failure)

**Independent Test**: Validation unit tests per key.

**Requirements**: HOTSPOT-169, HOTSPOT-170

---

### P1: CLI wiring ⭐ MVP

**User Story**: As a CLI user, I want config loading automatic on `scan <path>` so that I do not pass a `--config` flag (unless added later — not in M21).

**Acceptance Criteria**:

1. WHEN `hotspot-scanner scan <path>` runs THEN the tool SHALL attempt to load `<path>/.hotspot-scanner.json` before building `ScanOptions`
2. WHEN using programmatic `runScan()` THEN config loading SHALL either be applied inside `runScan` from `repoPath` **or** documented as CLI-only — **prefer load inside `runScan`** so API and CLI match
3. WHEN `--help` is shown THEN it SHOULD mention config file name briefly (optional but recommended)

**Independent Test**: CLI test with fixture config; `runScan` unit/integration.

**Requirements**: HOTSPOT-171

---

### P1: Documentation ⭐ MVP

**User Story**: As a reader, I want README + ARCHITECTURE to document filename, keys, and precedence.

**Acceptance Criteria**:

1. WHEN README is read THEN `.hotspot-scanner.json` example and precedence SHALL appear
2. WHEN ARCHITECTURE data-flow is read THEN config load step SHALL appear
3. WHEN ROADMAP M21 is completed in Execute THEN checklist items SHALL be `[x]`

**Independent Test**: Doc review.

**Requirements**: HOTSPOT-172, HOTSPOT-173

---

## Edge Cases

- WHEN `include` is a single string instead of array THEN reject or coerce — **reject** with clear error (strict)
- WHEN file is empty object `{}` THEN all defaults/CLI only
- WHEN `repoPath` is `.` THEN load `./.hotspot-scanner.json`
- WHEN config sets `top` but format is json THEN M16 behavior unchanged (`top` ignored for JSON) — config still supplies the value for table/markdown

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-166 | P1: Load config | Tasks T1 | Done |
| HOTSPOT-167 | P1: Invalid config errors | Tasks T1 | Done |
| HOTSPOT-168 | P1: Precedence | Tasks T1, T2 | Done |
| HOTSPOT-169 | P1: Key mapping | Tasks T1 | Done |
| HOTSPOT-170 | P1: Unknown keys ignored | Tasks T1 | Done |
| HOTSPOT-171 | P1: CLI / runScan wiring | Tasks T2 | Done |
| HOTSPOT-172 | P1: README/ARCHITECTURE | Tasks T3 | Done |
| HOTSPOT-173 | P1: Help + ROADMAP | Tasks T3 | Done |

**Coverage:** 8 total, 8 mapped to tasks, 0 unmapped

---

## Success Criteria

- [x] Only `.hotspot-scanner.json` supported
- [x] Precedence proven by tests
- [x] Docs match locked decisions
- [x] Full gate green
