# Milestone 54 — CLI Adoption Extras Context

**Spec**: [`.specs/features/cli-adoption-extras/spec.md`](./spec.md)  
**Status**: Planned (planning session)  
**Captured:** 2026-07-24  
**Trigger:** ROADMAP M54 + planner lock (user query)  
**Depth:** Small  
**IDs:** HOTSPOT-840–859

All gray areas for M54 are closed below. No open `PENDENTE-DISCUSSÃO`.

---

## Decision: Completion approach = static scripts + `completion` subcommand (LOCKED)

**Question:** Commander.js has no native shell completion. Ship `@bomb.sh/tab` / Carapace, or static scripts?

**Choice:** **Static completion scripts** emitted by a new CLI subcommand — **no new runtime dependency**.

| Piece         | Behavior                                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------------- |
| Subcommand    | `hotspot-scanner completion <shell>`                                                                              |
| Shells        | Exactly **`bash`**, **`zsh`**, **`fish`** (case-sensitive argv)                                                   |
| Output        | Full completion script on **stdout**; exit `0`                                                                    |
| Invalid shell | `CliUsageError` (exit `2`) with hint listing allowed shells                                                       |
| Storage       | Script bodies live in `bin/` (e.g. `bin/completion-scripts.ts` or inline constants) — not a third-party generator |

**Rejected alternatives:**

| Approach                                                  | Why cut                                                                              |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `@bomb.sh/tab` / Carapace / other completion libs         | New runtime dep for Low/Small milestone; INTEGRATIONS.md bar not met                 |
| Ship-only files under `completions/` without a subcommand | Worse DX than `completion <shell>` (kubectl/gh pattern); docs alone are easy to miss |
| PowerShell / nushell                                      | Out of ROADMAP M54 shell list                                                        |

**Completion depth (MVP):**

- Top-level commands: `init`, `doctor`, `scan`, `baseline`, `compare`, `completion`
- Nested: `baseline save` (and any other shipped subcommands present at Execute time)
- Common **long** flags for `scan` / shared options (`--format`, `--output`, `--exclude`, `--include`, `--config`, `--since`, `--granularity`, `--top`, `--quiet`, `--dry-run`, `--baseline`, `--only`, `--explain`, etc.) — static list maintained next to the CLI
- **No** dynamic path / remote / config-file contents completion beyond what the shell script’s `_files` / path helpers already do for positional args (optional; YAGNI if script stays flag-oriented)

**Drift control:** Unit tests assert emitted scripts contain the locked command names and a representative flag set. When adding a major public flag later, update scripts + tests in the same change (living-doc note in ARCHITECTURE).

**Status:** **Confirmed**

**Applies to:** HOTSPOT-840–844

---

## Decision: `.hotspotignore` = REJECTED for M54 (LOCKED)

**Question:** Invent a `.hotspotignore` (gitignore-style) file format?

**Choice:** **Reject.** Do **not** implement, stub, or half-design `.hotspotignore` in M54.

**Prefer instead:**

1. Config key `exclude` in `.hotspot-scanner.json` (M21)
2. Repeatable CLI `--exclude <glob>` (additive on defaults — M7/M30)
3. Existing cookbooks in [`docs/recipes.md`](../../../docs/recipes.md) (monorepo / weekly triage already show `--exclude` / config `exclude`)

**Docs work in M54:** Explicit “there is no `.hotspotignore`” callout + pointer to recipes/config `exclude` in README and/or recipes (and ARCHITECTURE if exclude docs mention ignore files).

**Relation to sisters:**

| Sister                          | Note                                                                                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| path-config-dx (M30)            | Called `.hotspotignore` / `.gitignore` “Future” — **M54 upgrades to Rejected** for product v1 unless a later milestone reopens with proven need |
| scope-extensions-excludes (M48) | Owns extra **default artifact** excludes (`.turbo`, `.cache`, …) and `.mjs`/`.cjs` — **not** a new ignore-file format                           |
| exclude-tests-by-default (M46)  | Built-in test globs + `--include-tests` — orthogonal                                                                                            |

**Status:** **Confirmed — Rejected (not deferred)**

**Applies to:** HOTSPOT-845–846; Out of Scope in spec.md

---

## Decision: Module ownership (LOCKED)

| Area      | Owner                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------ |
| Primary   | `bin/hotspot-scanner.ts` + optional `bin/completion-scripts.ts` (or equivalent) + `bin/*.test.ts`      |
| Docs      | `README.md`, `docs/recipes.md`, `.specs/codebase/ARCHITECTURE.md` (CLI section), ROADMAP/STATE on Done |
| Forbidden | `src/paths/`, ranking, schemas, new config keys, PathScope behavior, new ignore-file loaders           |

**Status:** **Confirmed**

---

## Related closed decisions (do not reopen)

| Decision           | Value                                                                | Relevance                      |
| ------------------ | -------------------------------------------------------------------- | ------------------------------ |
| Exit codes         | 0 / 2 (usage+config) / 1 (else)                                      | `completion` invalid shell → 2 |
| Config filename    | `.hotspot-scanner.json` only (M21)                                   | No alternate ignore filename   |
| Exclude semantics  | Defaults always on; user exclude additive; exclude wins include (M7) | Document, do not change        |
| commander location | `bin/` only (INTEGRATIONS)                                           | Completion stays in bin        |
| npm publish        | Deferred                                                             | Out of scope                   |
