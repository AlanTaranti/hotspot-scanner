# Milestone 63 — CLI Surface Parity Specification

**Feature slug:** `cli-surface-parity`  
**Milestone:** M63  
**Priority:** High  
**Status:** Specs Planned  
**Depth:** Large  
**IDs:** HOTSPOT-1060–1099 (1096–1099 reserved)  
**Artifacts:** [context.md](./context.md) · [design.md](./design.md) · [tasks.md](./tasks.md)  
**Sisters:** [csv-bundle](../csv-bundle/) (M18), [cli-surface-polish](../cli-surface-polish/) (M38), [workflow-subcommands](../workflow-subcommands/) (M40), [explain-and-scan-feedback](../explain-and-scan-feedback/) (M42), [cli-adoption-extras](../cli-adoption-extras/) (M54), [cli-warnings-mode](../cli-warnings-mode/) (M58)

---

## Problem Statement

CLI surface has drifted across commands and shells: `baseline save` lacks quiet/progress/verbose parity with `scan`; zsh/fish completions lag bash; path-first invocation is awkward; explain misses always succeed (hard for CI); stderr warnings cannot be consumed as JSON; and CSV always expands to a multi-file stem bundle even when operators want one hotspots file at an exact path.

## Goals

- [ ] Parity: `--quiet` / `--no-progress` / `--verbose` on `baseline save`
- [ ] Path-like first argv rewrites to `scan <path>`; bare CLI still help + exit 2
- [ ] Opt-in `--fail-on-explain-miss` → exit 1 on explain target miss
- [ ] `--warnings` gains `json` mode; default `summary`; `meta.warnings` stays full
- [ ] Opt-in `--csv-single-file` writes hotspots CSV to exact `--output` (M18 default unchanged)
- [ ] zsh/fish completion flag lists match bash, including new flags
- [ ] Living docs (README / ARCHITECTURE) reflect the surface

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| JSON schema / `version` bump | Presentation + CLI only |
| Config keys for new flags | CLI-only session UX (M38/M58 pattern) |
| M17 multi-block / section-marker CSV | Rejected — simpler hotspots-only single file |
| Fail-on-warning / SARIF / score thresholds | Deferred horizon |
| Changing bare-invocation help+exit 2 | Explicit lock |
| PowerShell / nushell completion | M54 shell list |
| Ranking, NCLOC, git miner changes | YAGNI |

---

## User Stories

### P1: `baseline save` diagnostic flag parity ⭐ MVP

**User Story:** As a CI operator, I want `--quiet`, `--no-progress`, and `--verbose` on `baseline save` so baseline generation matches `scan` presentation controls.

**Why P1:** Clear gap vs scan/compare; blocks quiet baseline scripts.

**Acceptance Criteria:**

1. WHEN `baseline save` is invoked with `--quiet` THEN the CLI SHALL suppress progress and info-level diagnostics (parity with `scan --quiet`).
2. WHEN `baseline save` is invoked with `--no-progress` THEN the CLI SHALL suppress progress lines only.
3. WHEN `baseline save` is invoked with `--verbose` (and not `--quiet`) THEN the CLI SHALL emit git spawn argv lines on stderr (M51 parity).
4. WHEN `baseline save --help` is shown THEN it SHALL list `--quiet`, `--no-progress`, and `--verbose`.

**Requirements:** HOTSPOT-1060, HOTSPOT-1061, HOTSPOT-1062, HOTSPOT-1063

**Independent Test:** Unit tests on `baseline save` action wiring + help text; mock `runScan` and assert handlers options.

---

### P1: Path-like argv → `scan` rewrite ⭐ MVP

**User Story:** As a CLI user, I want `hotspot-scanner .` (and similar path-first forms) to run a scan so I do not have to type `scan` every time.

**Why P1:** High-frequency DX; locked carefully to avoid stealing subcommands.

**Acceptance Criteria:**

1. WHEN first user argv is `.`, starts with `./`, is absolute, or is an existing directory, AND is not a known subcommand THEN `runCli` SHALL rewrite argv to insert `scan` before that path.
2. WHEN argv is bare (`length <= 2`) THEN the CLI SHALL still show help and exit **2** (no rewrite).
3. WHEN first argv is a known subcommand (`init`, `doctor`, `scan`, `baseline`, `compare`, `completion`) or help/version token THEN the CLI SHALL NOT rewrite.
4. WHEN first argv is a flag (e.g. `--quiet`) THEN the CLI SHALL NOT rewrite.

**Requirements:** HOTSPOT-1065, HOTSPOT-1066, HOTSPOT-1067, HOTSPOT-1068

**Independent Test:** `runCli` unit tests for rewrite matrix + bare help path.

---

### P1: `--fail-on-explain-miss` ⭐ MVP

**User Story:** As a CI user, I want an opt-in flag so a missing `--explain` target fails the process while default behavior stays success-on-miss.

**Why P1:** Unlocks CI explain checks without breaking M42 default.

**Acceptance Criteria:**

