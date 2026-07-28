# State Management

**Purpose:** Persistent memory across sessions — lasting decisions, blockers, lessons, open deferred.

**Editorial contract (SoT):** [.cursor/rules/state-sot.mdc](../../../rules/state-sot.mdc) — lasting locks only; never append Execute-complete / Specs Planned / gate-count changelog rows. Chronological dumps → [STATE-ARCHIVE.md](../../../../.specs/project/STATE-ARCHIVE.md). Lint: `lintStateDoc`.

## Structure

**Output:** [`.specs/project/STATE.md`](../../../../.specs/project/STATE.md) — follow the **live shape of that file**; do not introduce new top-level sections.

| Order | Section                          | Content                                                                 |
| ----- | -------------------------------- | ----------------------------------------------------------------------- |
| 1     | Header                           | `Last Updated` (ISO date) + `Current Work` (or `None — see ROADMAP`)     |
| 2     | `## Active`                      | 1–3 lines pointing at current work; milestone status lives in ROADMAP    |
| 3     | `## Blockers`                     | Open blockers only, with impact + resolution path (`_None._` when empty) |
| 4     | `## Deferred`                     | Open ideas only — remove the row once the work is Done                   |
| 5     | `## Decisions`                    | Table of lasting product locks: Date · Decision · Rationale             |
| 6     | `## Architecture decisions (ADRs)` | Durable architectural locks                                             |
| 7     | `### Alternatives considered and rejected` | Closed options + why rejected                                  |
| 8     | `## Lessons`                      | Actionable learnings that prevent repeat mistakes                       |

Sections not in that list (quick-task logs, todo lists, preference flags, "recent decisions" windows) do **not** belong in STATE.md — see § Forbidden in [state-sot.mdc](../../../rules/state-sot.mdc).

## When to Update

| Event                            | Action                                                          |
| -------------------------------- | --------------------------------------------------------------- |
| Significant architectural choice | Add lasting Decision / ADR row (not `M## Execute complete`)     |
| Implementation blocked           | Add blocker with impact + resolution path                       |
| Important discovery/learning     | Add Lesson                                                      |
| Scope creep captured             | Add to Deferred (open items only)                               |
| Deferred item shipped            | Remove the Deferred row (status belongs in ROADMAP)             |
| Session end                      | Update `Last Updated` + `Current Work` / Active                 |
| Milestone Done with no new lock  | **Do not** touch STATE — [ROADMAP.md](../../../../.specs/project/ROADMAP.md) only |
| Quick task completed             | Nothing in STATE unless it produced a lasting lock/lesson — see [quick-mode.md](quick-mode.md) |

## Size Management (Hybrid Strategy)

**Zones:**

- 🟢 <7k tokens: No action
- 🟡 7-10k tokens: Footer note "STATE.md at [X]k. Cleanup recommended."
- 🔴 >10k tokens: Active prompt "STATE.md critical ([X]k). Cleanup now?"

**Cleanup process:**

- Move chronological execute/decision dumps to STATE-ARCHIVE.md
- Keep only open blockers and open Deferred
- Preserve actionable lessons

**Validation:**

- Decisions have clear rationale?
- Blockers include resolution path?
- Lessons are actionable?
- No execute-log voice (state-sot / `lintStateDoc`)?
- No sections beyond the live shape above?
