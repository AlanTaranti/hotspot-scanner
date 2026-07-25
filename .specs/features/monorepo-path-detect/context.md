# Milestone 43 — Monorepo Path Detect Context

**Feature slug:** `monorepo-path-detect`  
**Captured:** 2026-07-24  
**Trigger:** ROADMAP M43 + planner lock (parent session)  
**Depth:** Medium–Large (full Specify → Design → Tasks)

---

## Decision: Nested-path remount heuristic (LOCKED)

**Question:** What happens when the user runs `scan` with path `.` / cwd (or an explicit path) that is **not** a git root but lies inside a git workspace (e.g. `packages/api`)?

**Choice — remount + auto-include:**

| Step | Behavior |
| ---- | -------- |
| 1 | Resolve the user path to an absolute directory (`requestPath`) |
| 2 | Detect git toplevel via `git -C <requestPath> rev-parse --show-toplevel` (preferred; handles worktrees / `.git` file) |
| 3 | Set pipeline `repoPath` = that toplevel (git root) |
| 4 | Compute posix-relative prefix: `relative(gitRoot, requestPath)` (e.g. `packages/api`) |
| 5 | Unless the user **already passed CLI `--include`**, auto-apply include pattern `{prefix}/**` (e.g. `packages/api/**`) |
| 6 | Validate `.git` / mine / discover / enrich against the **git root** `repoPath` |

**Unchanged:**

- Explicit absolute/relative path that **is** the git root → no remount, no auto-include (today’s behavior)
- Explicit path to a nested package directory → same remount + auto-include heuristic as cwd
- Programmatic `runScan({ repoPath })` uses the **same** heuristic (library/CLI parity)

**Status:** **Confirmed — planner locked (user query)**

---

## Decision: Git root detection method (LOCKED)

**Choice:** Primary = `git rev-parse --show-toplevel` with `-C requestPath` (or equivalent `cwd`).

| Outcome | Behavior |
| ------- | -------- |
| Command succeeds | Use trimmed stdout as git root (normalize absolute) |
| Command fails / not a git work tree | Fail with the same class of error as today (`repoPath is not a git repository` or equivalent) — **do not** invent a non-git scan path |
| Optional fallback | Walking parents for a `.git` entry is allowed as a **fallback only** if implementers need it for tests without spawning git; production path prefers `rev-parse` for worktree correctness |

**YAGNI:** No bare-repo special case; no submodule graph walking beyond whatever `rev-parse` returns for the given cwd.

**Status:** **Confirmed**

---

## Decision: Auto-include vs config `include` (LOCKED)

**Question:** Does config-file `include` suppress auto-include?

**Choice:** Auto-include is suppressed **only** when CLI `--include` was explicitly passed (`getOptionValueSource === "cli"` / `ScanOptions.include !== undefined` for programmatic callers).

- When remounting and CLI did **not** pass `--include`, inject `{prefix}/**` as a **CLI-level** include (beats config `include` via existing `mergeScanOptions` precedence).
- Rationale: invoking from a package directory expresses “scope to this package”; a workspace config `include` must not widen the scan back to the whole monorepo by accident.
- To use config `include` without auto-scope: scan from the git root, or pass `--include` explicitly.

**Status:** **Confirmed**

---

## Decision: Config discovery path (LOCKED)

**Choice:** `loadHotspotScannerConfig` / bin pre-merge for `top` continue to start discovery from the **original user `requestPath`** (M30 parent walk). Remount affects only the pipeline `repoPath` (git validity, miner, discovery, enrich).

| Load | Starts from |
| ---- | ----------- |
| Config walk / `--config` | Original `requestPath` (unchanged M30 semantics) |
| `validateGitRepository` + stages | Remounted git root |

**Rationale:** Keeps bin and `runScan` config loads aligned; nearest `.hotspot-scanner.json` from the package cwd still wins; M30 walk-above-git-root still works.

**Status:** **Confirmed**

---

## Decision: Diagnostics (LOCKED)

**Choice:** When remount + auto-include apply, emit one structured `ScanWarning` (severity `info`) with a stable code so stderr/docs can explain the heuristic.

| Field | Value |
| ----- | ----- |
| `code` | `MONOREPO_PATH_REMOUNT` |
| `severity` | `info` |
| `message` | Human-readable: git root used + include pattern applied (include pattern text when auto-include ran) |

When remount happens but CLI `--include` was set (no auto-include), still emit the warning noting remount to git root without claiming auto-include.

When no remount (path is git root): **no** warning.

**Status:** **Confirmed**

---

## Decision: YAGNI cuts (LOCKED)

| Candidate | Why cut |
| --------- | ------- |
| Parse `pnpm-workspace.yaml` / `package.json` workspaces | Heuristic is path-only |
| nx / turborepo / lerna special cases | Out of scope |
| Scanning without git | Explicitly out of scope |
| Changing `DEFAULT_EXCLUDE_PATTERNS` | M30 owns excludes |
| Changing CLI > config > defaults merge rules | Precedence unchanged; auto-include is synthetic CLI include |
| `--no-remount` / disable flag | YAGNI — user can pass git root + `--include` |
| Rewriting PathScope semantics | Reuse existing `createPathScope` |

**Status:** **Confirmed**

---

## Related closed decisions (do not reopen)

| Source | Decision |
| ------ | -------- |
| M7 | `repoPath` must be a git repo; include narrows; exclude wins; defaults always on |
| M21 / M30 | CLI > config > defaults; `.hotspot-scanner.json` only; parent walk + `--config` |
| M30 context | Explicitly deferred “scan-from-package without `.git`” → this milestone |
| AGENTS.md | Gate `pnpm build && pnpm test` |
