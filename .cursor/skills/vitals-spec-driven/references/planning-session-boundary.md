# Planning Session Boundary

**Applies to:** `planner-feature` and any agent invoked for spec/design/tasks creation.

**Goal:** Planning sessions end at **Tasks** with `tasks.md` in Status `Planned`. Implementation happens in a **separate development session**.

**See also:** [tasks.md](tasks.md) § Status, [feature-spec-checklist.md](feature-spec-checklist.md).

---

## Session model

| Session         | Agents / skills                                                | Ends when                                         |
| --------------- | -------------------------------------------------------------- | ------------------------------------------------- |
| **Planning**    | `planner-feature`, `vitals-spec-driven` (Specify/Design/Tasks) | `tasks.md` **Status: Planned**; handoff delivered |
| **Development** | User promotes Status → `orchestrator-implementer`              | Gates pass; tasks marked Complete; ROADMAP synced |

The product lifecycle includes Execute — but **not in the same session** as planning agents.

---

## In scope (planning agents)

- Specify → Design → Tasks per auto-sizing in [SKILL.md](../SKILL.md)
- Artifacts under `.specs/features/<slug>/` (`spec.md`, `design.md`, `tasks.md`, `context.md`)
- Sync [ROADMAP.md](../../../../.specs/project/ROADMAP.md) — feature listed under current milestone
- Recommend module owner per task in `tasks.md` (for future dev — not to invoke now)

---

## Prohibited (planning agents)

- Edit `src/`, `bin/`, `tests/` implementation files (paths may appear in task definitions as _targets_, not as edits)
- Invoke `orchestrator-implementer` or run Execute
- Run project gate (`pnpm build && pnpm test`) except to validate planning assumptions when explicitly asked
- Set `tasks.md` Status to `Done` or `In Progress`

---

## Handoff to development session

When planning completes:

1. `tasks.md` Status = **`Planned`**
2. User reviews artifacts and promotes Status to `Approved` or `Ready for Execute`
3. **New session** → invoke `orchestrator-implementer`

**Handoff message template:**

```
Planning complete for [feature-slug].

Artifacts: spec.md [, design.md] [, context.md], tasks.md (Status: Planned)
Next step: review tasks.md, promote Status, open a dev session, and invoke orchestrator-implementer.
Expected final gate: pnpm build && pnpm test
```

---

## Status transitions

| Status                           | Who sets           | Meaning                                                |
| -------------------------------- | ------------------ | ------------------------------------------------------ |
| `Draft`                          | planner            | Incomplete spec/tasks                                  |
| `Planned`                        | planner            | Ready for user review — **planning session ends here** |
| `Approved` / `Ready for Execute` | user or main agent | OK to start orchestrator                               |
| `In Progress`                    | orchestrator       | Execute started                                        |
| `Done`                           | orchestrator       | All tasks complete + gates pass                        |
