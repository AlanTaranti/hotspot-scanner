# Execute

**Goal**: Implement ONE task at a time. Surgical changes. Verify. Propose commit on request. Repeat.

This is where code gets written. Every task follows the same cycle: plan → implement → verify → (commit when requested). Verification is built into every task, not a separate phase.

---

## MANDATORY: Before Starting Any Implementation

**Read [coding-guidelines/SKILL.md](../../coding-guidelines/SKILL.md) and state:**

1. **Assumptions** - What am I assuming? Any uncertainty?
2. **Files to touch** - List ONLY files this task requires
3. **Success criteria** - How will I verify this works?

⚠️ **Do not proceed without stating these explicitly.**

---

## Process

The steps below apply identically in the main context and in an `implementer` sub-agent; the only difference is that a sub-agent reports back to the orchestrator instead of continuing to the next task ([orchestrated-implementer.md](orchestrated-implementer.md)).

### 0. No `tasks.md`? Stop here

This reference implements a planned task. Without a `tasks.md` task, ad-hoc scope belongs to planning: ≤3 files / one sentence → [quick-mode.md](../../vitals-spec-driven/references/quick-mode.md); anything larger → plan first via [vitals-spec-driven](../../vitals-spec-driven/SKILL.md).

### 1. Pick Task

From `tasks.md` — the user names it ("implement T3") or you suggest the next available task.

### 2. Verify Dependencies

Check the task's `Depends on` field against completed tasks.

❌ If blocked: "T3 depends on T2 which isn't done. Should I do T2 first?"

### 3. State Implementation Plan

Before writing code:

```
Files: [list]
Approach: [brief description]
Success: [how to verify]
```

### 4. Write Tests First (RED)

If the task includes tests (per the Tests field in tasks.md or TESTING.md coverage matrix):

1. Write the test file(s) BEFORE writing any implementation
2. Tests must encode the expected behavior from the task's "Done when" criteria
3. Run the test command — confirm tests FAIL (RED state)
4. If tests pass before implementation exists, the tests are too weak — rewrite them

**Constraints:**

- Tests define correct behavior independently of implementation
- Each acceptance criterion from "Done when" maps to at least one test assertion
- Edge cases from spec.md that apply to this task get test cases too

If the task does NOT include tests (e.g., entity-only, config-only), skip to Step 4b.

### 4b. Implement (GREEN)

Write the minimum implementation needed to satisfy the task's success criteria: pass all relevant tests (when present) and meet the defined verification/gate checks when there are no direct tests.

**Test integrity:** [coding-guidelines](../../coding-guidelines/SKILL.md) § 5 Test Integrity applies verbatim to the tests from Step 4 — no modifying, weakening, deleting, or skipping them; genuinely wrong test → STOP and ask the user.

Minimum code to pass; structural improvements belong to a refactor task. Touch only the listed files — no scope creep ([coding-guidelines](../../coding-guidelines/SKILL.md) §§ 2-3).

### 5. Gate Check (VERIFY)

Run the `Gate` command written in the task definition. This is MANDATORY — not "if applicable."

1. Run the task's `Gate` command verbatim (usually a targeted `pnpm exec vitest run <path>`)
2. Non-zero exit code = STOP. Fix the failure. Re-run. Do not proceed until green.
3. Confirm the test count matches expectations (no tests were silently deleted or skipped)

There are **no** Quick / Full / Build gate levels — this project has one product gate, `pnpm build && pnpm test` ([quality-gates.mdc](../../../rules/quality-gates.mdc), [TESTING.md](../../../../.specs/codebase/TESTING.md) § Quality gate), which the feature's final task runs. Docs-only tasks are review-only. Add `pnpm lint` when the task changes `bin/` or the ESLint config.

The gate is deterministic: the test runner decides whether the code is correct, not the agent's self-assessment.

### 6. Post-Gate Review

After the gate check passes:

1. Verify test count: Are there at least as many test cases as before? (prevents silent deletion)
2. Verify no SPEC_DEVIATION: If implementation diverged from spec/design, add a marker:

```
// SPEC_DEVIATION: [what diverged]
// Reason: [why the deviation was necessary]
```

3. Quick complexity check: "Would senior engineer flag this as overcomplicated?"
   - Yes → Simplify, re-run gate
   - No → Propose commit message (commit only if user asked)

### 7. Git Commit (on request)

Do not commit unless the user explicitly asks — [commit-policy.mdc](../../../rules/commit-policy.mdc) + [agent-hard-constraints.md](../../../agents/references/agent-hard-constraints.md). After verification passes, **propose** a Conventional Commit message. Commit only when requested.

When committing: one task = one commit. Never batch multiple tasks. Include only files listed in the task — no "while I'm here" changes. If tests are part of the task, include them in the same commit.

### 8. Scope Guardrail

During implementation, you will notice things that could be improved, refactored, or added. **Do not act on them.** Instead:

- If it's a bug: note it in STATE.md under `## Blockers` or use quick mode
- If it's an improvement: note it in STATE.md under `## Deferred` (open items only) or `## Lessons`
- If it's related to the current task: only include it if it's in the "Done when" criteria

**The heuristic:** "Is this in my task definition?" If no, don't touch it.

### 9. Update Task Status

Mark task complete in tasks.md. Update requirement traceability in spec.md if requirement IDs are used.

---

## Report shape

```markdown
## Implementing T[X]: [Task Title]

**Dependencies**: [All done | Blocked by TY] · **Tests**: [unit/integration/none] · **Gate**: [command from tasks.md]

- **Pre-implementation**: assumptions · files to touch · success criteria
- **RED**: test file(s), test count, confirmed failing
- **GREEN**: minimum code; tests modified/deleted: none
- **VERIFY**: gate command, result, test count matches RED
- **Post-gate**: SPEC_DEVIATION markers (or none), no extra changes

**Status**: Complete | Blocked | Partial
```

When delegated by the orchestrator, return the structured form in [orchestrated-implementer.md](orchestrated-implementer.md) § Structured return instead.

---

## Tips

- **One task at a time** — Focus prevents errors
- **Stay in your module** — One owner prefix per task ([implementer-routing.md](../../vitals-common/references/implementer-routing.md))
- **Reuses save tokens** — Copy patterns, don't reinvent
- **Propose commit after verify** — Commit only when user asked; one task = one commit when committing
- **Stay surgical** — Touch only what's necessary
- **Never "while I'm here"** — Scope creep during implementation is the #1 quality killer
- **Learn from mistakes** — If something goes wrong, add a Lesson Learned to STATE.md
