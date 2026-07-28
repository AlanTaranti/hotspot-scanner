# Milestone 64 — Config and Doctor DX Specification

**Feature slug:** `config-doctor-dx`  
**Milestone:** M64  
**Depth:** Large  
**IDs:** HOTSPOT-1100–1139 (1136–1139 reserved)  
**Context:** [`.specs/features/config-doctor-dx/context.md`](./context.md) — all gray areas locked  
**Sisters:** [config-file](../config-file/spec.md) (M21), [path-config-dx](../path-config-dx/spec.md) (M30), [cli-init-doctor-dry-run](../cli-init-doctor-dry-run/spec.md) (M39), [doctor-scope-parity](../doctor-scope-parity/spec.md) (M52), [api-trust-docs](../api-trust-docs/spec.md) (M55 unknown keys)

---

## Problem Statement

Adopters get a minimal empty-array init exemplar, no machine-readable config schema or package schema exports, and no first-class way to validate or print effective merged options with provenance. Dry-run hides config path, remount, and unknown keys that `runScan` already knows. Doctor never preflights effective `--since`, so bad or empty windows surface only during a full scan. This milestone closes those DX gaps without expanding PathScope or the scan JSON contract.

## Goals

- [ ] `init` writes a schema-linked, commented exemplar with realistic include/exclude examples
- [ ] `$schema` / `$comment` / `$comments` are reserved meta — not ScanOptions, not `UNKNOWN_CONFIG_KEY` spam
- [ ] `schemas/hotspot-scanner-config.json` ships with package `"exports"` for scan, compare, and config schemas
- [ ] `hotspot-scanner config validate` / `config print` work with clear exit codes and source tags
- [ ] `scan --dry-run` shows config path (or none), remount info, and unknown keys
- [ ] Doctor soft-warns dubious `since`, hard-fails only when git rejects the since string

## Out of Scope

| Feature                                          | Reason                                      |
| ------------------------------------------------ | ------------------------------------------- |
| Interactive init wizard / prompts                | YAGNI                                       |
| Doctor auto-fix / mutating repo                  | Diagnose only (M39)                         |
| New known scan config keys                       | YAGNI                                       |
| Doctor CLI `--since` / `--include` / `--exclude` | M52; use config or dry-run / `config print` |
| PathScope / default exclude changes              | Sisters                                     |
| ScanResult / CompareResult version bump          | Unrelated                                   |
| npm publish                                      | Deferred horizon                            |

---

## User Stories

### P1: Reserved meta keys ⭐ MVP

**User Story**: As a maintainer using `$schema` and comment keys in `.hotspot-scanner.json`, I want them ignored for merge and unknown-key warnings so IDE schema hints do not spam `UNKNOWN_CONFIG_KEY`.

**Why P1**: Unblocks richer init and schema without regressing M55 warn-only semantics.

**Acceptance Criteria**:

1. WHEN a config contains `$schema`, `$comment`, and/or `$comments` THEN `parseHotspotScannerConfig` SHALL NOT include them in `HotspotScannerConfig`
2. WHEN those keys are present with otherwise valid known keys THEN `unknownKeys` SHALL NOT list `$schema`, `$comment`, or `$comments`
3. WHEN `runScan` loads such a config THEN it SHALL NOT emit `UNKNOWN_CONFIG_KEY` solely for those meta keys
4. WHEN a non-meta unknown key coexists with meta keys THEN the system SHALL still warn for the non-meta unknown key(s) only

**Requirements:** HOTSPOT-1100, HOTSPOT-1101

**Independent Test**: Unit parse with mixed meta + typo key → only typo in `unknownKeys`; scan warning list matches.

---

### P1: Richer init exemplar ⭐ MVP

**User Story**: As a first-time adopter running `hotspot-scanner init`, I want a realistic, schema-linked config so I can edit include/exclude with IDE validation and human hints.

**Why P1**: Adoption entry point; supersedes sparse empty-array exemplar.

**Acceptance Criteria**:

1. WHEN `init` succeeds THEN the written file SHALL include `"$schema": "https://vitals.dev/hotspot-scanner/schemas/hotspot-scanner-config.json"`
2. WHEN `init` succeeds THEN the file SHALL include a `$comments` string array with human hints (per context.md)
3. WHEN `init` succeeds THEN `include` and `exclude` SHALL be non-empty realistic example arrays (not both empty-only)
4. WHEN `init` succeeds THEN `since` and `top` SHALL match locked defaults; `concurrency` SHALL be omitted
5. WHEN the written exemplar is parsed THEN it SHALL load without `ConfigError` and without meta keys in `unknownKeys`
6. WHEN overwrite rules run THEN refuse-without-`--force` / `--force` overwrite behavior SHALL remain (exit `2` on refuse)

