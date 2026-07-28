# ROADMAP Sync

**Canonical source** for creating and keeping [.specs/project/ROADMAP.md](../../../../.specs/project/ROADMAP.md) aligned with delivered features.

**Editorial contract:** [.cursor/rules/roadmap-sot.mdc](../../../rules/roadmap-sot.mdc) — lean milestone tracker only. STATE edits follow [.cursor/rules/state-sot.mdc](../../../rules/state-sot.mdc) — lasting locks only (never Execute-complete changelog).

**Used by:** `planner-feature` (on planning complete / initial creation), `orchestrator-implementer` (on Execute Done), direct-mode implementers.

---

## Initial creation

**Trigger:** "Create roadmap", "Plan features", "Map project phases" (when ROADMAP.md is missing or empty).

From PROJECT.md, decompose vision into milestones (shippable increments) and features (user-facing capabilities).

```markdown
# ROADMAP — @taranti/hotspot-scanner

## Current

| Field | Value |
| ----- | ----- |
| **Status** | … |
| **Open milestones** | … |
| **Deferred** | [STATE.md](STATE.md) § Deferred |

### Done summary

| Band | Scope |
| ---- | ----- |
| … | … |

## Archive

## Milestone N — Name — PLANNED

→ [`.specs/features/<slug>/spec.md`](../features/<slug>/spec.md)

One-line outcome / goal.

- Up to 3–5 capability bullets (not tasks)
```

**Status values:** PLANNED | IN PROGRESS | DONE.

**Size:** soft hook warn at 900 lines — see roadmap-sot. Soft target ~3,000 tokens.

**Forbidden drift** (roadmap-sot): Artifacts / HOTSPOT-* / Out of scope / Final gate / task checkboxes / Further horizon Deferred lists / Post-* backlog headers for Done work.

---

## When to sync

| Event              | ROADMAP.md                                           | STATE.md                                                                 |
| ------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------ |
| Planning complete  | Add/update feature under milestone (status: planned) | Optional: lasting locks only (no Specs Planned / Execute rows)         |
| Execute Done       | Mark feature **DONE** under milestone                | Blockers / lessons / lasting locks **if any**; never append `M## Done` |
| Milestone complete | Update **Current** table + Done summary              | Update **Active**; add Decision row only if a new lasting lock emerged |

---

## Entry template (Planned or Done)

```markdown
## Milestone N — Name — DONE

→ [`.specs/features/<slug>/spec.md`](../features/<slug>/spec.md)

One-line outcome.

- Up to 3–5 capability bullets (not tasks)
```

Use status suffix `PLANNED` / `IN PROGRESS` / `DONE` as appropriate.

**Do not** copy into ROADMAP: `Artifacts:`, `Sisters`, `HOTSPOT-*` / `IDs:`, `Depth:`, `Out of scope:`, `Final gate`, task checkboxes (`- [ ]` / `- [x]`), Deferred lists, or `Suggested execution order` for completed bands. Detail stays in `.specs/features/<slug>/`; deferred ideas stay in STATE.

---

## What to update on Done

1. Find the feature entry under its milestone in ROADMAP.md.
2. Set status to **DONE** (match template: `## Milestone N — Name — DONE`).
3. Ensure link to `.specs/features/<slug>/spec.md` exists; keep outcome + ≤5 capability bullets (trim any Execute dump).
4. If milestone is fully complete, update **Current** + Done summary per ROADMAP structure.

---

## Checklist (orchestrator Phase F)

```
- [ ] tasks.md Status → Done
- [ ] ROADMAP.md feature entry → DONE (roadmap-sot template; no Artifacts/HOTSPOT/tasks dump)
- [ ] ROADMAP.md link to spec.md valid
- [ ] STATE.md updated **only if** lasting lock / blocker / lesson / deferred changed (state-sot — no `M## Done` / Execute complete rows)
- [ ] ARCHITECTURE.md: if pipeline / module / contract / constraint changed → sync present-tense design (no M## / HOTSPOT-*); else skip — do not append UX/flag encyclopedias
- [ ] CONCERNS.md: if fragile risks / mitigations changed → sync present-tense risk tables (no M## / HOTSPOT-*; see concerns-sot.mdc); else skip
- [ ] CONVENTIONS.md: if naming / imports / build / lint conventions changed → sync present-tense conventions (no M##; see conventions-sot.mdc); else skip
- [ ] INTEGRATIONS.md: if spawn / runtime deps / `node:fs` adapter ownership changed → sync present tense (no M## / HOTSPOT-*; see integrations-sot.mdc); else skip
- [ ] STACK.md: if runtime / deps / `files` / `engines` / `exports` / build inventory changed → sync present tense (no M## / HOTSPOT-*; see stack-sot.mdc); else skip
- [ ] STRUCTURE.md: if directory layout / module paths / public API changed → sync present tense (no M## / HOTSPOT-*; see structure-sot.mdc); else skip
- [ ] AGENTS.md: if exit codes / agent policies / skills-agents inventory changed → sync lean index (no M##; see agents-sot.mdc); else skip — do not dump CLI examples or Design SoT
- [ ] CONTRIBUTING.md: if gate / DX scripts / prerequisites / contribute workflow changed → sync thin guide (contributing-sot + `lintContributingDoc`); else skip — **do not** mirror STRUCTURE/TESTING/INTEGRATIONS/CONCERNS or the AGENTS exit-code table
- [ ] Self-check: any sentence that needs a milestone number → wrong doc for present-tense SoTs (use ROADMAP/features; lasting locks → STATE; not ARCHITECTURE/CONCERNS/…)
- [ ] Optional verify: `pnpm hooks:smoke` (living SoT lint via Cursor hooks; not part of `pnpm build && pnpm test`)
```

---

## Who edits what

| File       | planner-feature         | orchestrator-implementer    | implementer (orchestrated) |
| ---------- | ----------------------- | --------------------------- | -------------------------- |
| tasks.md   | Creates; Status Planned | Updates checkboxes + Status | **Must not edit**          |
| ROADMAP.md | Adds planned feature    | Marks Done                  | **Must not edit**          |
| STATE.md   | Optional on planning    | On significant decisions    | **Must not edit**          |

---

## Examples

| Feature                 | ROADMAP change                     |
| ----------------------- | ---------------------------------- |
| GitMiner Done           | Add DONE under M2 Git Change Miner |
| ComplexityAnalyzer Done | Add DONE under M3                  |
| CLI wiring Done         | Mark under M5                      |

Do not duplicate full spec content in ROADMAP — link to `.specs/features/<slug>/spec.md`.
