# Milestone 38 — CLI Surface Polish Specification

**Feature slug:** `cli-surface-polish`  
**Milestone:** ROADMAP M38  
**Priority:** High  
**Depth:** Medium  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [TESTING.md](../../codebase/TESTING.md)  
**Context:** [`.specs/features/cli-surface-polish/context.md`](./context.md)  
**Design:** [`.specs/features/cli-surface-polish/design.md`](./design.md)

## Problem Statement

First-time and daily CLI users must always pass an explicit repo path, lack `--version`, have no quiet/no-progress control for CI/scripts, see cryptic errors without next steps, and discover flags only by reading README — not `scan --help`. M38 polishes the commander surface without changing rankings, JSON contract, or adding new config keys.

## Goals

- [ ] `hotspot-scanner scan` with no `<path>` defaults to `.` and still validates `.git`
- [ ] `--version` / `-V` prints `package.json` version and exits 0
- [ ] `--quiet` and `--no-progress` control stderr diagnostics; report + errors remain
- [ ] Common misuses emit actionable next-step hints (non-git, csv without `--output`, baseline, missing `--config`)
- [ ] `scan --help` includes short examples and documents short aliases `-f` / `-o` / `-t` / `-g`
- [ ] `pnpm build && pnpm test` green after Execute

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| npm publish / npx install | Deferred (STATE.md); not M38–M45 |
| `init` / `doctor` / `--dry-run` | M39 |
| Workflow subcommands (`baseline save` / `compare`) | M40 |
| Output colors / legend / triage hints | M41 |
| `--explain` / rename next-steps / complexity progress | M42 |
| Changing ranking formulas or JSON `version: "1.0"` contract | YAGNI / contract freeze |
| New `.hotspot-scanner.json` keys for quiet / version / progress | CLI-only flags |
| `--verbose` | Not clearly useful beyond default diagnostics — see context.md |
| Monorepo cwd heuristics (scan from package without `.git` at path) | M43 |
| Changing exit-code scheme (0 success; `CliUsageError`/`ConfigError` → 2; else → 1) | Preserve M5/M21 |

---

## User Stories

### P1: Default scan path is cwd ⭐ MVP

**User Story**: As a developer in a Git repo root, I want `hotspot-scanner scan` (no path) to scan `.` so that the common case matches other CLIs.

**Why P1**: ROADMAP M38 item 1; removes friction for adoption.

**Acceptance Criteria**:

1. WHEN the user runs `hotspot-scanner scan` with no path argument THEN the CLI SHALL treat `repoPath` as `.`
2. WHEN the user runs `hotspot-scanner scan` (or `scan .`) and `.` is not a Git repository (no `.git`) THEN the CLI SHALL fail non-zero with a not-a-git error (same validation as today via `runScan` / `validateGitRepository`)
3. WHEN the user passes an explicit path THEN that path SHALL be used unchanged (no forced rewrite to `.`)
4. WHEN `scan --help` lists the path argument THEN it SHALL be documented as optional (default `.`)

**Independent Test**: Unit/integration — `createCliProgram` optional argument default; integration chdir to `small-ts` and `scan` with no path exits 0.

**Requirements**: HOTSPOT-450, HOTSPOT-451

---

### P1: Version flag from package.json ⭐ MVP

**User Story**: As a user or script, I want `--version` / `-V` so that I can confirm which build is installed without reading `package.json`.

**Why P1**: ROADMAP M38 item 2; standard CLI ergonomics.

**Acceptance Criteria**:

1. WHEN the user runs `hotspot-scanner --version` or `hotspot-scanner -V` THEN the CLI SHALL print the `version` field from the package root `package.json` and exit `0`
2. WHEN `package.json` version is `"1.0.0"` (current) THEN printed output SHALL include `1.0.0` (commander default formatting OK)
3. WHEN `--version` / `-V` is used THEN a scan SHALL NOT run

**Independent Test**: `bin/hotspot-scanner.test.ts` — parse `--version` / `-V` against known package version string.

**Requirements**: HOTSPOT-452

---

### P1: Quiet and no-progress diagnostics ⭐ MVP

**User Story**: As a CI author, I want `--quiet` and `--no-progress` so that stderr stays clean while the report (and real errors) still appear.

**Why P1**: ROADMAP M38 item 3 (quiet / no-progress); `--verbose` explicitly omitted.

**Acceptance Criteria**:

1. WHEN `--no-progress` is set THEN the CLI SHALL NOT emit progress lines (`Processing <phase> commit …`) on stderr
2. WHEN `--quiet` is set THEN the CLI SHALL suppress progress lines AND `ScanWarning` entries with `severity: "info"` on stderr
3. WHEN `--quiet` is set THEN `severity: "warning"` and `severity: "error"` warnings SHALL still be written to stderr (via existing diagnostics)
4. WHEN `--quiet` or `--no-progress` is set THEN the scan report on stdout (or `--output` file) SHALL still be produced on success
5. WHEN a `CliUsageError`, `ConfigError`, `BaselineError`, or fatal scan error occurs under `--quiet` THEN the error message SHALL still be printed to stderr and exit code SHALL remain non-zero
6. WHEN both `--quiet` and `--no-progress` are set THEN behavior SHALL match `--quiet` (quiet is a superset)
7. WHEN neither flag is set THEN default progress + all severities SHALL match pre-M38 behavior

**Independent Test**: Unit tests with mocked `onProgress` / `onWarning` sinks or stderr spies; optional integration on `small-ts`.

**Requirements**: HOTSPOT-453, HOTSPOT-454

---

### P1: Actionable error hints ⭐ MVP

**User Story**: As a new user who mistypes a flag or path, I want the error to suggest a concrete next step so that I can recover without reading the full README.

