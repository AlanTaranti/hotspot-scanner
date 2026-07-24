---
name: task-implementer
description: Execute a single task from hotspot-scanner tasks.md — orchestrated (orchestrator-implementer) or direct mode. RED→GREEN→VERIFY per task Gate. Use when implementing one Tn from tasks.md. Do NOT use for planning, orchestration, or acceptance/gate verification.
---

# Task Implementer

**Companion to the `implementer` agent** — same workflow; this skill is the procedure reference included in orchestrator minimum prompts.

Execute **one** `tasks.md` task at a time. Workflow detail lives in linked references — do not improvise steps here.

## Mode detection

| Prompt signal        | Follow                                                                                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orchestrated: true` | [orchestrated-implementer.md](../vitals-spec-driven/references/orchestrated-implementer.md) — default when delegated by `orchestrator-implementer`                                           |
| otherwise            | [implement.md](../vitals-spec-driven/references/implement.md) direct mode — may update `tasks.md`; on Status `Done` sync [roadmap-sync.md](../vitals-spec-driven/references/roadmap-sync.md) |

## Always read before coding

1. `coding-guidelines` skill
2. [AGENTS.md](../../../AGENTS.md) + [vitals-project.md](../vitals-spec-driven/references/vitals-project.md)
3. `.specs/codebase/CONVENTIONS.md`, `TESTING.md` — and `CONCERNS.md` when the task touches fragile areas
4. When the task touches `src/git/`, `src/complexity/`, `src/scoring/`, `src/report/`, or `src/scan.ts` → read [vitals-pipeline-domain](../vitals-pipeline-domain/SKILL.md)
5. Only the spec/design/context paths supplied in the prompt (not sibling tasks)

## Implementation cycle

Follow the active mode reference:

- **Orchestrated:** scope, VERIFY, prohibited actions, and return format → [orchestrated-implementer.md](../vitals-spec-driven/references/orchestrated-implementer.md)
- **Direct:** RED → GREEN → VERIFY, propose commit on request, `tasks.md` updates → [implement.md](../vitals-spec-driven/references/implement.md)

## Blocked

Use [implementer-routing.md](../vitals-spec-driven/references/implementer-routing.md) § Blocked. Report **Blocked** with reason — do not partially implement out-of-scope work.

## Return format

Structured return to parent → [orchestrated-implementer.md](../vitals-spec-driven/references/orchestrated-implementer.md) § Structured return.
