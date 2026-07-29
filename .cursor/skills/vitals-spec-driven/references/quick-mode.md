# Quick Mode

**Only exception** where the planning skill may implement code: ≤3 files / one-sentence scope, **in-session**. It is **not** formal Specify→Tasks→Execute. Medium+ or growing scope → stop, create `tasks.md`, hand off to an Execute session (`orchestrator-implementer` + `vitals-execute`). See [planning-session-boundary.md](planning-session-boundary.md).

**Goal:** Small ad-hoc tasks with the same quality principles but without full pipeline ceremony.

**Trigger:** "Quick fix", "Quick task", "Small change", "Bug fix", "Just do X"

## When to Use

| Use quick mode             | Use full pipeline                   |
| -------------------------- | ----------------------------------- |
| Bug fixes with known cause | New features with multiple stories  |
| Config / docs tweaks       | Architectural changes               |
| One-off script / small fix | Features requiring design decisions |
| Dependency bump (trivial)  | Multi-component features            |
| ≤3 files, one sentence     | Anything with unclear scope         |

**Rule of thumb:** If you can describe it in one sentence AND it touches ≤3 files, it's a quick task.

## Process

### 1. Describe the Task

User provides a clear, one-sentence description. If vague, ask for specifics.

### 2. Pre-Implementation Check

Before writing code, state:

```
Quick Task: [description]
Files: [list ONLY files to touch]
Approach: [one sentence]
Verify: [how to prove it works]
```

Get user approval before proceeding. If bigger than expected → full pipeline + Execute session.

### 3. Implement

Follow [coding-guidelines/SKILL.md](../../coding-guidelines/SKILL.md):

- Simplest code that works
- Touch ONLY listed files
- No scope creep

### 4. Verify

Run verification from step 2. Mark done only after verification passes.

**Gate:** `pnpm verify` ([quality-gates.mdc](../../../rules/quality-gates.mdc))

### 5. Commit (on request)

Do not commit unless the user explicitly asks. Propose a Conventional Commit message after verification.

### 6. Track

Record the task in `.specs/quick/NNN-slug/TASK.md`. Touch [STATE.md](../../../../.specs/project/STATE.md) **only** if the task produced a lasting lock, blocker, lesson, or deferred item ([state-management.md](state-management.md) + [state-sot.mdc](../../../rules/state-sot.mdc)).

---

## Structure

```
.specs/quick/NNN-slug/
├── TASK.md
└── SUMMARY.md
```

**TASK.md:** title, status, one-sentence description, files changed, verification checklist, commit when present.

---

## Guardrails

- **Max 3 files** — else full pipeline + Execute handoff
- **No design decisions** — choosing approaches → Specify/Design
- **No new dependencies** without full pipeline review
- **Quick ≠ sloppy** — same coding guidelines
- **Compounding quick tasks** in one area → plan a feature
