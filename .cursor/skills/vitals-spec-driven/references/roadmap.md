# Roadmap Creation

**Trigger:** "Create roadmap", "Plan features", "Map project phases"

**Editorial contract:** [.cursor/rules/roadmap-sot.mdc](../../../rules/roadmap-sot.mdc). Sync on Done: [roadmap-sync.md](roadmap-sync.md).

## Process

Based on PROJECT.md, decompose vision into:

- Milestones (shippable increments)
- Features (user-facing capabilities)
- Status tracking (planned/in-progress/complete)

## Output: .specs/project/ROADMAP.md

**Structure:**

```markdown
# ROADMAP — @vitals/hotspot-scanner

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

**Status values:**

- PLANNED: Not started
- IN PROGRESS: Currently implementing
- DONE: Shipped and verified

**Size limit:** 3,000 tokens (~1,800 words). Soft hook warn at 900 lines — see roadmap-sot.

**Forbidden drift** (see roadmap-sot): Artifacts / HOTSPOT-* / Out of scope / Final gate / task checkboxes / Further horizon Deferred lists / Post-* backlog headers for Done work.

**Update strategy:**

- Mark features PLANNED → IN PROGRESS when starting
- Mark IN PROGRESS → DONE when verified (template only — do not paste tasks.md)
- Add new milestones as project evolves

**Validation:**

- Each milestone has clear shippable outcome?
- Features are user-facing capabilities?
- Status reflects current reality?
- Entry matches roadmap-sot template?
