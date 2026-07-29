# Execute: Code Review Report

**Goal:** Report conventions / maintainability findings for changed code. Used by `code-reviewer` (Phase C).

**Trigger:** "Review my changes", "code review", post-Execute Phase C.

**Out of scope for this agent:**

- Spec acceptance → Phase D / [validate.md](validate.md) + `verifier-implementation`
- Full project gate `pnpm verify` → Phase E / [quality-gates-report.md](quality-gates-report.md) + `verifier-quality-gates`

---

## Review inputs

Apply [CONVENTIONS.md](../../../../.specs/codebase/CONVENTIONS.md), [INTEGRATIONS.md](../../../../.specs/codebase/INTEGRATIONS.md) (mock / adapter boundaries), [coding-guidelines](../../coding-guidelines/SKILL.md), and [CONCERNS.md](../../../../.specs/codebase/CONCERNS.md) / [fragile-areas.mdc](../../../rules/fragile-areas.mdc) for the touched paths. Do not restate those lists in the report — cite them.

---

## Severity and verdict

| Severity | Use for |
| -------- | ------- |
| Blocker | Convention or adapter-boundary violation, fragile module changed without tests |
| Major | Maintainability / YAGNI problem that should be fixed before merge |
| Minor | Style or clarity nit; non-blocking |

**Verdict rules:** Approved = no Blocker/Major; Approved with caveats = Minor only; Changes needed = one or more Blocker/Major.

**Changes needed blocks Phase D** in orchestrated Execute (max 1 remediation round — see [execute-orchestration-playbook.md](execute-orchestration-playbook.md) § Phase C).

---

## Code Review Report Template

```markdown
## Summary

- Scope: [files/areas reviewed]
- Verdict: [Approved | Approved with caveats | Changes needed]

## Positive points

- [Well-implemented aspects]

## Issues found

| Severity | Location | Issue | Suggestion |
| -------- | -------- | ----- | ---------- |
| Blocker | path:line | … | … |
| Major | path:line | … | … |
| Minor | path:line | … | … |

## Improvement suggestions (optional)

- [Non-blocking recommendations]

## Next steps

- [ ] Proceed to verifier-implementation (Phase D) if not yet run
- [ ] Remediate Blocker/Major issues before merge
```

---

## Tips

- Cite `file:line` for every issue — no vague findings
- Report only; never modify source, tests, or docs
- Do not run the project gate unless explicitly asked to triage a failure
