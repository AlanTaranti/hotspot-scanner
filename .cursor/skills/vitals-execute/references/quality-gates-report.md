# Execute: Quality Gate Report

**Goal:** Run the project gate and report results. Used by `verifier-quality-gates` (Phase E).

**Trigger:** "run quality gates", "mark done", pre-commit / pre-PR, post-Execute Phase E.

**Gate definitions SoT:** [TESTING.md](../../../../.specs/codebase/TESTING.md) § Gate check commands + § Coverage. Rule: [quality-gates.mdc](../../../rules/quality-gates.mdc). Do not restate coverage thresholds here.

---

## Commands

```bash
pnpm verify
```

Equivalent to `pnpm build && pnpm test && pnpm lint && pnpm format:check` (that order). Matches GitHub Actions jobs `build`, `test`, `lint`, and `format`.

`pnpm build` writes `dist/`; that is expected and is not a source edit. Do not fix source code here — return failures to the parent / `implementer` for remediation, then re-run when asked.

Use `pnpm format` (write) only to fix Prettier failures locally — it is not part of the gate (CI runs `format:check` only).

---

## Quality Gate Report Template

```markdown
## Scope

- Gate: pnpm verify
- Files/areas touched: [summary]

## Results

| Step | Command | Status | Notes |
| ---- | ------- | ------ | ----- |
| 1 | pnpm build | PASS/FAIL | writes dist/; CI job `build` |
| 2 | pnpm test | PASS/FAIL | see TESTING.md § Coverage; CI job `test` |
| 3 | pnpm lint | PASS/FAIL | CI job `lint` |
| 4 | pnpm format:check | PASS/FAIL | CI job `format` |

## Failures (if any)

### [Command name]

- File:line — message
- Suggested fix: [brief — for implementer]

## Verdict

- [ ] Ready for Done (all steps PASS)
- [ ] Blocked — N gate failures
```

---

## Tips

- Never mark Done with unresolved gate failures
- Report only — do not edit `src/`, `bin/`, tests, or schemas
- `pnpm hooks:smoke` is out-of-band (Cursor hooks), not part of this gate