**Requirements:** HOTSPOT-1102, HOTSPOT-1103, HOTSPOT-1104, HOTSPOT-1105, HOTSPOT-1106

**Independent Test**: `writeInitConfig` snapshot equals locked exemplar; parse round-trip green.

---

### P1: Config schema + package exports ⭐ MVP

**User Story**: As a consumer or IDE, I want a published config JSON Schema and package export paths for all schemas so I can validate configs and resolve `$schema` / imports.

**Why P1**: Makes `$schema` meaningful and exposes scan/compare schemas the same way.

**Acceptance Criteria**:

1. WHEN `schemas/hotspot-scanner-config.json` is read THEN it SHALL declare `$id` `https://vitals.dev/hotspot-scanner/schemas/hotspot-scanner-config.json`
2. WHEN the schema is applied THEN known keys (`since`, `include`, `exclude`, `top`, `concurrency`) SHALL have types/constraints aligned with runtime parse rules
3. WHEN the schema documents reserved meta THEN `$schema`, `$comment`, `$comments` SHALL be allowed without treating them as scan options
4. WHEN `package.json` `"exports"` is read THEN it SHALL include `./schemas/scan-result.json`, `./schemas/compare-result.json`, and `./schemas/hotspot-scanner-config.json`
5. WHEN contract tests run THEN the config schema SHALL compile under Ajv and accept the locked exemplar (and reject clearly invalid known-key types)

**Requirements:** HOTSPOT-1107, HOTSPOT-1108, HOTSPOT-1109, HOTSPOT-1110

**Independent Test**: Contract test + `node -e "import('@vitals/hotspot-scanner/schemas/hotspot-scanner-config.json', { assert: { type: 'json' } })"` style resolution via exports (or package exports map assertion in test).

---

### P1: `config validate` ⭐ MVP

**User Story**: As an operator, I want `hotspot-scanner config validate [path]` so I can CI-check config files without running a full scan.

**Why P1**: Explicit validation surface; exit `0`/`2` locked.

**Acceptance Criteria**:

1. WHEN validate runs on a valid config file THEN the CLI SHALL exit `0`
2. WHEN validate runs on invalid JSON or invalid known-key types THEN the CLI SHALL exit `2` (`ConfigError` class)
3. WHEN validate runs with no discoverable config (and no explicit file) THEN the CLI SHALL exit `2` with a clear missing-file message
4. WHEN validate receives an explicit missing file path THEN the CLI SHALL exit `2`
5. WHEN domain validate logic runs THEN it SHALL live under `src/config/`; bin SHALL only wire Commander

**Requirements:** HOTSPOT-1111, HOTSPOT-1112, HOTSPOT-1113, HOTSPOT-1114, HOTSPOT-1115

**Independent Test**: CLI tests on temp valid/invalid/missing configs; assert exit codes.

---

### P1: `config print` with source tags ⭐ MVP

**User Story**: As an operator debugging precedence, I want `hotspot-scanner config print` to show effective options tagged `cli` / `config` / `default`, including optional JSON.

**Why P1**: Makes CLI > config > defaults observable.

**Acceptance Criteria**:

1. WHEN print runs THEN it SHALL show effective `since`, `include`, `exclude`, `top`, `concurrency` each with source `cli` \| `config` \| `default`
2. WHEN print runs THEN it SHALL show `config file: <path>` or `none`
3. WHEN CLI overrides a config key THEN that field’s source SHALL be `cli`
4. WHEN only config sets a key THEN source SHALL be `config`; when neither sets it THEN `default`
5. WHEN `--format json` is passed THEN stdout SHALL be JSON with values + per-field sources + `configPath`
6. WHEN `--format` is invalid THEN CLI SHALL exit `2` (`CliUsageError`)
7. WHEN print runs THEN it SHALL NOT invoke Git Change Miner, NCLOC analysis, or scoring

**Requirements:** HOTSPOT-1116, HOTSPOT-1117, HOTSPOT-1118, HOTSPOT-1119, HOTSPOT-1120, HOTSPOT-1121, HOTSPOT-1122

**Independent Test**: Unit provenance merge + CLI text/json snapshots on fixture with config + CLI overrides.

---

