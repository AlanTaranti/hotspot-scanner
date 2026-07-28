# Execute: Quality Gate Report

**Goal:** Run the project gate and report results. Used by `verifier-quality-gates` (Phase E).

**Trigger:** "run quality gates", "mark done", pre-commit / pre-PR, post-Execute Phase E.

**Gate definitions SoT:** [TESTING.md](../../../../.specs/codebase/TESTING.md) § Gate check commands + § Coverage. Rule: [quality-gates.mdc](../../../rules/quality-gates.mdc). Do not restate coverage thresholds here.

---

## Commands

```bash
pnpm build && pnpm test
```

**Conditional supplemental lint** — run `pnpm lint` **only** when the change touches `bin/` or ESLint config (`eslint.config.*` / lint scripts). Skip otherwise and mark the lint row `SKIPPED`. See TESTING.md § Gate check commands.

`pnpm build` writes `dist/`; that is expected and is not a source edit. Do not fix source code here — return failures to the parent / `implementer` for remediation, then re-run when asked.

---

## Quality Gate Report Template

```markdown
## Scope

- Gate: pnpm build && pnpm test
- Lint applicable: [yes — bin/ or ESLint config touched | no]
- Files/areas touched: [summary]

## Results

| Step | Command | Status | Notes |
| ---- | ------- | ------ | ----- |
| 1 | pnpm build | PASS/FAIL | writes dist/ |
| 2 | pnpm test | PASS/FAIL | see TESTING.md § Coverage |
| 3 | pnpm lint | PASS/FAIL/SKIPPED | conditional — bin/ or ESLint config only |

## Failures (if any)

### [Command name]

- File:line — message
- Suggested fix: [brief — for implementer]

## Verdict

- [ ] Ready for Done (all applicable steps PASS)
- [ ] Blocked — N gate failures
```

---

## Tips

- Never mark Done with unresolved gate failures
- Report only — do not edit `src/`, `bin/`, tests, or schemas
- `pnpm hooks:smoke` is out-of-band (Cursor hooks), not part of this gate
