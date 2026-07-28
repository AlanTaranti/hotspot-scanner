# @taranti/hotspot-scanner — Project Overlay

**Operational overlay** for agents and skills (not a layout SoT, not the inventory index).

- **Identity + skills/agents inventory:** [AGENTS.md](../../../../AGENTS.md)
- **Where content goes:** [DOC-OWNERSHIP.md](../../../../.specs/codebase/DOC-OWNERSHIP.md)
- **Design SoT:** [ARCHITECTURE.md](../../../../.specs/codebase/ARCHITECTURE.md)
- **Path \| Role layout:** [STRUCTURE.md](../../../../.specs/codebase/STRUCTURE.md)
- **Task path ownership:** [implementer-routing.md](implementer-routing.md)
- **Fragile / formulas:** [CONCERNS.md](../../../../.specs/codebase/CONCERNS.md)

---

## Gate check

**Full gate:** [quality-gates.mdc](../../../../.cursor/rules/quality-gates.mdc) + [TESTING.md](../../../../.specs/codebase/TESTING.md) § Coverage.

```bash
pnpm verify
```

## Domain concepts (pointers)

- **FileChangeStats / ComplexityResult / hotspotScore** — CONCERNS.md + ARCHITECTURE.md
- **parseScanResult** — `src/scan-result/` + schemas
- **Config** — `.hotspot-scanner.json`; CLI-only flags in cli-reference

## Requirement IDs / Commit / YAGNI

Pointers: [feature-planning.mdc](../../../../.cursor/rules/feature-planning.mdc) (`HOTSPOT-*`), [commit-policy.mdc](../../../../.cursor/rules/commit-policy.mdc), [coding-guidelines](../../coding-guidelines/SKILL.md). Shared agent constraints: [agent-hard-constraints.md](../../../agents/references/agent-hard-constraints.md).

## Validation (CLI)

No interactive UI UAT. Fixtures: `tests/fixtures/repos/<slug>`.

1. Exit codes SoT: [docs/cli-reference.md](../../../../docs/cli-reference.md#exit-codes)
2. Workflow + fixture authoring: skill `vitals-cli-validation`
3. Flag encyclopedia: `docs/cli-reference.md` (not this file)

## Knowledge sources

1. `.specs/codebase/` + DOC-OWNERSHIP + STATE + ROADMAP
2. `vitals-pipeline-domain` — pipeline context (pointers)
3. `vitals-cli-validation` — CLI/fixture checks
4. Index: [AGENTS.md](../../../../AGENTS.md)
