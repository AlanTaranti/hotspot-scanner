# STATE — @vitals/hotspot-scanner

Persistent memory for decisions, blockers, and lessons across sessions.

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-21 | **Vitest** over Jest (IMPL §9 cites Jest) | Already in `package.json`; no reason to switch |
| 2026-07-21 | Default `--since`: **12 months** (proposed, pending IMPL clarification) | Aligns with large-repo scenario; user must see window in output |
| 2026-07-21 | Raw **commit count** for churn (not relative code churn) | Closed decision per IMPL §14.5 |
| 2026-07-21 | **McCabe** implementation owned by project | ts-morph for AST only; no abandoned complexity packages |
| 2026-07-21 | Exit code **0** on successful scan (no fail thresholds in v1) | IMPL §6.2 non-goal for CI gate |
| 2026-07-21 | Cursor tooling adapted from vitals-arch workflow | Keep `vitals-*` skill names; retarget domain to hotspot-scanner |

## Blockers

_None._

## Lessons

- IMPL §9 Jest vs repo Vitest: document in TESTING.md, do not silently diverge.

## Deferred

- `--top` and `--min-cochange` default values (IMPL §16 open questions)
- Worker-thread parallelization for large repos
- npm private registry vs Git install distribution
