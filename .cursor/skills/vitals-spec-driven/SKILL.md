---
name: vitals-spec-driven
description: Project-specific spec-driven planning for @vitals/hotspot-scanner. Adaptive Specify → Design → Tasks (and handoff to Execute). Creates atomic tasks with verification criteria, HOTSPOT-* IDs, and session memory. Use when planning features, writing spec/design/tasks, quick-mode ad-hoc tasks, or pause/resume handoff. Triggers on "initialize project", "map codebase", "specify feature", "discuss feature", "design", "tasks", "quick fix", "quick task", "pause work", "resume work". Do NOT use for code implementation (orchestrator-implementer / implementer), acceptance checks (verifier-implementation), quality gates (verifier-quality-gates), or pipeline domain detail alone (vitals-pipeline-domain).
license: CC-BY-4.0
metadata:
  author: Vitals
  originalAuthor: Felipe Rodrigues - github.com/felipfr
  version: 2.2.0
---

# Vitals Spec-Driven

Plan features with precision. Granular tasks. Clear dependencies. Right tools. Zero ceremony.

## Project: @vitals/hotspot-scanner

Adapted for this repository. Always read [vitals-project.md](../vitals-common/references/vitals-project.md) (`vitals-common`) and [AGENTS.md](../../../AGENTS.md).

**Scope:** Project-specific — applies only to this repository unless forked.

**Brownfield:** `.specs/codebase/` is the Design SoT — refresh incrementally. Full brownfield mapping only if the user requests it.

**Base load:** AGENTS.md · vitals-project.md · `.specs/project/{PROJECT,ROADMAP,STATE}.md`

**Pointers:** Gate → [quality-gates.mdc](../../rules/quality-gates.mdc) + TESTING § Coverage · IDs → [feature-planning.mdc](../../rules/feature-planning.mdc) (`HOTSPOT-*`) · Commits → [commit-policy.mdc](../../rules/commit-policy.mdc) · Exit codes → [docs/cli-reference.md](../../../docs/cli-reference.md#exit-codes) + `vitals-cli-validation`

**Execute boundary:** This skill owns Specify → Design → Tasks (and Quick / handoff). **Do not implement application code here** (except [quick-mode.md](references/quick-mode.md)). If `tasks.md` Status is `Draft` or `Planned`, do **not** start Execute — hand off to a new session with `orchestrator-implementer` + [`vitals-execute`](../vitals-execute/SKILL.md). See [planning-session-boundary.md](references/planning-session-boundary.md).

## Progressive disclosure

Load **only** the refs for the current phase. Never preload the entire `references/` tree.

| Phase / mode | Load |
| ------------ | ---- |
| Specify | [specify.md](references/specify.md); [discuss.md](references/discuss.md) if gray areas |
| Design | [design.md](references/design.md); [brownfield-mapping.md](references/brownfield-mapping.md) if Large/Complex |
| Tasks | [tasks.md](references/tasks.md); [feature-spec-checklist.md](references/feature-spec-checklist.md); [implementer-routing.md](../vitals-common/references/implementer-routing.md); [planning-session-boundary.md](references/planning-session-boundary.md) |
| Execute handoff | Stop planning; user promotes Status → new session: `orchestrator-implementer` + [`vitals-execute`](../vitals-execute/SKILL.md) |
| Quick | [quick-mode.md](references/quick-mode.md) |
| Session handoff | [session-handoff.md](references/session-handoff.md); [state-management.md](references/state-management.md) |

```
┌──────────┐   ┌──────────┐   ┌─────────┐   ┌─────────────────────────┐
│ SPECIFY  │ → │  DESIGN  │ → │  TASKS  │ → │ EXECUTE (other session) │
└──────────┘   └──────────┘   └─────────┘   └─────────────────────────┘
```

## Auto-sizing

Complexity determines depth — not a fixed pipeline:

| Scope | Specify | Design | Tasks | Execute |
| ----- | ------- | ------ | ----- | ------- |
| **Small** (≤3 files, one sentence) | **Quick mode** | — | — | In-session via quick-mode |
| **Medium** | Spec (brief) | Skip / inline | Skip / implicit | Handoff → orchestrator or quick |
| **Large** | Full + `HOTSPOT-*` | Architecture | Full breakdown | Handoff → `orchestrator-implementer` |
| **Complex** | Full + [discuss](references/discuss.md) | Research + architecture | Breakdown + parallel plan | Handoff → orchestrator + [`vitals-execute`](../vitals-execute/SKILL.md) |

- Specify required for Medium+; Execute in a **separate** session (except Quick)
- Skip Design when no architectural decisions; skip Tasks when ≤3 obvious steps
- **Safety valve:** if informal steps exceed 5 or have complex deps → formal `tasks.md` before Execute handoff

## Project layout

Living docs under `.specs/project/` and `.specs/codebase/` (SoT map: [STRUCTURE.md](../../../.specs/codebase/STRUCTURE.md), ownership: [DOC-OWNERSHIP.md](../../../.specs/codebase/DOC-OWNERSHIP.md)). Features: `.specs/features/<slug>/{spec,design,tasks,context}.md`. Quick: `.specs/quick/NNN-slug/`.

## Context loading

Base: AGENTS + vitals-project + PROJECT / ROADMAP / STATE. On demand: codebase docs for the touch area, feature artifacts for the active slug only, phase refs from the table above. Do not load multiple feature specs or the full `references/` set at once.

## Sub-agent delegation

| Activity | Delegate? | Executor |
| -------- | --------- | -------- |
| Research (design / brownfield) | Yes | explore / generalPurpose |
| Implementing a `tasks.md` task | Yes (Execute session) | `implementer` via orchestrator |
| Planning / task creation | No | This planner session |
| Quick mode | No | Main agent + quick-mode.md |

## Commands (planning only)

| Trigger | Reference |
| ------- | --------- |
| Initialize project | [project-init.md](references/project-init.md) |
| Create roadmap | [roadmap.md](references/roadmap.md) |
| Map codebase | [brownfield-mapping.md](references/brownfield-mapping.md) |
| Document concerns | [concerns.md](references/concerns.md) |
| Record decision / blocker | [state-management.md](references/state-management.md) |
| Pause / resume | [session-handoff.md](references/session-handoff.md) |
| Specify / discuss / design / tasks | [specify.md](references/specify.md) · [discuss.md](references/discuss.md) · [design.md](references/design.md) · [tasks.md](references/tasks.md) |
| Implement / validate / gate | **Execute session only** → [`vitals-execute`](../vitals-execute/SKILL.md) / `verifier-*` |
| Quick fix | [quick-mode.md](references/quick-mode.md) |

## Knowledge verification

1. Codebase + conventions · 2. AGENTS / vitals-project / `.specs/codebase/` · 3. Official docs when APIs uncertain · 4. Flag as uncertain — never fabricate APIs.

## Code analysis

See [code-analysis.md](references/code-analysis.md).
