---
name: vitals-spec-driven
description: Project-specific spec-driven planning for @vitals/hotspot-scanner. Adaptive Specify → Design → Tasks (and handoff to Execute). Creates atomic tasks with verification criteria, HOTSPOT-* IDs, and session memory. Use when planning features, writing spec/design/tasks, quick-mode ad-hoc tasks, or pause/resume handoff. Triggers on "initialize project", "map codebase", "specify feature", "discuss feature", "design", "tasks", "quick fix", "quick task", "pause work", "resume work". Do NOT use for code implementation (orchestrator-implementer / implementer), acceptance checks (verifier-implementation), quality gates (verifier-quality-gates), or pipeline domain detail alone (vitals-pipeline-domain).
license: CC-BY-4.0
metadata:
  author: Vitals
  originalAuthor: Felipe Rodrigues - github.com/felipfr
  version: 2.1.0
---

# Vitals Spec-Driven

Plan features with precision. Granular tasks. Clear dependencies. Right tools. Zero ceremony.

## Project: @vitals/hotspot-scanner

This skill is adapted for the **@vitals/hotspot-scanner** repository, based on TLC Spec-Driven by Felipe Rodrigues. Always read [vitals-project.md](../vitals-common/references/vitals-project.md) (skill `vitals-common`) and [AGENTS.md](../../../AGENTS.md) (index).

**Scope:** Project-specific — do not treat as stack-agnostic. Applies only to this repository unless explicitly forked.

**Brownfield status:** `.specs/codebase/` is the Design SoT — refresh incrementally after milestones. Do not run full brownfield mapping unless the user requests a refresh.

**Base load for this repo:**

- [AGENTS.md](../../../AGENTS.md)
- [vitals-project.md](../vitals-common/references/vitals-project.md)
- `.specs/project/PROJECT.md`, `ROADMAP.md`, `STATE.md`

**Project-specific overrides (pointers):**