### P1: Dry-run prelude enrichment ⭐ MVP

**User Story**: As an adopter running `scan --dry-run`, I want to see which config file was used, any remount note, and unknown keys so dry-run matches scan prelude awareness.

**Why P1**: Closes dry-run vs `runScan` observability gap (M55 intent).

**Acceptance Criteria**:

1. WHEN dry-run succeeds with a discovered or explicit config THEN preview output SHALL include the config file path
2. WHEN no config file is found THEN preview SHALL indicate config is none / not found (without failing solely for that)
3. WHEN `remountWarning` is present THEN preview SHALL include that remount message
4. WHEN unknown config keys remain (after meta strip) THEN preview SHALL list them; WHEN none THEN omit spam
5. WHEN dry-run runs THEN it SHALL still skip mine / NCLOC / scoring
6. WHEN `ScanScopePreview` / `formatScanScopePreview` are updated THEN unit tests SHALL cover the new fields/lines

**Requirements:** HOTSPOT-1123, HOTSPOT-1124, HOTSPOT-1125, HOTSPOT-1126, HOTSPOT-1127, HOTSPOT-1128

**Independent Test**: `scan-preview` unit tests with mocked/temp config + remount fixture; assert lines.

---

### P1: Doctor since preflight ⭐ MVP

**User Story**: As an operator running `doctor`, I want effective `since` validated lightly via git so clearly invalid since strings fail early and empty windows only warn.

**Why P1**: Prevents false confidence before full scan.

**Acceptance Criteria**:

1. WHEN doctor prelude succeeds THEN it SHALL probe effective merged `since` with a lightweight `git log -1 --since=…` (or equivalent) via a `src/git/` helper
2. WHEN the probe finds at least one commit THEN finding `since` SHALL be `pass`
3. WHEN git accepts since but the window is empty THEN finding `since` SHALL be `warn` (soft) and SHALL NOT alone force non-zero exit
4. WHEN git rejects the since string THEN finding `since` SHALL be `fail` and aggregate exit SHALL be non-zero (`1`)
5. WHEN doctor runs THEN it SHALL NOT add a `--since` CLI flag (config / defaults / prelude merge only)

**Requirements:** HOTSPOT-1129, HOTSPOT-1130, HOTSPOT-1131, HOTSPOT-1132, HOTSPOT-1133

**Independent Test**: Doctor unit tests with injectable/mock probe: pass / empty-warn / reject-fail.

---

### P1: Doctor unknown-key surfacing ⭐ MVP

**User Story**: As an operator, I want doctor to warn about unknown config keys (excluding reserved meta) so typos are visible before scan.

**Why P1**: Closes M55 “doctor SHOULD surface” gap.

**Acceptance Criteria**:

1. WHEN loaded config has unknown keys after meta strip THEN doctor SHALL surface them as a soft warn (config finding or equivalent)
2. WHEN only reserved meta keys are “extra” THEN doctor SHALL NOT warn as unknown
3. WHEN unknown keys are present THEN doctor SHALL NOT hard-fail solely for that reason

**Requirements:** HOTSPOT-1134

**Independent Test**: Doctor unit with temp config containing `$schema` + typo key → warn lists typo only; exit `0` if otherwise healthy.

---

### P2: Living documentation

**User Story**: As a reader of ARCHITECTURE / STRUCTURE / README / INTEGRATIONS, I want M64 surfaces documented so docs match behavior.

**Why P2**: Living docs requirement; does not block MVP CLI behavior.

**Acceptance Criteria**:

1. WHEN reading ARCHITECTURE / STRUCTURE THEN config schema, `config validate` / `print`, dry-run enrichment, doctor `since` finding, and reserved meta SHALL be described
2. WHEN reading README Configuration / adoption path THEN init exemplar, schema export, and validate/print SHALL be mentioned
3. WHEN reading INTEGRATIONS THEN the since-probe git helper location SHALL be documented (git spawn ownership)

**Requirements:** HOTSPOT-1135

**Independent Test**: Doc review checklist in task Done when; full gate green.

---

## Edge Cases

- WHEN exemplar include/exclude examples are used as-is on a tiny fixture THEN dry-run/scan SHALL still succeed or show zero eligible files without crashing (examples are hints, not mandatory repo layout)
- WHEN `$comments` is present but not an array (wrong type) THEN treat as reserved meta skip for unknown-key purposes **or** document: reserved keys are name-based skip regardless of value shape (prefer name-based skip — do not validate meta value shapes)
- WHEN `config print` has CLI include/exclude repeatable flags THEN provenance for those fields SHALL be `cli`
- WHEN doctor since probe cannot run because git-repo already failed THEN do not invent a misleading `since` pass (skip or omit; same pattern as `scope`)
- WHEN dry-run has unknown keys AND remount THEN both SHALL appear (order: implementer discretion; stable enough for tests)

