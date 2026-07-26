# Orchestrated Implementer Contract

**Used by:** `implementer` subagent.

**Applies when:** invoked by `orchestrator-implementer` with `orchestrated: true` in the prompt.

**Routing:** [implementer-routing.md](implementer-routing.md) — canonical; do not duplicate tables inline.

---

## Scope

1. Implement **one task only** — do not read or execute sibling tasks.
2. Follow [implement.md](implement.md) RED → GREEN → VERIFY for the provided task definition.
3. Read only context paths supplied in the prompt (`design.md`, `spec.md`, `context.md` as needed).

---

## VERIFY (mandatory before Complete)

1. Run the task's **Verify** or **Gate** command from `tasks.md` (see TESTING.md if ambiguous).
2. Non-zero exit = **do not** report Complete — fix and re-run, or report **Blocked** / **Partial** with error output.
3. Record: command run, PASS/FAIL, test counts when available.

**Orchestrator-owned gate:** do **not** run project-wide `pnpm build && pnpm test` unless that exact command is the task's Verify/Gate field.

---

## Prohibited

- `git add` / `git commit` / `git push` unless the user explicitly asked in this session.
- Edit `tasks.md` checkboxes, feature **Status**, or `ROADMAP.md` — the orchestrator updates these.
- Pick the next task or continue the Execution Plan.
- Scope beyond the single task definition — see [AGENTS.md](../../../../AGENTS.md) § YAGNI.

---

## Blocked

Use [implementer-routing.md](implementer-routing.md) § Blocked.

Report **Blocked** with reason — do not partially implement out-of-scope work.

---

## Structured return (to orchestrator)

```
Status: Complete | Blocked | Partial

Files changed:
- [list]

Gate result:
- Command: [exact Verify/Gate command]
- Result: PASS | FAIL
- Details: [counts, errors if FAIL]

SPEC_DEVIATION: [none | list with reason]

Blockers:
- [if any]
```

---

## Direct invocation (no `orchestrated: true`)

- May update `tasks.md` per [implement.md](implement.md) Step 9.
- On Status `Done`: sync [ROADMAP.md](../../../../.specs/project/ROADMAP.md) per [roadmap-sync.md](roadmap-sync.md).
- Run `pnpm build && pnpm test` before marking Done (or task-specific Gate if narrower).
- Recommend `verifier-implementation` before final Done on large features.
