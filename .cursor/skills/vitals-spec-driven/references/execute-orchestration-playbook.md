# Execute Orchestration Playbook

**Used by:** `orchestrator-implementer`.

**Goal:** Coordinate implementation of approved `tasks.md` by delegating tasks, code review, acceptance verification, quality gates, and syncing ROADMAP — returning a consolidated Execution Orchestration Report to the main agent.

**Phases:** **A → F** (Intake → Execute → Code review → Acceptance → Quality gate → Sync)

**Input:** Approved `tasks.md` in `.specs/features/<slug>/` (single feature or batch).

**Subagent contract:** [orchestrated-implementer.md](orchestrated-implementer.md).

---

## Input modes

| Mode                 | Input                                                            | Behavior                                                        |
| -------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------- |
| **Single (default)** | `featureSlug` or path to `tasks.md` + optional `tasks: [T1, T3]` | One feature per run                                             |
| **Batch (optional)** | `[{ feature: slug, tasks?: [Tn] }, ...]`                         | Order features by cross-feature deps; parallel when independent |

If `tasks` is omitted, execute all incomplete tasks in dependency order.

---

## Phase A — Intake and validation

For each feature in scope:

1. Read `tasks.md`, `design.md`, `spec.md`, `context.md`.
2. Validate **Status** is executable (`Approved`, `Ready for Execute`, `In Progress`, partial resume) — **block** if `Draft` or `Planned` only.
3. Detect format:
   - **Granular** (T1, T2, Execution Plan) → proceed
   - **Legacy checkbox** → report `REFRESH_REQUIRED` via `planner-feature`; do not execute
4. Parse task graph: `Depends on`, `[P]` flags, Execution Plan, `Where` paths.
5. Filter to requested task IDs (if subset provided).
6. Build routing table (Phase B) for all tasks in scope.
7. **Batch only:** merge per-feature graphs into a **unified task graph** and compute the **wave schedule** before delegating any task. Order by cross-feature dependencies (ROADMAP, `design.md`, explicit `tasks.md` mentions) — not alphabetically by slug.

Set feature Status to `In Progress` in `tasks.md` when starting first task (if not already).

---

## Phase B — Execute by waves

**Routing:** [implementer-routing.md](implementer-routing.md).

**Delegation:** `implementer` subagent (`subagent_type: implementer`) with `orchestrated: true` and minimum prompt below. Use `fixture-builder` when the task is fixture-only or an implementer reports Blocked (missing fixture). Skill: [task-implementer/SKILL.md](../../task-implementer/SKILL.md). Contract: [orchestrated-implementer.md](orchestrated-implementer.md).

**Wave algorithm:**

```
waves = computeWaves(taskGraph)          // deps satisfied per wave
for wave in waves:
  batch = filterParallelSafe(wave.tasks) // disjoint paths + test-safe
  launch Task(implementer|fixture-builder) for each task in batch  // single message, N calls
  await all
  update tasks.md checkboxes
  if any Blocked or Partial → stop or report under Open items
```

**Rules:**

- **One task per subagent invocation**; multiple invocations in the same wave run **in parallel** (one `Task` call per task, all launched in a single message).
- Gate-final tasks (`deferred_project_gate`: project-wide `pnpm build && pnpm test`) → **exclude from Phase B**; execute only in Phase E.
- **Default to wave parallelism** when path-disjoint and test-safe per TESTING.md; `[P]` is a planner signal — the orchestrator may infer safety via Path Conflict Check / module map when `[P]` is absent.
- Do not parallelize tasks that edit the same file or both touch `src/scan.ts` / `bin/hotspot-scanner.ts` wiring.
- On `Blocked` or `SPLIT_REQUIRED` → report under Open items; do not mark Complete.
- Update `tasks.md` checkboxes after each wave completes.

**Batch mode:** Independent features share the same wave pool. A task from feature A and a task from feature B may run in the same wave when their paths are disjoint and dependencies are satisfied — e.g. `doctor-color-ux` T1 (`src/report/`) + `growth-pattern-trend-bridge` T1 (`src/trend/`) in Wave 1.

**Minimum prompt to implementer:**

```
orchestrated: true
Feature: [slug]
Task: [Tn — title]
Read: [spec.md paths, design.md sections, context.md if needed]
Implement per tasks.md fields: What, Where, Reuses, Done when, Tests, Gate
Skill: .cursor/skills/task-implementer/SKILL.md
Contract: .cursor/skills/vitals-spec-driven/references/orchestrated-implementer.md
Do NOT edit tasks.md or ROADMAP.md
```

