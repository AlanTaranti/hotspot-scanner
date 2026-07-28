# Shared agent hard constraints

Canonical shared constraints for all agents under `.cursor/agents/`. Agents add only **role-specific** bullets; do not invent parallel policy text.

| Topic | SoT |
| ----- | --- |
| Commit only when user asks | [commit-policy.mdc](../../rules/commit-policy.mdc) |
| Project gate before Done | [quality-gates.mdc](../../rules/quality-gates.mdc) + TESTING.md § Coverage |
| YAGNI / surgical diffs | [coding-guidelines](../../skills/coding-guidelines/SKILL.md) |
| Skills/agents inventory | [AGENTS.md](../../../AGENTS.md) |
| Operational overlay | [vitals-project.md](../../skills/vitals-common/references/vitals-project.md) |

## Always apply

1. Follow alwaysApply rules: `commit-policy`, `quality-gates`, and load `coding-guidelines` when writing or reviewing code.
2. Treat [AGENTS.md](../../../AGENTS.md) as index only — policy lives in the SoTs above.
3. Do not invent exit-code tables, coverage thresholds, or module maps — use cli-reference, TESTING.md, STRUCTURE.md / implementer-routing.
4. Propose Conventional Commit messages after verification; do **not** run `git commit` unless the user explicitly asks (commit / commite / comitar / versionar).
