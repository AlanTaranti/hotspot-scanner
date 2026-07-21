# hotspot-scanner — padrões para subagents

Guia para criar subagents **neste repositório** (`@vitals/hotspot-scanner`).

## Matriz reusar vs criar

| Necessidade | Reusar | Não criar |
| ----------- | ------ | --------- |
| Planejar spec/design/tasks | `planner-feature` | Planner ad hoc |
| Orquestrar Execute | `orchestrator-implementer` | Orchestrator duplicado |
| Implementar uma task | `implementer` | Implementer genérico |
| Code review pós-implementação | `code-reviewer` | Reviewer sem convenções |
| Aceitação vs spec | `verifier-implementation` | Verifier sem critérios |
| Gate `pnpm build && pnpm test` | `verifier-quality-gates` | Script ad hoc |
| Criar fixtures Git/TS | `fixture-builder` | Fixture manual sem README |

## Skill vs subagent (hotspot-scanner)

| Tipo | Quando |
| ---- | ------ |
| **Skill** | Workflow reutilizável invocado pelo agente principal (spec-driven, CLI validation, pipeline domain) |
| **Subagent** | Sessão isolada com papel fixo e frontmatter (planner, implementer, verifiers) |

## Template hotspot-scanner

```markdown
---
name: my-agent
description: [Papel hotspot-scanner]. Use when [triggers específicos]. Do NOT use for [anti-triggers]. See "When to invoke" in the agent body.
model: inherit
readonly: true|false
---

You are the **[Nome legível]** for @vitals/hotspot-scanner — [uma linha: CLI local, pipeline git/complexity/scoring/report].

## When to invoke
...

## Before you act — read these
1. AGENTS.md
2. vitals-project.md
3. TESTING.md / CONCERNS.md (quando relevante)

## Hard constraints
- Gate: pnpm build && pnpm test
- Requirement IDs: HOTSPOT-*
- Não commitar sem pedido explícito do usuário
```

## Rules relevantes

| Rule | Escopo |
| ---- | ------ |
| `quality-gates` | Gate obrigatório |
| `fragile-areas` | git, complexity, scoring |
| `integrations` | ts-morph, git, commander |
| `bin-build` | tsconfig + tsconfig.bin.json |
| `testing-patterns` | Vitest, mock boundaries |

## Checklist pós-criação

- [ ] Frontmatter `description` com triggers e anti-triggers
- [ ] Referência a AGENTS.md e vitals-project.md
- [ ] Sem overlap com agents existentes em `.cursor/agents/`
- [ ] Atualizar AGENTS.md § Skills and agents se agente for permanente
