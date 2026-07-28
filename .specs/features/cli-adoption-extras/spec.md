# Milestone 54 — CLI Adoption Extras Specification

**Feature slug:** `cli-adoption-extras`  
**Milestone:** ROADMAP M54  
**Priority:** Low  
**Depth:** Small  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [TESTING.md](../../codebase/TESTING.md), [INTEGRATIONS.md](../../codebase/INTEGRATIONS.md)  
**Context:** [`.specs/features/cli-adoption-extras/context.md`](./context.md)  
**Design:** [`.specs/features/cli-adoption-extras/design.md`](./design.md)  
**Sisters:** [cli-surface-polish](../cli-surface-polish/spec.md) (M38), [path-config-dx](../path-config-dx/spec.md) (M30)

## Problem Statement

Adopters who already know `scan` / `init` / `doctor` still type long flag names by hand; bash/zsh/fish completion is a standard CLI expectation. Separately, some users expect a `.hotspotignore` file; inventing that format duplicates config `exclude` / `--exclude` without proven need (YAGNI). M54 ships lightweight shell completion and documents the exclude path instead of a new ignore file.

## Goals

- [ ] `hotspot-scanner completion <bash|zsh|fish>` prints a usable completion script on stdout and exits 0
- [ ] Invalid shell argument fails with `CliUsageError` (exit 2) and lists allowed shells
- [ ] Scripts cover top-level commands and a representative set of public scan flags (static; no new deps)
- [ ] Docs teach how to install completion and explicitly reject `.hotspotignore` in favor of recipes / config `exclude`
- [ ] `pnpm build && pnpm test` green after Execute

## Out of Scope

| Feature                                                                              | Reason                                                                     |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `.hotspotignore` / gitignore-style ignore file loader                                | **Rejected** — see [context.md](./context.md); use `exclude` / `--exclude` |
| Reading `.gitignore` as scan scope                                                   | Separate product decision; not M54                                         |
| New completion libraries (`@bomb.sh/tab`, Carapace, …)                               | No new runtime deps for Low/Small                                          |
| PowerShell / nushell completion                                                      | Not in ROADMAP shell list                                                  |
| Dynamic completions (remote branches, live glob expansion beyond basic path helpers) | YAGNI MVP                                                                  |
| Changing PathScope defaults, ranking, or JSON `version: "1.0"`                       | Unrelated                                                                  |
| New `.hotspot-scanner.json` keys                                                     | Completion is CLI-only                                                     |
| npm publish / package install paths                                                  | Deferred (STATE.md)                                                        |
| M48 default artifact excludes / `.mjs`/`.cjs`                                        | Sister milestone                                                           |

---

## User Stories

### P1: Shell completion scripts ⭐ MVP

**User Story**: As a developer using bash, zsh, or fish, I want to install tab completion for `hotspot-scanner` so that I can discover subcommands and common flags without re-reading `--help`.

**Why P1**: ROADMAP M54 primary deliverable; adoption friction reducer.

**Acceptance Criteria**:

1. WHEN the user runs `hotspot-scanner completion bash` (or `zsh` / `fish`) THEN the CLI SHALL write a non-empty completion script for that shell to **stdout** and exit `0`
2. WHEN the user runs `hotspot-scanner completion <unknown>` THEN the CLI SHALL throw / surface `CliUsageError`, exit `2`, and SHALL mention the allowed shells `bash`, `zsh`, and `fish`
3. WHEN a generated script is inspected THEN it SHALL include completions (or equivalent shell constructs) for at least the top-level commands `init`, `doctor`, `scan`, `baseline`, `compare`, and `completion`
4. WHEN a generated `scan`-oriented section is inspected THEN it SHALL include a representative set of long flags including at least `--format`, `--output`, `--exclude`, `--include`, `--config`, and `--since`
5. WHEN `hotspot-scanner completion --help` or root/`completion` help is shown THEN it SHALL document the `<shell>` argument and the three supported shells
6. WHEN completion runs THEN it SHALL NOT invoke `runScan`, git mining, or AST analysis

**Independent Test**: `bin/hotspot-scanner.test.ts` — parse/run `completion` for each shell; assert substrings; invalid shell → exit 2 / `CliUsageError`.

**Requirements**: HOTSPOT-840, HOTSPOT-841, HOTSPOT-842, HOTSPOT-843, HOTSPOT-844

---

### P1: Document exclude; no `.hotspotignore` ⭐ MVP

**User Story**: As a user looking for an ignore file, I want clear guidance to use config / CLI `exclude` (and recipes) so that I do not wait for a non-existent `.hotspotignore`.

**Why P1**: ROADMAP M54 second item; locks YAGNI rejection in living docs.

**Acceptance Criteria**:

1. WHEN a reader opens `docs/recipes.md` (or a dedicated short subsection linked from README) THEN they SHALL find an explicit statement that **`.hotspotignore` is not supported**
2. WHEN that statement appears THEN it SHALL point to config `exclude` and/or `--exclude` with at least one copy-paste example (may reuse existing recipe snippets)
3. WHEN ARCHITECTURE CLI / path-scoping docs mention ignore-style files THEN they SHALL match this rejection (no “future `.hotspotignore`” promise left from M30 wording without update)
4. WHEN README documents shell completion install THEN it SHALL include one-liner examples for bash, zsh, and fish sourcing/installing the `completion` output

**Independent Test**: Docs review in task Done when; no automated content tests required beyond gate.

**Requirements**: HOTSPOT-845, HOTSPOT-846

---

## Edge Cases

- WHEN `completion` is invoked with zero shell args THEN the CLI SHALL fail usage (commander missing-arg or `CliUsageError`) with non-zero exit — not print a default shell script silently
- WHEN stdout is redirected to a file THEN the script body SHALL be the only intentional stdout payload (no progress noise)
- WHEN short aliases (`-f`, `-o`, …) are omitted from scripts THEN that is acceptable for MVP if long flags are present (short aliases optional)
- WHEN new public subcommands exist at Execute time (e.g. workflow commands) THEN scripts SHALL include those command names present on `createCliProgram` (sync with living CLI)

---

## Requirement Traceability

| Requirement ID  | Story                                              | Phase | Status  |
| --------------- | -------------------------------------------------- | ----- | ------- |
| HOTSPOT-840     | P1: `completion <shell>` stdout + exit 0           | Tasks | Pending |
| HOTSPOT-841     | P1: bash / zsh / fish supported                    | Tasks | Pending |
| HOTSPOT-842     | P1: invalid shell → exit 2                         | Tasks | Pending |
| HOTSPOT-843     | P1: commands + representative flags in scripts     | Tasks | Pending |
| HOTSPOT-844     | P1: help documents completion                      | Tasks | Pending |
| HOTSPOT-845     | P1: docs reject `.hotspotignore`; point to exclude | Tasks | Pending |
| HOTSPOT-846     | P1: README completion install + ARCHITECTURE sync  | Tasks | Pending |
| HOTSPOT-847–859 | Reserved                                           | —     | —       |

**Coverage:** 7 mapped, 13 reserved, 0 unmapped ⚠️

---

## Success Criteria

- [ ] Users can enable bash/zsh/fish completion via documented `completion` one-liners
- [ ] No `.hotspotignore` implementation or ambiguous “coming soon” promise remains in ARCHITECTURE / recipes for this path
- [ ] No new runtime dependencies for completion
- [ ] Full gate `pnpm build && pnpm test` green
