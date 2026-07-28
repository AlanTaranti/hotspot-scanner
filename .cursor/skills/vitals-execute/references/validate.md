# Execute: Validate & Verify

**Goal:** Verify implementation meets `spec.md` / `tasks.md`. Used by `verifier-implementation` (Phase D).

**No interactive UI UAT** for this CLI/library project — automated checks and CLI validation only.

**Trigger:** "Validate", "verify work", "acceptance check", post-Execute Phase D.

**Out of scope for this agent:**

- Full project gate `pnpm build && pnpm test` → Phase E / `verifier-quality-gates`
- Style / maintainability review → Phase C / `code-reviewer` + [coding-guidelines](../../coding-guidelines/SKILL.md)

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

### 4. Per-task Gate evidence (not the project gate)

**Do not** run the full project gate here — that is Phase E / [`verifier-quality-gates`](../../../agents/verifier-quality-gates.md).

Audit evidence that each claimed-Complete task met its **task Gate** / Verify steps:

1. Confirm co-located or listed tests exist for touched modules.
2. Confirm implementer (or task notes) recorded Gate pass for that task when the task defines a Gate.
3. Flag missing evidence as ISSUES or NOT_READY — do not invent a green project gate.

**Direct mode** (no orchestrator): still do not run the project gate in this checklist; the caller or `verifier-quality-gates` owns `pnpm build && pnpm test`.

**Test integrity:**

- If test count decreased vs pre-feature: investigate
- If assertions were weakened: flag as potential regression

### 5. Residual quality (do not re-do Phase C)

Style and YAGNI belong to Phase C (`code-reviewer`) and [coding-guidelines](../../coding-guidelines/SKILL.md).

In Phase D: flag only **obvious residual** violations that block acceptance (e.g. clearly unrelated files changed with no task link). Do not re-run a full code-quality checklist.

### 6. CLI validation

> **Canonical workflow:** [vitals-cli-validation](../../vitals-cli-validation/SKILL.md). Flag encyclopedia / exit codes: [docs/cli-reference.md](../../../../docs/cli-reference.md).

When `bin/`, scan wiring, or fixtures changed:

- [ ] Targeted CLI / fixture checks per vitals-cli-validation (not a substitute for Phase E)
- [ ] `pnpm exec hotspot-scanner scan tests/fixtures/repos/<repo>` exits 0 when repo fixtures changed
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

Use the template below. Verdicts: **READY** | **ISSUES** | **NOT_READY**.

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

## Residual quality

Phase C owns style review. Note only obvious residual blockers (or N/A).

---

## Edge Cases

- [ ] Edge case 1: …
- [ ] Edge case 2: …

---

## Per-task Gate evidence / CLI

- **Task Gate evidence**: [summary — not project gate]
- **CLI checks**: [summary or N/A]
- **Project gate**: deferred to Phase E / verifier-quality-gates
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
- Do not run or claim the full project gate in Phase D
- Update requirement traceability in `spec.md` when statuses change
