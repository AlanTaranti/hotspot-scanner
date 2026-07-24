---
name: vitals-spec-driven
description: vitals-spec-driven — project-specific spec-driven planning for @vitals/hotspot-scanner. 4 adaptive phases - Specify, Design, Tasks, Execute. Auto-sizes depth by complexity. Creates atomic tasks with verification criteria, requirement traceability (HOTSPOT- IDs), and persistent memory. Use when (1) Planning hotspot-scanner features (git miner, complexity, scoring, CLI, report), (2) Working in this codebase (git → complexity → scoring → report), (3) Implementing with pnpm build && pnpm test gate, (4) Quick ad-hoc tasks, (5) Tracking decisions/blockers across sessions. Triggers on "initialize project", "map codebase", "specify feature", "discuss feature", "design", "tasks", "implement", "validate", "verify work", "quick fix", "quick task", "pause work", "resume work". Do NOT use for architecture decomposition analysis (use architecture skills) or technical design docs (use create-technical-design-doc).
license: CC-BY-4.0
metadata:
  author: Vitals
  originalAuthor: Felipe Rodrigues - github.com/felipfr
  version: 2.1.0
---

# Vitals Spec-Driven

Plan and implement projects with precision. Granular tasks. Clear dependencies. Right tools. Zero ceremony.

## Project: @vitals/hotspot-scanner

This skill is adapted for the **@vitals/hotspot-scanner** repository, based on TLC Spec-Driven by Felipe Rodrigues. Always read [references/vitals-project.md](references/vitals-project.md) and [AGENTS.md](../../../AGENTS.md).

**Scope:** Project-specific — do not treat as stack-agnostic. Applies only to this repository unless explicitly forked.

**Brownfield status:** `.specs/codebase/` is the Design SoT — refresh incrementally after milestones. Do not run full brownfield mapping unless the user requests a refresh.

**Base load for this repo:**

- [AGENTS.md](../../../AGENTS.md)
- [references/vitals-project.md](references/vitals-project.md)
- `.specs/project/PROJECT.md`, `ROADMAP.md`, `STATE.md`

**Project-specific overrides:**

- Gate: `pnpm build && pnpm test`
- Requirement IDs: `HOTSPOT-` prefix
- Commits: propose message only — commit when user explicitly asks (see AGENTS.md)
- Validation: CLI exit codes + fixture runs, not interactive UI UAT

**Execute boundary:** If `tasks.md` Status is `Draft` or `Planned`, do **not** start Execute in this session — hand off to a new session with `orchestrator-implementer` after user promotes Status.

## Progressive disclosure (do not load all references)

Load **only** the refs for the current phase. Never preload the entire `references/` tree.

| Phase / mode | Load these refs |
| ------------ | --------------- |
| Specify | [specify.md](references/specify.md); [discuss.md](references/discuss.md) only if gray areas |
| Design | [design.md](references/design.md); [brownfield-mapping.md](references/brownfield-mapping.md) if Large/Complex |
| Tasks | [tasks.md](references/tasks.md); [feature-spec-checklist.md](references/feature-spec-checklist.md); [implementer-routing.md](references/implementer-routing.md); [planning-session-boundary.md](references/planning-session-boundary.md) |
| Execute (orchestrated) | [execute-orchestration-playbook.md](references/execute-orchestration-playbook.md); [orchestrated-implementer.md](references/orchestrated-implementer.md); [implement.md](references/implement.md); [roadmap-sync.md](references/roadmap-sync.md) |
| Validate | [validate.md](references/validate.md) |
| Quick | [quick-mode.md](references/quick-mode.md) |
| Session handoff | [session-handoff.md](references/session-handoff.md); [state-management.md](references/state-management.md) |

```
┌──────────┐   ┌──────────┐   ┌─────────┐   ┌─────────┐
│ SPECIFY  │ → │  DESIGN  │ → │  TASKS  │ → │ EXECUTE │
└──────────┘   └──────────┘   └─────────┘   └─────────┘
   required      optional*      optional*     required

* Agent auto-skips when scope doesn't need it
```

## Auto-Sizing: The Core Principle

**The complexity determines the depth, not a fixed pipeline.** Before starting any feature, assess its scope and apply only what's needed:

| Scope       | What                     | Specify                                                 | Design                                          | Tasks                         | Execute                                               |
| ----------- | ------------------------ | ------------------------------------------------------- | ----------------------------------------------- | ----------------------------- | ----------------------------------------------------- |
| **Small**   | ≤3 files, one sentence   | **Quick mode** — skip pipeline entirely                 | -                                               | -                             | -                                                     |
| **Medium**  | Clear feature, <10 tasks | Spec (brief)                                            | Skip — design inline                            | Skip — tasks implicit         | Implement + verify                                    |
| **Large**   | Multi-component feature  | Full spec + requirement IDs                             | Architecture + components                       | Full breakdown + dependencies | Implement + verify per task                           |
| **Complex** | Ambiguity, new domain    | Full spec + [discuss gray areas](references/discuss.md) | [Research](references/design.md) + architecture | Breakdown + parallel plan     | Implement + [validate](references/validate.md)        |

**Rules:**

- **Specify and Execute are always required** — you always need to know WHAT and DO it
- **Design is skipped** when the change is straightforward (no architectural decisions, no new patterns)
- **Tasks is skipped** when there are ≤3 obvious steps (they become implicit in Execute)
- **Discuss is triggered within Specify** only when the agent detects ambiguous gray areas that need user input
- **Quick mode** is the express lane — for bug fixes, config changes, and small tweaks

**Safety valve:** Even when Tasks is skipped, Execute ALWAYS starts by listing atomic steps inline (see [implement.md](references/implement.md)). If that listing reveals >5 steps or complex dependencies, STOP and create a formal `tasks.md` — the Tasks phase was wrongly skipped.

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

Use sub-agents (the Task tool or equivalent) to keep the main context window lean and enable parallel execution.

**Orchestrated Execute:** `orchestrator-implementer` delegates each task to the `implementer` subagent with `orchestrated: true`. Implementers follow the `task-implementer` skill.

**When to delegate to a sub-agent:**

| Activity | Delegate? | Executor |
|---|---|---|
| Research (design phase, brownfield mapping) | Yes | explore / generalPurpose |
| Implementing a tasks.md task | Yes | `implementer` |
| Parallel `[P]` tasks | Yes (one per task) | `implementer` (parallel Task calls) |
| Planning, task creation, validation reports | No | Full context required |
| Quick mode tasks | No | Too small to justify overhead |

**Context each `implementer` sub-agent receives:**

- The specific task definition from tasks.md (What, Where, Depends on, Reuses, Done when, Tests, Gate)
- `task-implementer` skill → coding-guidelines, CONVENTIONS.md, TESTING.md
- Spec/design context paths listed in the orchestrator minimum prompt

**What sub-agents return:**

- Status: Complete | Blocked | Partial
- Files changed: [list]
- Gate check result: [pass/fail + test counts]
- SPEC_DEVIATION markers (if any)
- Issues encountered (if any)

## Commands

**Project-level:**
| Trigger Pattern | Reference |
|----------------|-----------|
| Initialize project, setup project | [project-init.md](references/project-init.md) |
| Create roadmap, plan features | [roadmap.md](references/roadmap.md) |
| Map codebase, analyze existing code | [brownfield-mapping.md](references/brownfield-mapping.md) |
| Document concerns, find tech debt | [concerns.md](references/concerns.md) |
| Record decision, log blocker | [state-management.md](references/state-management.md) |
| Pause work, end session | [session-handoff.md](references/session-handoff.md) |
| Resume work, continue | [session-handoff.md](references/session-handoff.md) |

**Feature-level (auto-sized):**
| Trigger Pattern | Reference |
|----------------|-----------|
| Specify feature, define requirements | [specify.md](references/specify.md) |
| Discuss feature, capture context | [discuss.md](references/discuss.md) |
| Design feature, architecture | [design.md](references/design.md) |
| Break into tasks, create tasks | [tasks.md](references/tasks.md) |
| Implement task, build, execute | [implement.md](references/implement.md) |
| Validate, verify, test | [validate.md](references/validate.md) |
| Quick fix, quick task, small change | [quick-mode.md](references/quick-mode.md) |

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