- Gate → [quality-gates.mdc](../../rules/quality-gates.mdc) + TESTING § Coverage
- Requirement IDs → [feature-planning.mdc](../../rules/feature-planning.mdc) (`HOTSPOT-*`)
- Commits → [commit-policy.mdc](../../rules/commit-policy.mdc)
- Exit codes / CLI validation → [docs/cli-reference.md](../../../docs/cli-reference.md#exit-codes) + skill `vitals-cli-validation`

**Execute boundary:** This skill owns Specify → Design → Tasks (and Quick / handoff). **Do not implement application code here.** If `tasks.md` Status is `Draft` or `Planned`, do **not** start Execute in this session — hand off to a new session with `orchestrator-implementer` + skill [`vitals-execute`](../vitals-execute/SKILL.md) after the user promotes Status. See [planning-session-boundary.md](references/planning-session-boundary.md).

## Progressive disclosure (do not load all references)

Load **only** the refs for the current phase. Never preload the entire `references/` tree.

| Phase / mode | Load these refs |
| ------------ | --------------- |
| Specify | [specify.md](references/specify.md); [discuss.md](references/discuss.md) only if gray areas |
| Design | [design.md](references/design.md); [brownfield-mapping.md](references/brownfield-mapping.md) if Large/Complex |
| Tasks | [tasks.md](references/tasks.md); [feature-spec-checklist.md](references/feature-spec-checklist.md); [implementer-routing.md](../vitals-common/references/implementer-routing.md); [planning-session-boundary.md](references/planning-session-boundary.md) |
| Execute handoff | Stop planning; user promotes Status → new session runs `orchestrator-implementer` with [`vitals-execute`](../vitals-execute/SKILL.md) (do not load implement refs from this skill session) |
| Quick | [quick-mode.md](references/quick-mode.md) |
| Session handoff | [session-handoff.md](references/session-handoff.md); [state-management.md](references/state-management.md) |

```
┌──────────┐   ┌──────────┐   ┌─────────┐   ┌─────────────────────────┐
│ SPECIFY  │ → │  DESIGN  │ → │  TASKS  │ → │ EXECUTE (other session) │
└──────────┘   └──────────┘   └─────────┘   └─────────────────────────┘
   required      optional*      optional*     orchestrator-implementer

* Agent auto-skips when scope doesn't need it
```

## Auto-Sizing: The Core Principle

**The complexity determines the depth, not a fixed pipeline.** Before starting any feature, assess its scope and apply only what's needed:

| Scope       | What                     | Specify                                                 | Design                                          | Tasks                         | Execute                                        |
| ----------- | ------------------------ | ------------------------------------------------------- | ----------------------------------------------- | ----------------------------- | ---------------------------------------------- |
| **Small**   | ≤3 files, one sentence   | **Quick mode** — skip pipeline entirely                 | -                                               | -                             | Quick mode implements in-session (see quick-mode.md) |
| **Medium**  | Clear feature, <10 tasks | Spec (brief)                                            | Skip — design inline                            | Skip — tasks implicit         | Handoff → `orchestrator-implementer` or quick  |
| **Large**   | Multi-component feature  | Full spec + requirement IDs                             | Architecture + components                       | Full breakdown + dependencies | Handoff → `orchestrator-implementer`           |
| **Complex** | Ambiguity, new domain    | Full spec + [discuss gray areas](references/discuss.md) | [Research](references/design.md) + architecture | Breakdown + parallel plan     | Handoff → orchestrator + [`vitals-execute`](../vitals-execute/SKILL.md) / validate |

**Rules:**

- **Specify is always required** for Medium+; **Execute** runs in a **separate** orchestrated session (except Quick mode)
- **Design is skipped** when the change is straightforward (no architectural decisions, no new patterns)
- **Tasks is skipped** when there are ≤3 obvious steps (they become implicit in Execute / quick mode)
- **Discuss is triggered within Specify** only when the agent detects ambiguous gray areas that need user input
- **Quick mode** is the express lane — for bug fixes, config changes, and small tweaks

**Safety valve:** If informal steps exceed 5 or have complex dependencies, STOP and create a formal `tasks.md` before Execute handoff.

## Project Structure

```
.specs/
├── project/
│   ├── PROJECT.md      # Vision & goals
│   ├── ROADMAP.md      # Features & milestones
│   └── STATE.md        # Memory: decisions, blockers, lessons, todos, deferred ideas
├── codebase/           # Brownfield analysis
│   ├── STACK.md
│   ├── ARCHITECTURE.md
│   ├── CONVENTIONS.md
│   ├── STRUCTURE.md
│   ├── TESTING.md
│   ├── INTEGRATIONS.md
│   └── CONCERNS.md
├── features/           # Feature specifications
│   └── [feature]/
│       ├── spec.md     # Requirements with traceable IDs
│       ├── context.md  # User decisions for gray areas (only when discuss is triggered)
│       ├── design.md   # Architecture & components (only for Large/Complex)
│       └── tasks.md    # Atomic tasks with verification (only for Large/Complex)
└── quick/              # Ad-hoc tasks (quick mode)
    └── NNN-slug/
        ├── TASK.md
        └── SUMMARY.md
```

## Workflow

**New project:**

1. Initialize project → PROJECT.md + ROADMAP.md
2. For each feature → Specify → (Design) → (Tasks) → Execute (depth auto-sized)

**Existing codebase:**

1. Map codebase → 7 brownfield docs (skip if `.specs/codebase/` already exists — refresh incrementally instead)
2. Initialize project → PROJECT.md + ROADMAP.md (skip if already exists)
3. For each feature → same adaptive workflow

**Quick mode:** Describe → Implement → Verify → (commit only if user asks) (for ≤3 files, one-sentence scope)

## Context Loading Strategy

Follow the progressive disclosure table above. Do **not** load all `references/*.md` at once.

**Base load (~15k tokens):**

- AGENTS.md + vitals-project.md (this repo)
- PROJECT.md (if exists)
- ROADMAP.md (when planning/working on features)
- STATE.md (persistent memory)

**On-demand load:**

- Codebase docs (when working in existing project)
- CONCERNS.md (when planning features that touch flagged areas)
- TESTING.md (when creating tasks or executing)
- Feature `spec.md` / `context.md` / `design.md` / `tasks.md` for the active slug only
- Phase refs from the progressive disclosure table

**Never load simultaneously:**

- Multiple feature specs
- Multiple architecture docs
- Archived documents
- The full set of skill references

**Target:** <40k tokens total context
**Reserve:** 160k+ tokens for work, reasoning, outputs
**Monitoring:** Display status when >40k (see [context-limits.md](references/context-limits.md))

## Sub-Agent Delegation

Use sub-agents to keep the main context window lean.

**Planning:** research via explore / generalPurpose when needed; this skill session does **not** implement.

**Execute (other session):** `orchestrator-implementer` + [`vitals-execute`](../vitals-execute/SKILL.md) — do not load implementer procedure from this planning skill session.

| Activity | Delegate? | Executor |
| -------- | --------- | -------- |
| Research (design / brownfield) | Yes | explore / generalPurpose |
| Implementing a tasks.md task | Yes (Execute session) | `implementer` via orchestrator |
| Planning, task creation | No | Full context in planner session |
| Quick mode | No | Main agent + quick-mode.md |

## Commands

**Project-level:**

| Trigger Pattern                     | Reference                                                 |
| ----------------------------------- | --------------------------------------------------------- |
| Initialize project, setup project   | [project-init.md](references/project-init.md)             |
| Create roadmap, plan features       | [roadmap.md](references/roadmap.md)                       |
| Map codebase, analyze existing code | [brownfield-mapping.md](references/brownfield-mapping.md) |
| Document concerns, find tech debt   | [concerns.md](references/concerns.md)                     |
| Record decision, log blocker        | [state-management.md](references/state-management.md)     |
| Pause work, end session             | [session-handoff.md](references/session-handoff.md)       |
| Resume work, continue               | [session-handoff.md](references/session-handoff.md)       |

**Feature-level (auto-sized):**

| Trigger Pattern                      | Reference                                 |
| ------------------------------------ | ----------------------------------------- |
| Specify feature, define requirements | [specify.md](references/specify.md)       |
| Discuss feature, capture context     | [discuss.md](references/discuss.md)       |
| Design feature, architecture         | [design.md](references/design.md)         |
| Break into tasks, create tasks       | [tasks.md](references/tasks.md)           |
| Implement task, build, execute       | Hand off → `orchestrator-implementer` + [`vitals-execute`](../vitals-execute/SKILL.md) |
| Validate, verify, test               | [`validate.md`](../vitals-execute/references/validate.md) / `verifier-implementation` |
| Quick fix, quick task, small change  | [quick-mode.md](references/quick-mode.md) |

## Knowledge Verification Chain

```
Step 1: Codebase → existing code, conventions, patterns
Step 2: Project docs → AGENTS.md, vitals-project.md, .specs/codebase/
Step 3: Context7 MCP → ts-morph, commander, vitest
Step 4: Web search → official docs when Context7 unavailable
Step 5: Flag as uncertain → never fabricate APIs
```

**Context7 fallback:** If Context7 MCP is not configured, skip Step 3 and proceed to web search.

## Output Behavior

Be conversational, not robotic. For heavy tasks (brownfield mapping, complex design), note reasoning requirements before starting.

## Code Analysis

Use available tools with graceful degradation. See [code-analysis.md](references/code-analysis.md).