1. WHEN `--explain` misses and `--fail-on-explain-miss` is **absent** THEN the CLI SHALL print the not-found message on stderr and exit **0** if the scan/compare succeeded (M42).
2. WHEN `--explain` misses and `--fail-on-explain-miss` is **set** THEN the CLI SHALL print the not-found message and exit **1**.
3. WHEN `--explain` finds a target and `--fail-on-explain-miss` is set THEN the CLI SHALL exit **0** on success (flag is a no-op for found targets).
4. WHEN `--fail-on-explain-miss` is set **without** `--explain` THEN the CLI SHALL throw `CliUsageError` (exit **2**).
5. WHEN the flag is used THEN it SHALL be available on `scan` and `compare` (including `scan --baseline --explain`).

**Requirements:** HOTSPOT-1070, HOTSPOT-1071, HOTSPOT-1072, HOTSPOT-1073, HOTSPOT-1074

**Independent Test:** Existing explain miss fixtures + new exit-code assertions; compare miss path covered.

---

### P1: `--warnings=json` ⭐ MVP

**User Story:** As a script author, I want `--warnings json` so stderr warnings are machine-readable without thinning JSON report `meta.warnings`.

**Why P1:** Completes M58 presentation modes for automation.

**Acceptance Criteria:**

1. WHEN `--warnings` is omitted THEN mode SHALL remain **`summary`**.
2. WHEN `--warnings json` (or `--warnings=json`) is set THEN after warning emission / flush the CLI SHALL write **one** JSON object to stderr with a `warnings` array of full `ScanWarning` objects (code, message, severity).
3. WHEN mode is `json` THEN the CLI SHALL NOT also emit human `summary`/`full` text warning lines for those buffered diagnostics.
4. WHEN any `--warnings` mode runs THEN `meta.warnings` in the report SHALL remain the **full** structured list (M58).
5. WHEN an invalid `--warnings` value is passed THEN `CliUsageError` SHALL list allowed values `summary`, `full`, or `json`.
6. WHEN `--quiet` and `--warnings=json` THEN `info` SHALL remain suppressed from the stderr JSON payload (parity with quiet).

**Requirements:** HOTSPOT-1075, HOTSPOT-1076, HOTSPOT-1077, HOTSPOT-1078, HOTSPOT-1079, HOTSPOT-1080, HOTSPOT-1081

**Independent Test:** Diagnostics unit tests for json flush; CLI tests asserting stderr JSON + intact `meta.warnings`.

---

### P1: `--csv-single-file` ⭐ MVP

**User Story:** As a CLI user, I want an opt-in single hotspots CSV at my exact `--output` path so I can skip stem expansion when I only need the ranking table.

**Why P1:** Complements M18 without breaking the default bundle.

**Acceptance Criteria:**

1. WHEN `--format csv` without `--csv-single-file` THEN behavior SHALL remain the M18 multi-file stem bundle.
2. WHEN `--format csv --csv-single-file --output <path>` on **scan** THEN the CLI SHALL write hotspots-only CSV to **exactly** `<path>` (no stem suffix, no `meta.json`).
3. WHEN `--format csv --csv-single-file --output <path>` on **compare** THEN the CLI SHALL write **hotspots.new** CSV only to exactly `<path>`.
4. WHEN `--format csv` (with or without `--csv-single-file`) lacks `--output` THEN `CliUsageError` exit **2**.
5. WHEN `--csv-single-file` is set without `--format csv` THEN `CliUsageError` exit **2**.

**Requirements:** HOTSPOT-1082, HOTSPOT-1083, HOTSPOT-1084, HOTSPOT-1085, HOTSPOT-1086, HOTSPOT-1087

**Independent Test:** Temp-dir write assertions for single path vs stem bundle; compare single-file path.

---

### P1: Shell completion parity ⭐ MVP

**User Story:** As a zsh/fish user, I want the same long-flag completions as bash, including flags from this milestone.

**Why P1:** M54 drift is a documented gap; new flags must not widen it.

**Acceptance Criteria:**

1. WHEN `completion bash|zsh|fish` is emitted THEN each script SHALL include the shared scan/compare long flags present in bash `SCAN_FLAGS` (after this milestone’s additions).
2. WHEN scripts are updated THEN they SHALL include `--fail-on-explain-miss`, `--csv-single-file`, and `--warnings` documentation/values reflecting `summary|full|json`.
3. WHEN `baseline` completions are emitted THEN they SHALL include `--quiet`, `--no-progress`, and `--verbose` (parity with bash baseline subset after this milestone).

**Requirements:** HOTSPOT-1088, HOTSPOT-1089, HOTSPOT-1090, HOTSPOT-1091

**Independent Test:** `completion-scripts` unit tests asserting flag substrings in all three shells.

---

### P2: Living docs

**User Story:** As a new user, I want README/ARCHITECTURE to document the new flags and path rewrite so adoption docs stay accurate.

**Why P2:** Required for Done; not a runtime dependency.

**Acceptance Criteria:**

