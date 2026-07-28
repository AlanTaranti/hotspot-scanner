# DOC-OWNERSHIP — @vitals/hotspot-scanner

Canonical map of **where documentation content belongs**. Editorial rules under `.cursor/rules/*-sot.mdc` and hook lint in `living-sot-doc.mjs` enforce per-file Forbidden patterns; this file is the single ownership matrix.

It is **not** a Design SoT, milestone tracker, or flag encyclopedia.

## Ownership matrix

| Change type | Destination |
| ----------- | ----------- |
| Doc ownership / “where content goes” | **DOC-OWNERSHIP.md** (this file); editorial: `.cursor/rules/doc-ownership-sot.mdc` |
| Modules, pipelines, contracts, constraints, adapter ownership boundaries | **ARCHITECTURE.md** |
| Fragile risks / RT / mitigations | **CONCERNS.md** |
| External spawn / deps / `node:fs` adapter ownership | **INTEGRATIONS.md** |
| Directory layout / public API map / where things live | **STRUCTURE.md** |
| Runtime / deps / publish `files` / `engines` / exports | **STACK.md** |
| Naming, ESM, dual-tsconfig, lint/format scripts | **CONVENTIONS.md** |
| Fixture methodology, Vitest patterns, coverage, mock boundaries, gates | **TESTING.md** |
| Product vision / goals / constraints / capability scope | **PROJECT.md** |
| Milestone status, Done summary, lean archive | **ROADMAP.md** / `.specs/features/` |
| ROADMAP create + lean sync procedure | `.cursor/skills/vitals-common/references/roadmap-sync.md` |
| Lasting locks, blockers, lessons, open deferred | **STATE.md** |
| Agent index (skills/agents inventory) + pointers to policy SoTs | **AGENTS.md** (index only — not a policy SoT) |
| Shared agent hard constraints | `.cursor/skills/vitals-common/references/agent-hard-constraints.md` |
| Operational project overlay (not identity index) | `.cursor/skills/vitals-common/references/vitals-project.md` |
| Quality gate command | `.cursor/rules/quality-gates.mdc` + **TESTING.md** § Coverage |
| Commit policy | `.cursor/rules/commit-policy.mdc` (enforce: hooks) |
| YAGNI / surgical diffs | `.cursor/skills/coding-guidelines/SKILL.md` |
| Requirement ID prefix `HOTSPOT-*` | `.cursor/rules/feature-planning.mdc` |
| Module task routing (overlay; layout SoT = STRUCTURE) | `.cursor/skills/vitals-common/references/implementer-routing.md` |
| Planning Specify → Design → Tasks | `.cursor/skills/vitals-spec-driven/SKILL.md` |
| Task pre-approval validation checks | `.cursor/skills/vitals-spec-driven/references/task-validation.md` |
| Execute playbook A→F | `.cursor/skills/vitals-execute/references/execute-orchestration-playbook.md` |
| Acceptance validate checklist (Phase D; not project gate) | `.cursor/skills/vitals-execute/references/validate.md` |
| Single-task RED→GREEN→VERIFY | `.cursor/skills/task-implementer/SKILL.md` |
| CLI validation + fixture authoring workflow (flags SoT = cli-reference) | `.cursor/skills/vitals-cli-validation/SKILL.md` |
| Exit codes (canonical table) | **`docs/cli-reference.md`** § Exit codes |
| Human contribute guide (setup, gate, PR workflow) | **CONTRIBUTING.md** |
| Adoption / first-run (essential flags, short API, short exit overview) | **README.md** |
| Flag encyclopedia, pipeline internals, progress/TTY, assess/explain long | **`docs/cli-reference.md`** |
| Cookbooks / workflows | **`docs/recipes.md`** |
| Why NCLOC / indentation methodology | **`docs/methodology.md`** |
| Warning code catalog | **`docs/warning-codes.md`** |

## Sync rule

When living docs change after Execute:

1. Put new content in the destination row above — do not mirror the same table into multiple SoTs.
2. Self-check: *Does this sentence need a milestone number to make sense?* If yes → ROADMAP / STATE / feature specs, not a present-tense SoT.
3. Feature `design.md` / `tasks.md` may keep `M##`; extract only lasting facts into the destination SoT.