---

## Phase C — Code review (mandatory)

Delegate to `code-reviewer` (`readonly: true`) with consolidated file list from Phase B.

**Batch mode:** When Phase B is complete for multiple independent features, delegate one `code-reviewer` per feature **in parallel** (single message, N calls). Await all before Phase D.

**Minimum prompt:**

```
Feature: [slug]
Tasks: [T1–Tn]
Files changed: [consolidated list from Phase B]
Read: .specs/codebase/CONVENTIONS.md, INTEGRATIONS.md
Focus: conventions, mock boundaries, surgical diffs, fragile areas if touched
```

**Block Phase D if verdict = Changes needed.**

Optional remediation: **max 1 round** — re-delegate failed tasks in Phase B, then re-run Phase C.

---

## Phase D — Implementation verification

Delegate to `verifier-implementation` (`readonly: true`) with:

- Feature slug
- Tasks implemented (T1–Tn)
- Consolidated file list from Phase B returns

**Batch mode:** When Phase C passed for multiple features, delegate one `verifier-implementation` per feature **in parallel** (single message, N calls). Await all before Phase E.

**Block Phase E if verdict = NOT_READY.**

Optional remediation: **max 1 round** — re-delegate failed tasks, then re-run Phase D.

---

## Phase E — Quality gate

**Single project gate** — run once for the whole batch, not per feature.

1. Invoke `verifier-quality-gates` (or run directly):

```bash
pnpm build && pnpm test
```

2. If **PASS** → proceed to Phase F.
3. If **FAIL** → optional remediation (max 1 round), then re-run Phase E.

---

## Phase F — Sync

**tasks.md ownership:** only **this orchestrator** updates checkboxes, task Status, and [ROADMAP.md](../../../../.specs/project/ROADMAP.md). See [roadmap-sync.md](roadmap-sync.md).

When Phase C = Approved (or Approved with caveats), Phase D = READY (or ISSUES with user approval), and Phase E = PASS:

1. Set `tasks.md` Status → `Done`
2. Sync ROADMAP milestone/feature entry
3. Living docs: if pipeline / module / contract / constraint changed → sync [ARCHITECTURE.md](../../../../.specs/codebase/ARCHITECTURE.md) in present tense (no `M##` / `HOTSPOT-*`; see [architecture-sot.mdc](../../../rules/architecture-sot.mdc)). If fragile risks / mitigations changed → sync [CONCERNS.md](../../../../.specs/codebase/CONCERNS.md) in present tense (no `M##` / `HOTSPOT-*`; see [concerns-sot.mdc](../../../rules/concerns-sot.mdc)). Else skip those files — do not append UX encyclopedias or milestone provenance. Self-check: sentence needs a milestone number → wrong doc.
4. Return Execution Orchestration Report

---

## Execution Orchestration Report template

```
## Execution Orchestration Report

- Feature(s): [slug(s)]
- Tasks executed: [T1–Tn]
- Phase C code review: [Approved | Approved with caveats | Changes needed]
- Phase D acceptance: [READY | ISSUES | NOT_READY]
- Phase E gate: [PASS | FAIL]
- Phase F determinism: [DETERMINISTIC | NON_DETERMINISTIC | N/A]

### Task results

| Task | Status | Gate | Notes |
| ---- | ------ | ---- | ----- |
| T1   | Complete | PASS | ... |

### Files changed (consolidated)

- [list]

### Open items

- [blocked tasks, NOT_READY items, SPLIT_REQUIRED]

### Docs sync

- tasks.md: [Done | In Progress]
- ROADMAP.md: [updated | skipped]

### Main agent handoff

- [ ] User may commit (propose Conventional Commit message; commit only on request)
- [ ] Remaining work: [if any]
```

---

## Main agent handoff

Return the report above. The main agent:

- Communicates results to the user
- Proposes commit message if gates passed
- Does **not** re-run full orchestration unless user requests

---

## Hard constraints

- Do not write implementation code directly except unblocker fixes during remediation.
- Do not run `git commit` / `git push` unless user explicitly asks.
- Do not mark Done with failing Phase E, Phase D NOT_READY, or Phase C Changes needed.
- YAGNI: see [AGENTS.md](../../../../AGENTS.md) § YAGNI and [vitals-project.md](vitals-project.md).
