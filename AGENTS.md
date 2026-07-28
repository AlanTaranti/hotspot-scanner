# AGENTS.md — @taranti/hotspot-scanner

Index for AI agents in this repository. **Policy SoTs live elsewhere** — this file points to them. Design SoT: [`.specs/codebase/ARCHITECTURE.md`](.specs/codebase/ARCHITECTURE.md). Doc ownership: [`.specs/codebase/DOC-OWNERSHIP.md`](.specs/codebase/DOC-OWNERSHIP.md). Module/CLI overlay: [`.cursor/skills/vitals-common/references/vitals-project.md`](.cursor/skills/vitals-common/references/vitals-project.md).

## Identity

| Field             | Value                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------- |
| **Package**       | `@taranti/hotspot-scanner`                                                            |
| **CLI bin**       | `hotspot-scanner` (unscoped)                                                          |
| **Purpose**       | Local CLI that ranks TS/JS maintenance hotspots from NCLOC and Git churn (file-level) |
| **Design SoT**    | [`.specs/codebase/ARCHITECTURE.md`](.specs/codebase/ARCHITECTURE.md)                  |
| **Project docs**  | `.specs/project/`, `.specs/codebase/`                                                 |
| **Feature specs** | `.specs/features/<slug>/`                                                             |

Pipeline: `git log` (streaming) → NCLOC size analysis → hotspot scoring → report (table / JSON / markdown / CSV). Config: `.hotspot-scanner.json` (CLI > config > defaults). JSON contract `version: "3.0"`. No compare/baseline CLI; `parseScanResult` retained for library consumers.

## Where to read

| Topic                          | Document                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| Doc ownership                  | [DOC-OWNERSHIP.md](.specs/codebase/DOC-OWNERSHIP.md)                                      |
| Modules / pipeline / contracts | [ARCHITECTURE.md](.specs/codebase/ARCHITECTURE.md)                                        |
| Fragile risks                  | [CONCERNS.md](.specs/codebase/CONCERNS.md)                                                |
| Tests / coverage               | [TESTING.md](.specs/codebase/TESTING.md)                                                  |
| Progress / decisions           | [ROADMAP.md](.specs/project/ROADMAP.md), [STATE.md](.specs/project/STATE.md)              |
| Feature work                   | `.specs/features/<slug>/`                                                                 |
| Exit codes                     | [docs/cli-reference.md](docs/cli-reference.md#exit-codes)                                 |
| Quality gate                   | [`.cursor/rules/quality-gates.mdc`](.cursor/rules/quality-gates.mdc) + TESTING § Coverage |
| Commit policy                  | [`.cursor/rules/commit-policy.mdc`](.cursor/rules/commit-policy.mdc)                      |
| YAGNI / surgical diffs         | [coding-guidelines](.cursor/skills/coding-guidelines/SKILL.md)                            |
| Requirement IDs `HOTSPOT-*`    | [`.cursor/rules/feature-planning.mdc`](.cursor/rules/feature-planning.mdc)                |

## Skills and agents

### Skills

| Skill                     | Use for                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `vitals-spec-driven`      | Specify → Design → Tasks (planning) + Execute handoff                                                               |
| `vitals-execute`          | Execute orchestration A→F (with `orchestrator-implementer`)                                                         |
| `vitals-common`           | Cross-phase overlay (vitals-project, roadmap-sync, implementer-routing)                                             |
| `vitals-pipeline-domain`  | Domain context for `src/**`, `schemas/`, `bin/` (git, NCLOC, scoring, trend, assess, diagnostics, doctor, paths, …) |
| `vitals-cli-validation`   | CLI flag/fixture validation + fixture authoring                                                                     |
| `task-implementer`        | Single `tasks.md` task RED→GREEN→VERIFY (used by `implementer`)                                                     |
| `coding-guidelines`       | Surgical diffs, simplicity, anti-overengineering                                                                    |
| `cursor-subagent-creator` | Authoring new `.cursor/agents/` entries for this repo                                                               |

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

## Hooks

After changing Cursor hooks under `.cursor/hooks/`, run `pnpm hooks:smoke` (does not replace the project gate). See [`.cursor/hooks/README.md`](.cursor/hooks/README.md).