---

## Requirement Traceability

| Requirement ID    | Story                            | Phase | Status   |
| ----------------- | -------------------------------- | ----- | -------- |
| HOTSPOT-1100      | P1: Reserved meta keys           | Tasks | Pending  |
| HOTSPOT-1101      | P1: Reserved meta keys           | Tasks | Pending  |
| HOTSPOT-1102      | P1: Richer init exemplar         | Tasks | Pending  |
| HOTSPOT-1103      | P1: Richer init exemplar         | Tasks | Pending  |
| HOTSPOT-1104      | P1: Richer init exemplar         | Tasks | Pending  |
| HOTSPOT-1105      | P1: Richer init exemplar         | Tasks | Pending  |
| HOTSPOT-1106      | P1: Richer init exemplar         | Tasks | Pending  |
| HOTSPOT-1107      | P1: Config schema + exports      | Tasks | Pending  |
| HOTSPOT-1108      | P1: Config schema + exports      | Tasks | Pending  |
| HOTSPOT-1109      | P1: Config schema + exports      | Tasks | Pending  |
| HOTSPOT-1110      | P1: Config schema + exports      | Tasks | Pending  |
| HOTSPOT-1111      | P1: config validate              | Tasks | Pending  |
| HOTSPOT-1112      | P1: config validate              | Tasks | Pending  |
| HOTSPOT-1113      | P1: config validate              | Tasks | Pending  |
| HOTSPOT-1114      | P1: config validate              | Tasks | Pending  |
| HOTSPOT-1115      | P1: config validate              | Tasks | Pending  |
| HOTSPOT-1116      | P1: config print                 | Tasks | Pending  |
| HOTSPOT-1117      | P1: config print                 | Tasks | Pending  |
| HOTSPOT-1118      | P1: config print                 | Tasks | Pending  |
| HOTSPOT-1119      | P1: config print                 | Tasks | Pending  |
| HOTSPOT-1120      | P1: config print                 | Tasks | Pending  |
| HOTSPOT-1121      | P1: config print                 | Tasks | Pending  |
| HOTSPOT-1122      | P1: config print                 | Tasks | Pending  |
| HOTSPOT-1123      | P1: Dry-run enrichment           | Tasks | Pending  |
| HOTSPOT-1124      | P1: Dry-run enrichment           | Tasks | Pending  |
| HOTSPOT-1125      | P1: Dry-run enrichment           | Tasks | Pending  |
| HOTSPOT-1126      | P1: Dry-run enrichment           | Tasks | Pending  |
| HOTSPOT-1127      | P1: Dry-run enrichment           | Tasks | Pending  |
| HOTSPOT-1128      | P1: Dry-run enrichment           | Tasks | Pending  |
| HOTSPOT-1129      | P1: Doctor since preflight       | Tasks | Pending  |
| HOTSPOT-1130      | P1: Doctor since preflight       | Tasks | Pending  |
| HOTSPOT-1131      | P1: Doctor since preflight       | Tasks | Pending  |
| HOTSPOT-1132      | P1: Doctor since preflight       | Tasks | Pending  |
| HOTSPOT-1133      | P1: Doctor since preflight       | Tasks | Pending  |
| HOTSPOT-1134      | P1: Doctor unknown-key surfacing | Tasks | Pending  |
| HOTSPOT-1135      | P2: Living documentation         | Tasks | Pending  |
| HOTSPOT-1136–1139 | —                                | —     | Reserved |

**Coverage:** 36 assigned (1100–1135), 4 reserved (1136–1139). All assigned map to tasks.

---

## Success Criteria

- [ ] Init exemplar includes `$schema`, `$comments`, realistic include/exclude; meta keys never spam `UNKNOWN_CONFIG_KEY`
- [ ] Config schema file + three schema package exports exist and contract-test green
- [ ] `config validate` exits `0`/`2` correctly; `config print` shows source tags (+ `--format json`)
- [ ] Dry-run shows config path / remount / unknown keys
- [ ] Doctor `since` soft-warns empty window; hard-fails only on git-rejected since
- [ ] `pnpm build && pnpm test` green at feature Done
