# Project Initialization

**Trigger:** "Initialize project", "Setup project", "Start new project"

`@taranti/hotspot-scanner` is already initialized — [PROJECT.md](../../../../.specs/project/PROJECT.md) exists. Treat this trigger as a **refresh** request, and confirm with the user before editing.

## Refresh procedure

1. Read the current [PROJECT.md](../../../../.specs/project/PROJECT.md). It is the shape to follow — never impose a generic template (no Framework / Database sections; this is a Node CLI).
2. Ask only for what is missing or stale — vision, users and problem, capability scope vs out of scope, constraints. 3-5 questions per message; stop when the boundaries are clear.
3. Edit in place under the editorial contract [project-sot.mdc](../../../rules/project-sot.mdc): present-tense product surface, goals, constraints, high-level JSON contract versions. Milestones → [ROADMAP.md](../../../../.specs/project/ROADMAP.md) per [roadmap-sync.md](../../vitals-common/references/roadmap-sync.md); decisions, blockers, deferred items → [STATE.md](../../../../.specs/project/STATE.md) per [state-management.md](state-management.md).

**Validation:** vision readable in 1-2 sentences · goals measurable · scope boundaries explicit · no milestone or changelog voice · no exhaustive flag lists (those live in [docs/cli-reference.md](../../../../docs/cli-reference.md)).
