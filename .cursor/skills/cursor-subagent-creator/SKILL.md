---
name: cursor-subagent-creator
description: Creates Cursor-specific AI subagents with isolated context for complex multi-step workflows. Use when creating subagents for Cursor editor specifically, following Cursor's patterns and directories (.cursor/agents/). Triggers on "cursor subagent", "cursor agent", "criar subagent", "novo agente cursor", "adicionar agent em .cursor/agents". Do NOT use for creating skills — prefer a dedicated skill file under .cursor/skills/ or Cursor create-skill guidance.
---

# Cursor Subagent Creator

Create or extend subagents under `.cursor/agents/` for **@taranti/hotspot-scanner**.

## Before writing

1. Read [references/vitals-arch-patterns.md](references/vitals-arch-patterns.md) — reuse-vs-create matrix, repo template, post-creation checklist.
2. Check inventory: [AGENTS.md](../../../AGENTS.md). Prefer reuse over a new agent.
3. Workflows **without** isolated context → skill under `.cursor/skills/<name>/SKILL.md` instead.

## When to use

- New specialized subagent (planner, implementer, verifier, domain expert) that needs isolated context
- Explicit asks to add/create an agent under `.cursor/agents/`

**Do NOT use** for simple one-off tasks or for authoring skills.

## Creation process

1. **Define purpose** — specific responsibility; why isolated context is required.
2. **Write frontmatter** — `name`, trigger-rich `description` (include Do NOT use), `model: inherit`, `readonly` as needed.
3. **Write body** — When to invoke / Do NOT invoke, Before you act (pointers), Hard constraints, report format. Follow the template in `vitals-arch-patterns.md`.
4. **Update** AGENTS.md inventory.
5. **Prefer reuse** — do not duplicate planner / orchestrator / implementer / verifiers / fixture-builder.

## Hard constraints

- Shared constraints: [agent-hard-constraints.md](../../agents/references/agent-hard-constraints.md)
- Requirement IDs: `HOTSPOT-*`
- Planning agents end at `tasks.md` Status `Planned` (no Execute in the same session)
- Role files stay lean — policies live in rules/skills (see [agent-roles-sot.mdc](../../rules/agent-roles-sot.mdc))

## Further reading

- [vitals-arch-patterns.md](references/vitals-arch-patterns.md)
- [AGENTS.md](../../../AGENTS.md)
- Cursor docs for editor-specific frontmatter fields beyond this repo guide
