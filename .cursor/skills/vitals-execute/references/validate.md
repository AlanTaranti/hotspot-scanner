# Execute: Validate & Verify

**Goal:** Verify implementation meets `spec.md` / `tasks.md` and coding guidelines. Used by `verifier-implementation` (Phase D).

**No interactive UI UAT** for this CLI/library project — automated gates and CLI checks only.

**Trigger:** "Validate", "verify work", "acceptance check", post-Execute Phase D.

---

## Process

### 1. Check completed tasks

Go through `tasks.md`:

- [ ] All claimed tasks marked done?
- [ ] Any blocked or partial?

### 2. Verify acceptance criteria

For each user story in `spec.md`:

```markdown
### P1: [Story Title]

**Acceptance Criteria**:

1. WHEN [X] THEN [Y] → [PASS/FAIL]
2. WHEN [X] THEN [Y] → [PASS/FAIL]
```

### 3. Check edge cases

From `spec.md` edge cases:

- [ ] [Edge case 1] handled correctly
- [ ] [Edge case 2] handled correctly

### 4. Run build-level gate check (mandatory)

Project gate: [quality-gates.mdc](../../../rules/quality-gates.mdc) + TESTING.md § Coverage.

1. Run: `pnpm build && pnpm test` (or the task's narrower Gate when Phase D is scoped to a single task)
2. Non-zero exit → STOP. Do not mark READY.
3. Record: passed / failed / skipped (each skip justified)

**Test integrity:**

- If test count decreased vs pre-feature: investigate
- If assertions were weakened: flag as potential regression

### 5. Code quality check (mandatory)

Against [coding-guidelines](../../coding-guidelines/SKILL.md):

| Check                                | Pass? |
| ------------------------------------ | ----- |
| No features beyond what was asked    |       |
| No abstractions for single-use code  |       |
| No unnecessary "flexibility" added   |       |
| Only touched files required for task |       |
| Didn't "improve" unrelated code      |       |
| Matches existing patterns/style      |       |
| Would senior engineer approve?       |       |

Any "No"? → Fix before marking complete (or verdict NOT_READY / ISSUES).

### 6. CLI validation

> **Canonical workflow:** [vitals-cli-validation](../../vitals-cli-validation/SKILL.md). Flag encyclopedia / exit codes: [docs/cli-reference.md](../../../../docs/cli-reference.md).

When `bin/`, scan wiring, or fixtures changed:

- [ ] `pnpm build && pnpm test` passes
- [ ] `pnpm exec hotspot-scanner scan tests/fixtures/repos/<repo>` exits 0
- [ ] `--format json` produces valid JSON with `version`, `hotspots`, `meta` (no `coupling` / `functions` / `cyclomaticComplexity`)
- [ ] Exit codes match cli-reference SoT
- [ ] New/changed behavior covered by co-located `*.test.ts`

### 7. Generate fix plans (if issues found)

For each issue:

1. Diagnose root cause
2. Create a fix task (What / Where / Verify / Done when)
3. Present for orchestrator remediation (max 1 round in Execute playbook)

**Guardrail:** Maximum 3 diagnostic iterations per issue; then flag for human investigation.

### 8. Report

Use the template below. Verdicts for this agent: **READY** | **ISSUES** | **NOT_READY**.

---

## Validation Report Template

```markdown
# [Feature] Validation

**Date**: [YYYY-MM-DD]
**Spec**: `.specs/features/[feature]/spec.md`

---

## Task Completion

| Task | Status     | Notes   |
| ---- | ---------- | ------- |
| T1   | Done       | -       |
| T2   | Partial    | [Issue] |

---

## User Story Validation

### P1: [Story Title] (MVP)

| Criterion     | Result  |
| ------------- | ------- |
| WHEN X THEN Y | PASS    |

**Status**: P1 Complete | Issues | Not Ready

---

## Code Quality

| Principle        | Status |
| ---------------- | ------ |
| Minimum code     |        |
| Surgical changes |        |
| No scope creep   |        |
| Matches patterns |        |

---

## Edge Cases

- [ ] Edge case 1: …
- [ ] Edge case 2: …

---

## Tests / CLI

- **Gate**: `pnpm build && pnpm test` — [PASS/FAIL]
- **CLI checks**: [summary or N/A]
- **Failures**: [list]

---

## Summary

**Overall**: READY | ISSUES | NOT_READY

**What works**: …
**Issues found**: …
**Next steps**: …
```

---

## Tips

- P1/MVP must pass before READY
- WHEN/THEN criteria are the acceptance tests
- Recommend fixes — do not only list problems
- Quality check is mandatory
- Update requirement traceability in `spec.md` when statuses change
