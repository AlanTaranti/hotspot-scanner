# hotspot-scanner — subagent patterns

Guide for creating subagents **in this repository**. Read before writing a new file under `.cursor/agents/`. Prefer reusing an existing agent — inventory: [AGENTS.md](../../../../AGENTS.md) § Skills and agents.

## Skill vs subagent

| Type | When |
| ---- | ---- |
| **Skill** | Reusable workflow for the main agent (spec-driven, CLI validation, pipeline domain) |
| **Subagent** | Isolated session with a fixed role and frontmatter (planner, implementer, verifiers) |

For workflows that do **not** need isolated context, prefer a skill under `.cursor/skills/<name>/SKILL.md`.

## hotspot-scanner template

```markdown
---
name: my-agent
description: [hotspot-scanner role]. Use when [specific triggers]. Do NOT use for [anti-triggers]. See "When to invoke" in the agent body.
model: inherit
readonly: true|false
---

You are the **[Readable Name]** for @taranti/hotspot-scanner — [one line].

## When to invoke

...

## Before you act — read these

1. AGENTS.md (index)
2. vitals-project.md
3. Policy SoTs via AGENTS pointers (quality-gates, commit-policy, coding-guidelines)

## Hard constraints

- Follow [agent-hard-constraints.md](../../../agents/references/agent-hard-constraints.md) — do not restate gate/commit/YAGNI prose
- Requirement IDs: `HOTSPOT-*` ([feature-planning.mdc](../../../rules/feature-planning.mdc))
```

## Relevant rules

| Rule | Scope |
| ---- | ----- |
| `context-first` | Read `.specs/codebase/` before changing code; ownership → DOC-OWNERSHIP |
| `feature-planning` | Specify → Design → Tasks; session stops at Planned |
| `quality-gates` | Required gate |
| `commit-policy` | Commit only when asked |
| `fragile-areas` | git, complexity, scoring, scan-result, schemas |
| `integrations` | Behavioral adapter encapsulation |
| `bin-build` | tsconfig + tsconfig.bin.json |
| `testing-patterns` | Vitest, mock boundaries |

## Post-creation checklist

- [ ] Frontmatter `description` with triggers and anti-triggers
- [ ] References to AGENTS.md and vitals-project.md
- [ ] No overlap with existing agents in `.cursor/agents/` (see AGENTS inventory)
- [ ] Update AGENTS.md § Skills and agents if the agent is permanent
- [ ] Prefer `model: inherit`; set `readonly: true` for verifiers/reviewers
