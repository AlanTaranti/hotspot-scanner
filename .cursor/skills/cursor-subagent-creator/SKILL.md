---
name: cursor-subagent-creator
description: Creates Cursor-specific AI subagents with isolated context for complex multi-step workflows. Use when creating subagents for Cursor editor specifically, following Cursor's patterns and directories (.cursor/agents/). Triggers on "cursor subagent", "cursor agent", "criar subagent", "novo agente cursor", "adicionar agent em .cursor/agents". Do NOT use for creating skills — prefer a dedicated skill file under .cursor/skills/ or Cursor create-skill guidance.
---

# Cursor Subagent Creator

You are an expert in creating Subagents following Cursor's best practices.

## hotspot-scanner (this repository)

When creating a subagent **in this repository**, read [references/vitals-arch-patterns.md](references/vitals-arch-patterns.md) **before** writing the file under `.cursor/agents/`. That guide has the reuse-vs-create matrix, hotspot-scanner template, and post-creation checklist (**AGENTS.md** inventory).

For workflows **without** isolated context, prefer a **skill** under `.cursor/skills/<name>/SKILL.md` instead of this skill.

Load the generic Cursor patterns below only as needed; prefer the repo-specific reference for naming, boundaries, and inventory updates.

## When to Use This Skill

Use this skill when the user asks to:

- Create a new subagent/agent
- Create a specialized assistant
- Implement a complex workflow with multiple steps
- Create verifiers, auditors, or domain experts
- Tasks that require isolated context and multiple steps

**DO NOT use for simple, one-off tasks** — for those, use skills.

## What are Subagents?

Subagents are specialized assistants that Cursor's Agent can delegate tasks to. Characteristics:

- **Isolated context**: Each subagent has its own context window
- **Parallel execution**: Multiple subagents can run simultaneously
- **Specialization**: Configured with specific prompts and expertise
- **Reusable**: Defined once, used in multiple contexts

### Foreground vs Background

| Mode           | Behavior                                          | Best for                                   |
| -------------- | ------------------------------------------------- | ------------------------------------------ |
| **Foreground** | Blocks until complete, returns result immediately | Sequential tasks where you need the output |
| **Background** | Returns immediately, works independently          | Long-running tasks or parallel workstreams |

## Subagent Structure

A subagent is a markdown file in `.cursor/agents/` (project) or `~/.cursor/agents/` (user).

### File Format

```markdown
---
name: agent-name
description: Description of when to use this subagent. The Agent reads this to decide delegation.
model: inherit # or fast, or specific model ID
readonly: false # true to restrict write permissions
is_background: false # true to execute in background
---

You are an [expert in X].

When invoked:

1. [Step 1]
2. [Step 2]
3. [Step 3]

[Detailed instructions about expected behavior]

Report [type of expected result]:

- [Output format]
- [Metrics or specific information]
```

## Creation process (summary)

1. **Define purpose** — specific responsibility; why isolated context is required.
2. **Write frontmatter** — `name`, trigger-rich `description`, `model`, `readonly` as needed.
3. **Write body** — When to invoke / Do NOT invoke, Before you act, Hard constraints, report format.
4. **For this repo** — follow [vitals-arch-patterns.md](references/vitals-arch-patterns.md); update AGENTS.md inventory.
5. **Prefer reuse** — do not duplicate planner / orchestrator / implementer / verifiers / fixture-builder.

## Hard constraints (hotspot-scanner)

- Gate: `pnpm build && pnpm test`
- Requirement IDs: `HOTSPOT-*`
- Do not commit unless the user explicitly asks
- Planning agents end at `tasks.md` Status `Planned` (no Execute in the same session)

## Further reading

- [vitals-arch-patterns.md](references/vitals-arch-patterns.md) — repo template and checklist
- [AGENTS.md](../../../AGENTS.md) — inventory of skills and agents
- Cursor docs on subagents for editor-specific frontmatter fields beyond this summary
