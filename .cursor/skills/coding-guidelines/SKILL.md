---
name: coding-guidelines
description: Behavioral guidelines to reduce common LLM coding mistakes. Use when writing, modifying, or reviewing code — implementation tasks, code changes, refactoring, bug fixes, or feature development. Do NOT use for architecture design, documentation, or non-code tasks.
metadata:
  author: ale
  version: "1.1.0"
  source: "Karpathy Guidelines"
---

# Coding Guidelines

Behavioral guidelines to reduce common LLM coding mistakes. These principles bias toward caution over speed—for trivial tasks, use judgment.

> **Canonical source:** `.cursor/skills/coding-guidelines/SKILL.md`. The file `vitals-spec-driven/references/coding-principles.md` is a redirect only — do not duplicate rules there.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them—don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.
- Disagree honestly. If the user's approach seems wrong, say so—don't be sycophantic.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it—don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

**The test:** Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Test Integrity

**Tests are the spec — implementation conforms to tests, not the other way around.**

- NEVER weaken an existing test assertion to make it pass
- NEVER delete a test to reduce failure count
- NEVER use the test framework's skip/disable/pending mechanism to bypass a failing test
- NEVER modify tests written in the RED phase during GREEN phase
- If a test is genuinely wrong, STOP and confirm with the user before changing it
- NEVER silence `console.warn` / `console.error` globally to pass gates — use `vi.spyOn` only in specs that assert the warning, or fix the root cause (stub, setup, production code)
- Prefer co-located Vitest (`*.test.ts` beside the module); CLI/fixture validation per [TESTING.md](../../../.specs/codebase/TESTING.md) and [vitals-cli-validation](../vitals-cli-validation/SKILL.md)

For project-wide quality gate when finishing tasks: agent `verifier-quality-gates`, rule [quality-gates.mdc](../../rules/quality-gates.mdc), command `pnpm build && pnpm test` (thresholds in TESTING.md).
