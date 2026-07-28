---
name: vitals-execute
description: Execute orchestration for approved hotspot-scanner tasks.md. Use with orchestrator-implementer. Triggers on "execute tasks", "orchestrate T1–Tn", "implement milestone tasks". Do NOT use for planning (vitals-spec-driven) or single-task coding (task-implementer / implementer).
---

# Vitals Execute

Orchestrate approved `tasks.md` (phases A→F). Companion skill for the `orchestrator-implementer` agent.

**Do not** Specify/Design/Tasks here — that is `vitals-spec-driven` / `planner-feature`.  
**Do not** implement application code here — delegate Phase B to `implementer` via `task-implementer`.

## Progressive disclosure

| Need | Load |
| ---- | ---- |
| Orchestration A→F | [execute-orchestration-playbook.md](references/execute-orchestration-playbook.md) |
| Phase C code review template | [review.md](references/review.md) (agent: `code-reviewer`) |
| Phase D acceptance checklist | [validate.md](references/validate.md) (agent: `verifier-implementation`) |
| Phase E gate report template | [quality-gates-report.md](references/quality-gates-report.md) (agent: `verifier-quality-gates`) |
| Single-task RED→GREEN→VERIFY | skill [`task-implementer`](../task-implementer/SKILL.md) |
| Project overlay / routing / ROADMAP sync | skill [`vitals-common`](../vitals-common/SKILL.md) |

## Handoff from planning

1. User promotes `tasks.md` Status out of `Draft` / `Planned`.
2. New session invokes `orchestrator-implementer` with this skill + playbook.
3. See [planning-session-boundary.md](../vitals-spec-driven/references/planning-session-boundary.md).

Index: [AGENTS.md](../../../AGENTS.md).
