# Phase: Codebase Concerns

**Trigger:** Part of brownfield mapping, or "document concerns", "find tech debt", "what's risky in this codebase".

**Purpose:** Keep [CONCERNS.md](../../../../.specs/codebase/CONCERNS.md) actionable — what to watch when changing the scanner. Living risk SoT; not a complaint list.

**Ownership:** New lasting risks go in CONCERNS.md (see [DOC-OWNERSHIP.md](../../../../.specs/codebase/DOC-OWNERSHIP.md) and [concerns-sot.mdc](../../../rules/concerns-sot.mdc)).

## When to update

- Exploring a new area reveals fragility
- A bug investigation uncovers systemic issues
- A feature hits unexpected edge cases in git/NCLOC/scoring/schemas
- Dependency or adapter audit (see INTEGRATIONS.md)

## Domain focus (hotspot-scanner)

Prefer evidence in fragile scanner areas — do not restate watchlists here:

- Risk / formula SoT: [CONCERNS.md](../../../../.specs/codebase/CONCERNS.md)
- Coding guardrails: [fragile-areas.mdc](../../../rules/fragile-areas.mdc)
- Module pointers: [vitals-pipeline-domain](../../vitals-pipeline-domain/SKILL.md)

Skip generic web-app checklists (auth, N+1 SQL, etc.).

## Process

1. **Gather evidence** — failing tests, fixture gaps, TODO/FIXME in fragile paths, coverage holes, RT-* IDs.
2. **Classify** — each concern: what / where (paths) / why (impact) / how to mitigate.
3. **Prioritize** — wrong scores, silent data loss, broken contracts, scan aborts; skip style nits.
4. **Write to CONCERNS.md** — present tense; no changelog / `M##` voice in the SoT.

## Template shape

Follow the existing CONCERNS.md structure (tech debt, known bugs, RT-* rows, mitigations). Do not invent unrelated sections (auth, N+1 SQL, etc.).

## Related

- Behavioral guardrails while coding: [fragile-areas.mdc](../../../rules/fragile-areas.mdc)
- Pipeline pointers: [vitals-pipeline-domain](../../vitals-pipeline-domain/SKILL.md)
- Brownfield flow: [brownfield-mapping.md](brownfield-mapping.md)
