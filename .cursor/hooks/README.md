# Cursor hooks — hotspot-scanner

Project hooks em [`.cursor/hooks.json`](../hooks.json) reforçam políticas de [AGENTS.md](../../AGENTS.md), rules e subagents.

Estado de sessão (gitignored): `.cursor/hooks-state/<conversation_id>.json`

## Mapa rápido

| Prioridade | Evento | Script | Comportamento |
|------------|--------|--------|---------------|
| Crítico | `beforeShellExecution` | `commit-policy.mjs` | `git commit` negado sem keyword do usuário (`commit`, `commite`, `comitar`, `versionar`) |
| Crítico | `beforeShellExecution` | `gate-before-commit.mjs` | `git commit` negado se código mudou sem gate recente |
| Crítico | `afterShellExecution` | `record-gate-pass.mjs` | `gatePassedAt` / `buildPassedAt` + `testPassedAt` após build e test |
| Crítico | `subagentStop` | `subagent-stop.mjs` | Limpa estado do subagent; follow-up Phase E (quality gate) |
| Alto | `subagentStart` | `subagent-start.mjs` | Estado subagent; bloqueio orchestrator se Status Draft/Planned |
| Alto | `preToolUse` | `pre-edit-guard.mjs` | Planner boundary; fragile `ask`; ownership orquestrado |
| Alto | `postToolUse` | `post-edit-guard.mjs` | Rastreia edições + alertas áreas frágeis / scoring |
| Alto | `afterFileEdit` | `track-edit.mjs` | Rastreio de paths (fallback) |
| Alto | `stop` | `stop-gate-reminder.mjs` | Lembrete de gate ao encerrar agente |
| Médio | `sessionStart` | `session-context.mjs` | Injeta contexto ROADMAP + gate |
| Médio | `beforeShellExecution` | `shell-guards.mjs` | Valida path em `hotspot-scanner scan` |
| Médio | `afterShellExecution` | `shell-guards.mjs` | Contexto em falha de `pnpm test` |
| Médio | `preCompact` | `pre-compact.mjs` | Checkpoint em `.specs/.hooks-checkpoint.json` |

## Limitações conhecidas

- `sessionStart` / `postToolUse` `additional_context` pode não chegar ao modelo em algumas versões do Cursor. Enforcement principal: `preToolUse` (`deny`/`ask`) e `beforeShellExecution`.
- Rastreio de edições ocorre em `postToolUse` (Write/StrReplace) e `afterFileEdit` (fallback).
- Gate aceita `pnpm build && pnpm test` em um comando **ou** `pnpm build` e `pnpm test` separados (ambos com exit 0).

## Smoke tests

```bash
node .cursor/hooks/smoke-test.mjs
```

Requer escrita em `.cursor/hooks-state/` (gitignored).

## Debug

- Painel **Hooks** nas configurações do Cursor
- Canal de output **Hooks**
- Salvar `hooks.json` recarrega hooks; reinicie o Cursor se não disparar
