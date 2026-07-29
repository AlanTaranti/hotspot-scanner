# Planning Session Boundary

**Applies to:** `planner-feature`, the **main agent** during planning, and any agent invoked for spec/design/tasks creation.

**Goal:** Planning sessions end at **Tasks** with `tasks.md` in Status `Planned`. Implementation happens in a **separate development session**.

**See also:** [tasks.md](tasks.md) § Status, [feature-spec-checklist.md](feature-spec-checklist.md), [feature-planning.mdc](../../../rules/feature-planning.mdc).

---

## Session model

| Session         | Agents / skills                                                | Ends when                                         |
| --------------- | -------------------------------------------------------------- | ------------------------------------------------- |
| **Planning**    | `planner-feature`, main agent + `vitals-spec-driven`           | `tasks.md` **Status: Planned**; handoff delivered |
| **Development** | User promotes Status → `orchestrator-implementer`              | Gates pass; tasks marked Complete; ROADMAP synced |

The product lifecycle includes Execute — but **not in the same session** as planning.

**Main agent:** While any active feature `tasks.md` is `Draft` or `Planned`, do **not** start Execute, edit application code under `src/`/`bin/`/`tests/`, or invoke `orchestrator-implementer`. Quick mode (≤3 files) is the only in-session implementation exception — see [quick-mode.md](quick-mode.md).

---

## In scope (planning agents)

- Specify → Design → Tasks per auto-sizing in [SKILL.md](../SKILL.md)
- Artifacts under `.specs/features/<slug>/` (`spec.md`, `design.md`, `tasks.md`, `context.md`)
- Sync [ROADMAP.md](../../../../.specs/project/ROADMAP.md) — feature listed under current milestone
- Recommend module owner per task in `tasks.md` (for future dev — not to invoke now)

---

## Prohibited (planning agents **and** main agent in a planning session)

- Edit `src/`, `bin/`, `tests/` implementation files (paths may appear in task definitions as _targets_, not as edits) — except [quick-mode.md](quick-mode.md)
- Invoke `orchestrator-implementer` or run Execute while Status is `Draft` / `Planned`
- Run project gate (`pnpm verify`) except to validate planning assumptions when explicitly asked
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
Expected final gate: pnpm verify
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
