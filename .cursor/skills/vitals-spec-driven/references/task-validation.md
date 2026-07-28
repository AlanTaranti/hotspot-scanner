# Task Validation (pre-approval gates)

**Canonical** pre-approval checks before presenting `tasks.md` to the user. Loaded with [tasks.md](tasks.md) during the Tasks phase.

Before showing tasks, run **all** checks below. Any ❌ → restructure and re-run — do not present failing tasks for approval.

Also run **Check 5: Path Conflict** via [implementer-routing.md](../../vitals-common/references/implementer-routing.md) — one task = one module owner when possible.

---

## Check 1: Task Granularity

| Task                            | Scope         | Status       |
| ------------------------------- | ------------- | ------------ |
| T1: Create email input          | 1 component   | ✅ Granular  |
| T2: Add validation function     | 1 function    | ✅ Granular  |
| T3: Create form with all fields | 5+ components | ❌ Split it! |

**Rules:**

- ✅ 1 component / 1 function / 1 endpoint / 1 focused file change = Good
- ⚠️ 2-3 related things in same file = OK if cohesive
- ❌ Multiple components or files = MUST split

For this CLI: prefer one module owner path prefix per task ([implementer-routing.md](../../vitals-common/references/implementer-routing.md)).

---

## Check 2: Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows              | Status                  |
| ---- | ---------------------- | -------------------------- | ----------------------- |
| T[N] | [deps from body]       | [deps from diagram arrows] | ✅ Match or ❌ Mismatch |

**Rules:**

- Every `Depends on` in a task body must have a corresponding arrow in the diagram.
- Every arrow in the diagram must correspond to a `Depends on` in the target task's body.
- Tasks shown as parallel (`[P]`) must not depend on each other.
- If a task depends on another in the same parallel phase, they are NOT parallel — fix the diagram or remove `[P]`.

Include the cross-check table in the planner output.

---

## Check 3: Test Co-location Validation

SoT: [TESTING.md](../../../../.specs/codebase/TESTING.md). Every task that creates/modifies a code layer with a required test type MUST include those tests in the same task.

| Task         | Code Layer Created/Modified  | Matrix Requires | Task Says            | Status                |
| ------------ | ---------------------------- | --------------- | -------------------- | --------------------- |
| T[N]: [name] | [layer from coverage matrix] | [test type]     | [task's Tests field] | ✅ OK or ❌ VIOLATION |

**Rules:**

- "Tested in another task" is NOT valid for `Tests: none`.
- `Tests: none` only when the coverage matrix says none for that layer.
- Multiple layers → use the highest required test type.
- Any ❌ → restructure before presenting.

**Compilation dependencies:** Prefer merge forward/backward so no task produces unverified code — do not defer tests to a separate task.

---

## Check 5: Path Conflict

Build a Path Conflict table from each task's `Where` against [implementer-routing.md](../../vitals-common/references/implementer-routing.md). Serialize shared wiring (`src/scan.ts`, `bin/hotspot-scanner.ts`, schemas).

---

## Task Verification Standards

Every task MUST include:

**Done when:** specific testable outcomes, pass/fail criteria, gate command, expected pass count when relevant.

**Verify:** commands to prove functionality + expected outputs.

```markdown
### T1: [Task name]

**What:** [Deliverable]
**Where:** [File path]
**Tests**: [unit/e2e/integration/none]
**Gate**: [quick/full/build]

**Done when:**

- [ ] [Specific outcome]
- [ ] Gate check passes: `[command]`
- [ ] Test count: [N] tests pass (no silent deletions)

**Verify:**
[Command]
[Expected behavior]
```

**Quality check:** Can verification be automated without human judgment? Is success binary?
