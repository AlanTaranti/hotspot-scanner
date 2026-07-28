# State Management

**Purpose:** Persistent memory across sessions — decisions, blockers, learnings, open deferred.

**Editorial contract:** [.cursor/rules/state-sot.mdc](../../../rules/state-sot.mdc) — lasting locks only; never append Execute-complete / Specs Planned / gate-count changelog rows. Chronological dumps → [STATE-ARCHIVE.md](../../../../.specs/project/STATE-ARCHIVE.md).

**Live shape (this repo):** header (`Last Updated` / `Current Work`) → Active → Blockers → Deferred → Decisions (table of lasting locks) → ADRs → Alternatives → Lessons. See [STATE.md](../../../../.specs/project/STATE.md).

## Structure

**Output:** `.specs/project/STATE.md`

```markdown
# State

**Last Updated:** [ISO timestamp]
**Current Work:** [Feature name] - [Task identifier]

---

## Recent Decisions (Last 60 days)

### AD-[NNN]: [Decision title] ([date])

**Decision:** [What was decided]
**Reason:** [Why this choice]
**Trade-off:** [What was sacrificed]
**Impact:** [How this affects implementation]

### AD-[NNN]: [Decision title] ([date])

[Same structure]

---

## Active Blockers

### B-[NNN]: [Blocker description]

**Discovered:** [Date]
**Impact:** [Severity and scope]
**Workaround:** [Temporary solution if available]
**Resolution:** [Path to permanent fix]

---

## Lessons Learned

### L-[NNN]: [Learning description]

**Context:** [Situation that occurred]
**Problem:** [What went wrong]
**Solution:** [How it was resolved]
**Prevents:** [What this knowledge prevents in future]

---

## Quick Tasks Completed

| #   | Description              | Date   | Commit | Status  |
| --- | ------------------------ | ------ | ------ | ------- |
| 001 | [Quick task description] | [date] | [hash] | ✅ Done |

---

## Deferred Ideas

Ideas captured during work that belong in future features or phases. Prevents scope creep while preserving good ideas.

- [ ] [Idea description] — Captured during: [feature/phase]
- [ ] [Idea description] — Captured during: [feature/phase]

---

## Todos

Capture in-progress thoughts and action items that don't fit in active tasks.

- [ ] [TODO: action item]
- [ ] [TODO: action item]
```

## When to Update

| Event                            | Action                                 |
| -------------------------------- | -------------------------------------- |
| Significant architectural choice | Add lasting Decision / ADR row (not `M## Execute complete`) |
| Implementation blocked           | Add blocker                            |
| Important discovery/learning     | Add Lesson                             |
| Quick task completed             | Add row to Quick Tasks table (if used) |
| Scope creep captured             | Add to Deferred (open items only)      |
| In-progress thought              | Add to Todos (if used)                 |
| Session end                      | Update "Last Updated" + "Current Work" / Active |
| Milestone Done with no new lock  | **Do not** append STATUS rows — ROADMAP only |

## Size Management (Hybrid Strategy)

**Zones:**

- 🟢 <7k tokens: No action
- 🟡 7-10k tokens: Footer note "STATE.md at [X]k. Cleanup recommended."
- 🔴 >10k tokens: Active prompt "STATE.md critical ([X]k). Cleanup now?"

**Cleanup process:**

- Move chronological execute/decision dumps to STATE-ARCHIVE.md
- Keep only active blockers and open Deferred
- Preserve recent learnings (<60 days)

**Validation:**

- Decisions have clear rationale?
- Blockers include resolution path?
- Learnings are actionable?
- No execute-log voice (state-sot / `lintStateDoc`)?

---

## Preferences

Track user-facing behavioral state in STATE.md:

```markdown
## Preferences

**Model Guidance Shown:** [ISO date or "never"]
```

**Update when:**

| Event                       | Action                   |
| --------------------------- | ------------------------ |
| First model tip given       | Set date                 |
| User acknowledges/dismisses | Keep date (don't repeat) |

This prevents repetitive suggestions while maintaining natural, helpful behavior.