**Why P1**: ROADMAP M38 item 4.

**Acceptance Criteria**:

1. WHEN `repoPath` is not a Git repository THEN the error text SHALL include an actionable hint (e.g. pass a repo root that contains `.git`, or `cd` into the repo)
2. WHEN `--format csv` is used without `--output` THEN the existing `CliUsageError` SHALL include a hint to add `--output <stem>` (bundle write)
3. WHEN `--baseline` points to a missing file or a directory THEN the `CliUsageError` from `validateBaselinePath` SHALL include a hint to pass a prior `--format json` scan file
4. WHEN `--baseline` points to an existing file that fails `loadBaseline` validation THEN the error (`BaselineError`) presented to the user SHALL include a hint to re-scan with current JSON contract / fix the baseline file
5. WHEN `--config <path>` points to a missing file THEN the `ConfigError` SHALL include a hint that the path must exist (discovery miss without `--config` remains non-error)
6. WHEN these errors occur THEN exit codes SHALL remain unchanged (`CliUsageError` / `ConfigError` → 2; `BaselineError` / other → 1 per existing `main` mapping)

**Independent Test**: `bin/hotspot-scanner.test.ts` asserts hint substrings for each case; no change to JSON schema.

**Requirements**: HOTSPOT-455, HOTSPOT-456, HOTSPOT-457, HOTSPOT-458

---

### P1: Help examples and short aliases ⭐ MVP

**User Story**: As a user discovering the tool, I want examples and short aliases in `scan --help` so that common flags are faster to type and easier to learn.

**Why P1**: ROADMAP M38 items 5–6.

**Acceptance Criteria**:

1. WHEN the user runs `hotspot-scanner scan --help` THEN the help text SHALL include an Examples section with at least: default cwd scan; JSON + `--output`; short-alias usage; optional `--baseline` example
2. WHEN defining format / output / top / granularity options THEN commander SHALL accept short aliases `-f`, `-o`, `-t`, `-g` respectively **in addition to** long flags
3. WHEN long flags `--format`, `--output`, `--top`, `--granularity` are used THEN behavior SHALL be unchanged
4. WHEN `scan --help` lists those options THEN short and long forms SHALL both appear (commander default)

**Independent Test**: Help text contains Examples and `-f, --format` (etc.); unit parse of `-f json -o out.json -t 5 -g function`.

**Requirements**: HOTSPOT-459, HOTSPOT-460

---

### P2: Living docs for CLI polish

**User Story**: As a README reader, I want the flags table to mention default path, version, quiet/no-progress, aliases, and error-hint behavior so that docs match the CLI.

**Why P2**: Adoption consistency; Execute still syncs README / ARCHITECTURE lightly.

**Acceptance Criteria**:

1. WHEN Execute completes THEN README flag docs SHALL mention optional path default `.`, `--version`/`-V`, `--quiet`, `--no-progress`, and aliases `-f`/`-o`/`-t`/`-g`
2. WHEN Execute completes THEN ARCHITECTURE CLI bullet SHALL list the new flags (no config keys)
3. WHEN Execute completes THEN ROADMAP M38 implementation checkboxes SHALL be marked Done (Execute only — not this planning session)

**Independent Test**: Grep README / ARCHITECTURE for the new flags after Execute.

**Requirements**: HOTSPOT-461

---

## Edge Cases

- WHEN `argv` is only the binary name (no `scan`) THEN existing `runCli` help/`CliUsageError` behavior SHALL remain (M38 does not redesign root help)
- WHEN `scan` is run outside any Git repo with default `.` THEN fail with not-a-git + hint (do not invent monorepo walk — M43)
- WHEN `--quiet` is combined with `--format json --output …` THEN file/stdout report SHALL be complete; only stderr diagnostics are filtered
- WHEN `--version` is combined with `scan` subcommand args THEN commander’s version handling takes precedence at program level (no scan) — document if commander behavior differs; do not invent a custom conflict policy beyond commander defaults
- WHEN short alias values are invalid (e.g. `-f xml`) THEN existing `CliUsageError` parse messages SHALL apply (hints optional, not required for every parse error)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-450 | P1: Default scan path | Tasks | Pending |
| HOTSPOT-451 | P1: Default path `.git` validation | Tasks | Pending |
| HOTSPOT-452 | P1: Version flag | Tasks | Pending |
| HOTSPOT-453 | P1: `--quiet` | Tasks | Pending |
| HOTSPOT-454 | P1: `--no-progress` | Tasks | Pending |
| HOTSPOT-455 | P1: Hint — non-git path | Tasks | Pending |
| HOTSPOT-456 | P1: Hint — csv without `--output` | Tasks | Pending |
| HOTSPOT-457 | P1: Hint — baseline missing/invalid | Tasks | Pending |
| HOTSPOT-458 | P1: Hint — missing `--config` | Tasks | Pending |
| HOTSPOT-459 | P1: Help examples | Tasks | Pending |
| HOTSPOT-460 | P1: Short aliases | Tasks | Pending |
| HOTSPOT-461 | P2: Living docs | Tasks | Pending |

**ID range used:** HOTSPOT-450–461 (462–469 reserved unused)  
**Coverage:** 12 total, mapped in tasks.md

---

## Success Criteria

- [ ] `hotspot-scanner scan` works from a Git cwd without an explicit path
- [ ] `--version` / `-V` prints package version
- [ ] CI can silence progress with `--quiet` or `--no-progress` without losing reports or hard errors
- [ ] Four common error families include next-step hints
- [ ] `scan --help` shows examples + short aliases
- [ ] No JSON contract / ranking / config-key changes
- [ ] Gate: `pnpm build && pnpm test`
