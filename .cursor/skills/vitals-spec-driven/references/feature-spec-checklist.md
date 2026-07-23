# Feature Spec Checklist — Pós-planejamento

**Used by:** `planner-feature` before marking planning complete.

**Goal:** Confirm micro-specs are complete and consistent before handoff to development.

**Input:** Feature artifacts under `.specs/features/<slug>/`.

---

## Artifacts per feature

| Scope | spec.md | design.md | tasks.md | context.md |
| ----- | ------- | --------- | -------- | ---------- |
| Small / Quick | ✓ | — | — | — |
| Medium | ✓ | inline or — | implicit OK | if needed |
| Large / Complex | ✓ + HOTSPOT-* IDs | ✓ | ✓ + Execution Plan | ✓ if ambiguous |

- [ ] Folder `.specs/features/<slug>/` exists with at least `spec.md`
- [ ] Requirement IDs use prefix `HOTSPOT-`
- [ ] Large/Complex: all P1 criteria mapped to tasks (Requirement → Task Mapping)

## Design quality

- [ ] Module boundaries align with [STRUCTURE.md](../../../.specs/codebase/STRUCTURE.md)
- [ ] Fragile areas from [CONCERNS.md](../../../.specs/codebase/CONCERNS.md) addressed or flagged
- [ ] Integration points reference [INTEGRATIONS.md](../../../.specs/codebase/INTEGRATIONS.md) where applicable
- [ ] `.specs/codebase/` sections cited when design deviates from or extends documented architecture

## Tasks quality

- [ ] Each task has: What, Where, Depends on, Done when, Tests, Gate
- [ ] Gate commands are runnable (typically `pnpm test -- <path>` or `pnpm build && pnpm test` for final task)
- [ ] No task spans 2+ unrelated modules without `Depends on` split ([implementer-routing.md](implementer-routing.md))
- [ ] `[P]` parallel tasks are actually parallel-safe
- [ ] Final gate task uses `deferred_project_gate` or explicit `pnpm build && pnpm test`

## ROADMAP sync

- [ ] Feature listed under correct milestone in [ROADMAP.md](../../../.specs/project/ROADMAP.md)
- [ ] Link to `spec.md` from ROADMAP entry (or noted for sync on Done)

## Planning complete gate

Mark **yes** only when:

- [ ] `tasks.md` has **Status: Planned** (Large/Complex) or N/A (Quick/Medium implicit)
- [ ] Zero unresolved `PENDENTE-DISCUSSÃO` in `context.md` (or explicitly deferred with user ack)
- [ ] Handoff message prepared per [planning-session-boundary.md](planning-session-boundary.md)

If **no**, list missing items before presenting to user.

**Not this gate:** dev authorization — `orchestrator-implementer` requires Status `Approved` or `Ready for Execute` in a separate session.
