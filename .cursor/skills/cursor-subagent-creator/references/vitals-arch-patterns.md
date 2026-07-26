# hotspot-scanner — subagent patterns

Guide for creating subagents **in this repository** (`@vitals/hotspot-scanner`).

Read this file **before** writing a new file under `.cursor/agents/`. Prefer reusing an existing agent over creating a new one.

## Reuse vs create

| Need | Reuse | Do not create |
| ------------------------------ | -------------------------- | ------------------------- |
| Plan spec/design/tasks | `planner-feature` | Ad hoc planner |
| Orchestrate Execute | `orchestrator-implementer` | Duplicate orchestrator |
| Implement one task | `implementer` | Generic implementer |
| Post-implementation code review | `code-reviewer` | Reviewer without conventions |
| Acceptance vs spec | `verifier-implementation` | Verifier without criteria |
| Gate `pnpm build && pnpm test` | `verifier-quality-gates` | Ad hoc script |
| Create Git/TS fixtures | `fixture-builder` | Manual fixture without README |

## Skill vs subagent (hotspot-scanner)

| Type | When |
| ------------ | --------------------------------------------------------------------------------------------------- |
| **Skill** | Reusable workflow invoked by the main agent (spec-driven, CLI validation, pipeline domain) |
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

You are the **[Readable Name]** for @vitals/hotspot-scanner — [one line: local CLI, git/complexity/scoring/report pipeline].

## When to invoke

...

## Before you act — read these

1. AGENTS.md
2. vitals-project.md
3. TESTING.md / CONCERNS.md (when relevant)

## Hard constraints

- Gate: pnpm build && pnpm test
- Requirement IDs: HOTSPOT-*
- Do not commit unless the user explicitly asks
```

## Relevant rules

| Rule | Scope |
| ------------------ | ------------------------------------------------ |
| `context-first` | Read `.specs/codebase/` before changing code |
| `feature-planning` | Specify → Design → Tasks; session stops at Planned |
| `quality-gates` | Required gate |
| `fragile-areas` | git, complexity, scoring, compare, schemas |
| `integrations` | ts-morph, git, commander, schemas |
| `bin-build` | tsconfig + tsconfig.bin.json |
| `testing-patterns` | Vitest, mock boundaries |

## Post-creation checklist

- [ ] Frontmatter `description` with triggers and anti-triggers
- [ ] References to AGENTS.md and vitals-project.md
- [ ] No overlap with existing agents in `.cursor/agents/`
- [ ] Update AGENTS.md § Skills and agents if the agent is permanent
- [ ] Prefer `model: inherit`; set `readonly: true` for verifiers/reviewers
