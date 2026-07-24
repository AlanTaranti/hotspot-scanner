# AGENTS.md — @vitals/hotspot-scanner

Canonical reference for AI agents working in this repository.

## Identity

| Field | Value |
|-------|-------|
| **Package** | `@vitals/hotspot-scanner` |
| **CLI bin** | `hotspot-scanner` (unscoped) |
| **Purpose** | Local CLI that ranks TS/JS maintenance hotspots from cyclomatic complexity, Git churn, and temporal coupling |
| **Design SoT** | [`.specs/codebase/ARCHITECTURE.md`](.specs/codebase/ARCHITECTURE.md) |
| **Project docs** | `.specs/project/`, `.specs/codebase/` |
| **Feature specs** | `.specs/features/<slug>/` |

## Pipeline

```
git log (streaming) → complexity (ts-morph + McCabe) → scoring (hotspot + coupling) → report (table / JSON / markdown / CSV)
```

Optional: `--baseline` → compare → delta report. Config: `.hotspot-scanner.json` (CLI > config > defaults).

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
```

| Exit code | Meaning |
|-----------|---------|
| `0` | Scan completed successfully |
| `!= 0` | Invalid repo/path, git error, or invalid CLI arguments |

## Skills and agents

### Skills

| Skill | Use for |
|-------|---------|
| `vitals-spec-driven` | Specify → Design → Tasks → Execute workflow |
| `vitals-pipeline-domain` | Domain context (git, complexity, scoring, compare, config, report) |
| `vitals-cli-validation` | CLI flag and fixture validation |
| `task-implementer` | Single `tasks.md` task RED→GREEN→VERIFY (used by `implementer`) |
| `coding-guidelines` | Surgical diffs, simplicity, anti-overengineering |
| `cursor-subagent-creator` | Authoring new `.cursor/agents/` entries for this repo |

### Agents

| Agent | Use for |
|-------|---------|
| `planner-feature` | Planning only — ends at `tasks.md` Status `Planned` |
| `orchestrator-implementer` | Execute phases A→F in a separate session |
| `implementer` | One task from `tasks.md` (Phase B) |
| `code-reviewer` | Conventions / maintainability review (Phase C) |
| `verifier-implementation` | Spec acceptance vs `spec.md` / `tasks.md` (Phase D) |
| `verifier-quality-gates` | Run `pnpm build && pnpm test` and report (Phase E) |
| `fixture-builder` | Create/update trees under `tests/fixtures/` |

## YAGNI

Implement only what was asked. No extra features, flags, or abstractions beyond the current requirement.