1. WHEN reading README CLI docs THEN path→scan rewrite, `--fail-on-explain-miss`, `--warnings=json`, `--csv-single-file`, and baseline quiet/progress/verbose SHALL be documented.
2. WHEN reading ARCHITECTURE CLI section THEN completion drift-control note SHALL mention keeping zsh/fish aligned with bash.

**Requirements:** HOTSPOT-1093, HOTSPOT-1094, HOTSPOT-1095

**Independent Test:** Doc review in task Done when; no runtime gate beyond presence of strings if desired.

---

## Edge Cases

- WHEN first argv is `scan` THEN no double-insert of `scan`.
- WHEN path rewrite targets a directory that is not a git repo THEN existing scan validation/errors apply after rewrite.
- WHEN `--fail-on-explain-miss` and scan itself fails THEN scan failure exit code wins (explain miss not evaluated / not required).
- WHEN `--warnings=json` and there are zero warnings THEN stderr JSON SHALL be `{"warnings":[]}` (or omit flush content only if no buffer — **locked: always emit `{"warnings":[]}` on flush when mode is json** so scripts can parse stably).
- WHEN `--csv-single-file` with `--only` that excludes hotspots THEN `CliUsageError`.
- WHEN `--quiet --verbose` on baseline save THEN quiet wins (M51/M38).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-1060 | P1: baseline `--quiet` | Tasks | Pending |
| HOTSPOT-1061 | P1: baseline `--no-progress` | Tasks | Pending |
| HOTSPOT-1062 | P1: baseline `--verbose` | Tasks | Pending |
| HOTSPOT-1063 | P1: baseline help lists flags | Tasks | Pending |
| HOTSPOT-1064 | — | — | Reserved (unused) |
| HOTSPOT-1065 | P1: path rewrite rules | Tasks | Pending |
| HOTSPOT-1066 | P1: bare CLI unchanged | Tasks | Pending |
| HOTSPOT-1067 | P1: no rewrite for subcommands | Tasks | Pending |
| HOTSPOT-1068 | P1: no rewrite for flags | Tasks | Pending |
| HOTSPOT-1069 | — | — | Reserved (unused) |
| HOTSPOT-1070 | P1: default explain miss exit 0 | Tasks | Pending |
| HOTSPOT-1071 | P1: fail-on miss exit 1 | Tasks | Pending |
| HOTSPOT-1072 | P1: found + flag still 0 | Tasks | Pending |
| HOTSPOT-1073 | P1: flag without explain → 2 | Tasks | Pending |
| HOTSPOT-1074 | P1: scan + compare surface | Tasks | Pending |
| HOTSPOT-1075 | P1: warnings default summary | Tasks | Pending |
| HOTSPOT-1076 | P1: json stderr payload | Tasks | Pending |
| HOTSPOT-1077 | P1: no human lines in json mode | Tasks | Pending |
| HOTSPOT-1078 | P1: meta.warnings full | Tasks | Pending |
| HOTSPOT-1079 | P1: invalid warnings values | Tasks | Pending |
| HOTSPOT-1080 | P1: quiet + json | Tasks | Pending |
| HOTSPOT-1081 | P1: empty warnings JSON | Tasks | Pending |
| HOTSPOT-1082 | P1: default CSV bundle | Tasks | Pending |
| HOTSPOT-1083 | P1: scan single-file write | Tasks | Pending |
| HOTSPOT-1084 | P1: compare single-file write | Tasks | Pending |
| HOTSPOT-1085 | P1: csv requires output | Tasks | Pending |
| HOTSPOT-1086 | P1: flag requires csv format | Tasks | Pending |
| HOTSPOT-1087 | P1: only/hotspots guard | Tasks | Pending |
| HOTSPOT-1088 | P1: zsh/fish ↔ bash flags | Tasks | Pending |
| HOTSPOT-1089 | P1: new flags in completions | Tasks | Pending |
| HOTSPOT-1090 | P1: baseline completion quiet trio | Tasks | Pending |
| HOTSPOT-1091 | P1: completion tests | Tasks | Pending |
| HOTSPOT-1092 | — | — | Reserved (unused) |
| HOTSPOT-1093 | P2: README | Tasks | Pending |
| HOTSPOT-1094 | P2: ARCHITECTURE | Tasks | Pending |
| HOTSPOT-1095 | P2: help text for new flags | Tasks | Pending |
| HOTSPOT-1096–1099 | — | — | Reserved |

**Coverage:** 36 active IDs mapped to tasks; 4 + gaps reserved unused (1064, 1069, 1092, 1096–1099).

---

## Success Criteria

- [ ] `baseline save` quiet/progress/verbose parity verified by tests
- [ ] `hotspot-scanner .` → scan; bare CLI → help exit 2
- [ ] `--fail-on-explain-miss` opt-in exit 1; default miss exit 0
- [ ] `--warnings=json` parses; `meta.warnings` unchanged fullness
- [ ] `--csv-single-file` exact-path write; default bundle intact
- [ ] bash/zsh/fish completion parity tests green
- [ ] `pnpm build && pnpm test` green
