# ROADMAP Sync

**Canonical source** for keeping [.specs/project/ROADMAP.md](../../../../.specs/project/ROADMAP.md) aligned with delivered features.

**Used by:** `planner-feature` (on planning complete), `orchestrator-implementer` (on Execute Done), direct-mode implementers.

---

## When to sync

| Event              | ROADMAP.md                                           | STATE.md                    |
| ------------------ | ---------------------------------------------------- | --------------------------- |
| Planning complete  | Add/update feature under milestone (status: planned) | Optional: log decisions     |
| Execute Done       | Mark feature **DONE** under milestone                | Log blockers/lessons if any |
| Milestone complete | Update **Current Milestone** header                  | Record milestone decision   |

---

## What to update on Done

1. Find the feature entry under its milestone in ROADMAP.md.
2. Set status to **DONE** (match existing convention: `- DONE` suffix or `**Feature** - DONE`).
3. Ensure link to `.specs/features/<slug>/spec.md` exists.
4. If milestone is fully complete, advance **Current Milestone** to next per ROADMAP structure.

---

## Checklist (orchestrator Phase F)

```
- [ ] tasks.md Status → Done
- [ ] ROADMAP.md feature entry → DONE
- [ ] ROADMAP.md link to spec.md valid
- [ ] STATE.md updated if decisions/blockers emerged during Execute
- [ ] ARCHITECTURE.md: if pipeline / module / contract / constraint changed → sync present-tense design (no M## / HOTSPOT-*); else skip — do not append UX/flag encyclopedias
- [ ] CONCERNS.md: if fragile risks / mitigations changed → sync present-tense risk tables (no M## / HOTSPOT-*; see concerns-sot.mdc); else skip
- [ ] Self-check: any sentence that needs a milestone number → wrong doc (ROADMAP/STATE/features, not ARCHITECTURE/CONCERNS)
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
