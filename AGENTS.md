# AGENTS.md — @vitals/hotspot-scanner

Canonical reference for AI agents working in this repository.

## Identity

| Field | Value |
|-------|-------|
| **Package** | `@vitals/hotspot-scanner` |
| **CLI bin** | `hotspot-scanner` (unscoped) |
| **Purpose** | Local CLI that ranks TS/JS maintenance hotspots from cyclomatic complexity, Git churn, and temporal coupling |
| **Design SoT** | [specifications/IMPL-2026-003-hotspot-scanner.md](specifications/IMPL-2026-003-hotspot-scanner.md) |
| **Project docs** | `.specs/project/`, `.specs/codebase/` |
| **Feature specs** | `.specs/features/<slug>/` |

## Pipeline

```
git log (streaming) → complexity (ts-morph + McCabe) → scoring (hotspot + coupling) → report (CLI table / JSON)
```

## Quality gate

```bash
pnpm build && pnpm test
```

Required before marking any implementation task as Done. See [`.specs/codebase/TESTING.md`](.specs/codebase/TESTING.md).

## Requirement IDs

Prefix **`HOTSPOT-*`** in `spec.md` and `tasks.md` (e.g. `HOTSPOT-01`).

## Commit policy

- Propose a Conventional Commit message after verification.
- **Do not commit** unless the user explicitly asks.

## Validation (CLI)

No interactive UI UAT.

```bash
pnpm exec hotspot-scanner scan tests/fixtures/<repo>
pnpm exec hotspot-scanner scan tests/fixtures/<repo> --since "12 months ago" --format json
```

| Exit code | Meaning |
|-----------|---------|
| `0` | Scan completed successfully |
| `!= 0` | Invalid repo/path, git error, or invalid CLI arguments |

## Skills and agents

| Tool | Use for |
|------|---------|
| `vitals-spec-driven` | Specify → Design → Tasks → Execute workflow |
| `vitals-pipeline-domain` | Domain context (git, complexity, scoring, report) |
| `vitals-cli-validation` | CLI flag and fixture validation |
| `planner-feature` | Planning only — ends at `tasks.md` Status `Planned` |
| `orchestrator-implementer` | Execute phases in a separate session |
| `verifier-quality-gates` | Run `pnpm build && pnpm test` |

## YAGNI

Implement only what was asked. No extra features, flags, or abstractions beyond the current requirement.
