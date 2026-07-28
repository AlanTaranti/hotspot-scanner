# Cursor hooks — hotspot-scanner

Project hooks in [`.cursor/hooks.json`](../hooks.json) reinforce policies from [AGENTS.md](../../AGENTS.md), rules, and subagents.

Session state (gitignored): `.cursor/hooks-state/<conversation_id>.json`

State files older than **14 days** are pruned on `sessionStart`.

## Quick map

| Priority | Event | Script | Behavior |
|----------|--------|--------|----------|
| Critical | `beforeShellExecution` | `commit-policy.mjs` | Deny `git commit` without a user keyword (`commit`, `commite`, `comitar`, `versionar`); flag is sticky until a commit is allowed |
| Critical | `beforeShellExecution` | `gate-before-commit.mjs` | Deny `git commit` if code changed without a recent gate |
| Critical | `afterShellExecution` | `record-gate-pass.mjs` | Record `gatePassedAt` / `buildPassedAt` + `testPassedAt` after build and test |
| Critical | `subagentStop` | `subagent-stop.mjs` | Clear subagent state; follow-up for Phase E (quality gate) |
| High | `subagentStart` | `subagent-start.mjs` | Subagent state; **deny** orchestrator when Status is Draft/Planned |
| High | `preToolUse` | `pre-edit-guard.mjs` | Planner boundary; fragile `ask`; orchestrated ownership; ARCHITECTURE/CONCERNS/INTEGRATIONS/STACK/STRUCTURE/TESTING/PROJECT SoT `ask` on `M##`/`HOTSPOT-*`; CONVENTIONS SoT `ask` on `M##`; ROADMAP SoT `ask` on drift patterns (Artifacts/HOTSPOT/tasks dump; `M##` allowed); STATE SoT `ask` on execute-log drift (`Execute complete` / `Specs Planned` / etc.; `M##` allowed in locks) |
| High | `postToolUse` | `post-edit-guard.mjs` | Track edits + fragile / scoring / ARCHITECTURE/CONCERNS/INTEGRATIONS/STACK/STRUCTURE/TESTING/CONVENTIONS/PROJECT/ROADMAP/STATE SoT alerts |
| High | `afterFileEdit` | `track-edit.mjs` | Path tracking (fallback); absolute paths normalized to repo-relative |
| High | `stop` | `stop-gate-reminder.mjs` | Gate reminder when the agent stops |
| Medium | `sessionStart` | `session-context.mjs` | Inject ROADMAP + gate context; prune stale state |
| Medium | `beforeShellExecution` | `shell-guards.mjs` | Validate path on `hotspot-scanner scan` |
| Medium | `afterShellExecution` | `shell-guards.mjs` | Context on `pnpm test` failure |
| Medium | `preCompact` | `pre-compact.mjs` | Checkpoint at `.specs/.hooks-checkpoint.json` |

## Known limitations

- `sessionStart` / `postToolUse` `additional_context` may not reach the model on some Cursor versions. Primary enforcement: `preToolUse` (`deny`/`ask`) and `beforeShellExecution`.
- Edit tracking runs on `postToolUse` (Write/StrReplace/Delete/EditNotebook) and `afterFileEdit` (fallback).
- Gate accepts `pnpm build && pnpm test` in one command **or** separate `pnpm build` and `pnpm test` (both exit 0).
- Paths from Cursor are often absolute; hooks strip `workspace_roots[0]` before classifying code/fragile paths.

## Smoke tests

```bash
pnpm hooks:smoke
```

Requires write access to `.cursor/hooks-state/` (gitignored). Run after changing hooks.

## Debug

- **Hooks** panel in Cursor settings
- **Hooks** output channel
- Saving `hooks.json` reloads hooks; restart Cursor if they do not fire
