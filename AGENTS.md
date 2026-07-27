# AGENTS.md — @vitals/hotspot-scanner

Canonical reference for AI agents working in this repository.

## Identity

| Field             | Value                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| **Package**       | `@vitals/hotspot-scanner`                                                                                    |
| **CLI bin**       | `hotspot-scanner` (unscoped)                                                                                 |
| **Purpose**       | Local CLI that ranks TS/JS maintenance hotspots from NCLOC and Git churn (file-level) |
| **Design SoT**    | [`.specs/codebase/ARCHITECTURE.md`](.specs/codebase/ARCHITECTURE.md)                                         |
| **Project docs**  | `.specs/project/`, `.specs/codebase/`                                                                        |
| **Feature specs** | `.specs/features/<slug>/`                                                                                    |

## Pipeline

```
git log (streaming) → NCLOC size analysis → scoring (hotspot) → report (table / JSON / markdown / CSV)
```

Config: `.hotspot-scanner.json` (CLI > config > defaults). JSON contract `version: "3.0"`. Compare/baseline removed in M71 — `parseScanResult` retained for programmatic consumers.

## Quality gate

```bash
pnpm build && pnpm test
```

`pnpm test` runs `vitest run --coverage`. Required before marking any implementation task as Done. See [`.specs/codebase/TESTING.md`](.specs/codebase/TESTING.md) § Coverage for thresholds.

## Requirement IDs

Prefix **`HOTSPOT-*`** in `spec.md` and `tasks.md` (e.g. `HOTSPOT-01`).

## Commit policy

- Propose a Conventional Commit message after verification.
- **Do not commit** unless the user explicitly asks.

## Validation (CLI)

No interactive UI UAT. Fixture repos live under `tests/fixtures/repos/<slug>`.

```bash
pnpm exec hotspot-scanner scan tests/fixtures/repos/<slug>
pnpm exec hotspot-scanner scan tests/fixtures/repos/<slug> --since "12 months ago" --format json
pnpm exec hotspot-scanner trend tests/fixtures/repos/trend-indent/src/trend.ts --since "10 years ago"
```

| Exit code | Meaning |
| --------- | ------- |
| `0` | Scan completed successfully (`--explain` miss without `--fail-on-explain-miss` also exits `0`) |
| `1` | `--fail-on-explain-miss` with missing explain target |
| `2` | Invalid CLI args, config validation errors, or usage errors (including unknown removed `compare` / `baseline` / `--baseline` / `--strict`) |
| `130` | Cancelled by `SIGINT` (POSIX 128+2) |
| `143` | Cancelled by `SIGTERM` (POSIX 128+15) |

After changing Cursor hooks under `.cursor/hooks/`, run `pnpm hooks:smoke` (does not replace the project gate).

## Skills and agents

### Skills

| Skill                     | Use for                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| `vitals-spec-driven`      | Specify → Design → Tasks → Execute workflow                        |
| `vitals-pipeline-domain`  | Domain context (git, NCLOC, scoring, scan-result parse, config, report) |
| `vitals-cli-validation`   | CLI flag and fixture validation                                    |
| `task-implementer`        | Single `tasks.md` task RED→GREEN→VERIFY (used by `implementer`)    |
| `coding-guidelines`       | Surgical diffs, simplicity, anti-overengineering                   |
| `cursor-subagent-creator` | Authoring new `.cursor/agents/` entries for this repo              |

### Agents

| Agent                      | Use for                                             |
| -------------------------- | --------------------------------------------------- |
| `planner-feature`          | Planning only — ends at `tasks.md` Status `Planned` |
| `orchestrator-implementer` | Execute phases A→F in a separate session            |
| `implementer`              | One task from `tasks.md` (Phase B)                  |
| `code-reviewer`            | Conventions / maintainability review (Phase C)      |
| `verifier-implementation`  | Spec acceptance vs `spec.md` / `tasks.md` (Phase D) |
| `verifier-quality-gates`   | Run `pnpm build && pnpm test` and report (Phase E)  |
| `fixture-builder`          | Create/update trees under `tests/fixtures/`         |

## YAGNI

Implement only what was asked. No extra features, flags, or abstractions beyond the current requirement.
