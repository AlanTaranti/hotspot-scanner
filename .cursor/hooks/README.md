# Cursor hooks — hotspot-scanner

Project hooks in [`.cursor/hooks.json`](../hooks.json) reinforce policies from [AGENTS.md](../../AGENTS.md), rules, and subagents.

Session state (gitignored): `.cursor/hooks-state/<conversation_id>.json`

State files older than **14 days** are pruned on `sessionStart`.

## Quick map

| Priority | Event | Script | Behavior |
|----------|--------|--------|----------|
| Critical | `beforeSubmitPrompt` | `commit-policy.mjs` | If the user prompt matches a commit keyword (`commit`, `commite`, `comitar`, `versionar`), set sticky `userAllowedCommit` |
| Critical | `beforeShellExecution` | `commit-policy.mjs` | Deny `git commit` when `userAllowedCommit` is unset; on allow, clear the flag — `failClosed` |
| Critical | `beforeShellExecution` | `gate-before-commit.mjs` | Deny `git commit` if code changed without a recent gate (`src/`, `bin/`, `scripts/`, `schemas/`, `vitest.config.ts` — not `tests/`-only) — `failClosed` |
| Critical | `afterShellExecution` | `record-gate-pass.mjs` | Record `gatePassedAt` / `buildPassedAt` + `testPassedAt` after build and test (matcher `pnpm (build\|test)`) |
| Critical | `subagentStop` | `subagent-stop.mjs` | Clear subagent state (no matcher — runs for **every** subagent); follow-up for Phase E (quality gate) |
| High | `subagentStart` | `subagent-start.mjs` | Subagent state; **deny** orchestrator when header Status is Draft/Planned |
| High | `preToolUse` | `pre-edit-guard.mjs` | Planner boundary (`deny` for `planner-feature`, `ask` for the main agent while a feature is Draft/Planned); fragile `ask`; orchestrated ownership; living-doc SoT `ask` via `LIVING_SOT_ENTRIES` (`.specs/codebase/*`, `.specs/project/*`, `AGENTS.md`, `CONTRIBUTING.md`, `README.md`, `docs/**`, `.cursor/skills/**`, `.cursor/agents/**`) |
| High | `postToolUse` | `post-edit-guard.mjs` | Track edits + fragile / scoring / living-doc SoT alerts |
| High | `afterFileEdit` | `track-edit.mjs` | Path tracking (fallback); absolute paths normalized to repo-relative |
| High | `stop` | `stop-gate-reminder.mjs` | Gate reminder when the agent stops |
| Medium | `sessionStart` | `session-context.mjs` | Inject ROADMAP + Planned/In Progress features + gate context; prune stale state |

## Shared lib

| Module | Owns |
|--------|------|
| `lib/paths.mjs` | Path classification (code / fragile / planner-blocked) + edit-payload extraction |
| `lib/state.mjs` | Per-conversation session state + gate freshness |
| `lib/feature-status.mjs` | `tasks.md` **header** Status parsing and feature scans (shared by `session-context`, `subagent-start`, `pre-edit-guard`) |
| `lib/living-sot-doc.mjs` | Barrel: living-doc lint API + `LIVING_SOT_ENTRIES` (impl in `living-sot-paths.mjs`, `living-sot-lints.mjs`, `living-sot-registry.mjs`) |
| `lib/live-sot-files.mjs` | Which live repo files each registry entry lints (used by smoke + Vitest) |
| `smoke/harness.mjs` | Smoke helpers (`runHook`, assert, feature fixtures) |
| `smoke/sot-samples.mjs` | Dirty/clean samples for living-doc lint cases |
| `smoke/cases.mjs` | Hand-written hook behavior cases |

## Wiring notes

- **`subagentStop` has no `matcher`.** It runs after every subagent so `activeSubagent` / `orchestrated` state is always cleared, even for non-implementer agents. The Phase E follow-up is filtered inside `subagent-stop.mjs` (`implementer|orchestrator-implementer`), not by the matcher.
- **Critical commit denies use `failClosed: true`.** If `commit-policy.mjs` or `gate-before-commit.mjs` crashes or times out, the `git commit` is blocked instead of silently allowed. Other hooks stay fail-open — a broken advisory hook must not stall the session.
- **Planning boundary for the main agent is `ask`, not `deny`,** so quick mode (≤3 files) can proceed after confirmation. It fires once per session: `post-edit-guard` sets `planningBoundaryAcked` after the first `src`/`bin`/`tests` edit.
- Only the **first** `Status:` line of a `tasks.md` counts. Handoff prose further down (`**Status: Planned**`) no longer masks a promoted header.

## SoT prose vs hook lint

Glob-scoped `*-sot.mdc` rules are the full editorial guidance. Hooks enforce a **regex subset** (e.g. `M##`, `HOTSPOT-*` where banned, ROADMAP/STATE/CONTRIBUTING/README drift patterns, foreign requirement IDs / gate tiers / nonexistent tooling in skills and agent roles). Prose-only violations without a matching tag are **not** machine-checked — rely on agent discipline + review.

## Known limitations

- `sessionStart` / `postToolUse` `additional_context` may not reach the model on some Cursor versions. Primary enforcement: `preToolUse` (`deny`/`ask`) and `beforeShellExecution`. Soft session reminders (including Planned-feature warnings) are best-effort.
- Edit tracking runs on `postToolUse` (Write/StrReplace/Delete/EditNotebook) and `afterFileEdit` (fallback).
- Gate accepts `pnpm build && pnpm test` in one command **or** separate `pnpm build` and `pnpm test` (both exit 0).
- Paths from Cursor are often absolute; hooks strip `workspace_roots[0]` before classifying code/fragile paths.

## Smoke tests

```bash
pnpm hooks:smoke
```

Requires write access to `.cursor/hooks-state/` (gitignored). Run after changing hooks.

Living-doc lint cases are generated from `LIVING_SOT_ENTRIES`: adding a registry entry without a `SOT_SAMPLES` case fails the smoke run. The same registry is asserted against live files by `tests/living-sot-docs.test.ts`, so doc drift also fails the project gate ([quality-gates.mdc](../rules/quality-gates.mdc)).

## Debug

- **Hooks** panel in Cursor settings
- **Hooks** output channel
- Saving `hooks.json` reloads hooks; restart Cursor if they do not fire
