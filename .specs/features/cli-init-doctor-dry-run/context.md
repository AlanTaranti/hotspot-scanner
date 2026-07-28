# Milestone 39 — CLI Init / Doctor / Dry-run Context

**Feature slug:** `cli-init-doctor-dry-run`  
**Captured:** 2026-07-24  
**Trigger:** ROADMAP M39 + planner lock (parent session)  
**Depth:** Large  
**IDs:** HOTSPOT-470–489 | **Items:** 3, 4, 26

---

## Feature Boundary

Ship three adoption DX entry points: `init` (exemplar config), `doctor` (environment/repo health), and `scan --dry-run` (scope preview without full pipeline). Reuse M21/M30 config discovery/merge and M7/M30/M36 discovery/path scope. Do not change PathScope defaults, M38 polish flags, or M40 workflow subcommands.

---

## Decision: Doctor exit policy (LOCKED)

**Question:** When should `doctor` exit non-zero vs warn and exit 0?

**Choice:** **Hard failures exit non-zero; soft issues warn and exit 0.** Invalid config is a hard failure (same class as scan).

| Check                                                                          | Severity                  | Exit when failing alone             |
| ------------------------------------------------------------------------------ | ------------------------- | ----------------------------------- |
| Node runtime does not satisfy `package.json` `engines.node` (`>=22`)           | **Hard**                  | Non-zero (`1`)                      |
| `git` executable not found on `PATH`                                           | **Hard**                  | Non-zero (`1`)                      |
| Target path missing / not a directory                                          | **Hard**                  | Non-zero (`1`)                      |
| Target path is not a git repository (`<path>/.git` absent)                     | **Hard**                  | Non-zero (`1`)                      |
| Config file found but invalid JSON / invalid key types (M21/M30 rules)         | **Hard**                  | Non-zero (`2`, `ConfigError` class) |
| Explicit `--config` path missing/unreadable                                    | **Hard**                  | Non-zero (`2`, `ConfigError`)       |
| No `.hotspot-scanner.json` on discovery walk                                   | **Soft**                  | Exit `0` + warning/info line        |
| No `tsconfig.json` / `jsconfig.json` under target (nearest walk informational) | **Soft**                  | Exit `0` + informational line       |
| Config found and valid                                                         | Pass                      | —                                   |
| tsconfig/jsconfig found                                                        | Pass (info: path printed) | —                                   |

**Aggregate exit:** If any hard check fails → non-zero (prefer `2` when the only hard failure is config-class; otherwise `1`). Soft issues never flip a green run to non-zero. Multiple hard failures: still non-zero; print all findings before exit.

**Rationale:** Matches user lock (“non-zero on hard failures (no git/node)”) and keeps doctor aligned with scan for broken config so operators do not get a false green.

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-477–484, doctor tasks.

---

## Decision: Init path defaults (LOCKED)

**Question:** Where does `init` write, and what does the optional path mean?

**Choice:**

| Invocation                                            | Write target                                                          |
| ----------------------------------------------------- | --------------------------------------------------------------------- |
| `hotspot-scanner init`                                | `<cwd>/.hotspot-scanner.json`                                         |
| `hotspot-scanner init <dir>`                          | `<dir>/.hotspot-scanner.json` (`<dir>` must exist and be a directory) |
| `hotspot-scanner init --force` / `init <dir> --force` | Same targets; overwrite allowed                                       |

**Rules:**

1. Filename is always **`.hotspot-scanner.json`** (M21 lock — never `.hotspotrc`).
2. Optional argument is a **directory**, not an arbitrary file path. Reject non-directories with `CliUsageError` (exit `2`).
3. If the target file already exists and `--force` is absent → **do not overwrite**; exit non-zero (`2`) with a clear message suggesting `--force`.
4. With `--force`, overwrite the existing file with the exemplar.
5. Success → write UTF-8 JSON + trailing newline; print a one-line confirmation to stdout (path written); exit `0`.

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-470–476, init tasks.

---

## Decision: Exemplar config contents (LOCKED)

**Question:** What keys/values does the exemplar contain?

**Choice:** Valid JSON object with **all** supported config keys (M21 + M28 `concurrency`), using documented defaults / empty arrays as examples. No `_comment` keys. Unknown keys not included.

| Key           | Exemplar value                                                                                                          | Notes                                                                                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `since`       | `"12 months ago"`                                                                                                       | Matches `DEFAULT_SINCE`                                                                                                                                 |
| `include`     | `[]`                                                                                                                    | Empty = no include narrow                                                                                                                               |
| `exclude`     | `[]`                                                                                                                    | Additive user excludes (defaults always on)                                                                                                             |
| `granularity` | `"file"`                                                                                                                |                                                                                                                                                         |
| `minCochange` | `3`                                                                                                                     | Matches `DEFAULT_MIN_COCHANGE`                                                                                                                          |
| `top`         | `20`                                                                                                                    | Matches `DEFAULT_TOP`                                                                                                                                   |
| `concurrency` | omit **or** document as optional — **include** with a positive integer comment-free value equal to a stable placeholder | Prefer **omit `concurrency`** from exemplar so hosts keep `DEFAULT_WORKER_CONCURRENCY` (`min(availableParallelism(), 8)`); operators add it when needed |

**Locked refinement:** Exemplar includes the six keys that are always meaningful as static defaults (`since`, `include`, `exclude`, `granularity`, `minCochange`, `top`). **Omit `concurrency`** from the written exemplar (still a supported config key; README notes how to add it). Pretty-print with 2-space indent.

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-474.

---

## Decision: Doctor path + config flags (LOCKED)

**Question:** How does `doctor` choose the target path and config?

| Invocation                      | Target          |
| ------------------------------- | --------------- |
| `hotspot-scanner doctor`        | `process.cwd()` |
| `hotspot-scanner doctor <path>` | `<path>`        |

Optional `--config <file>`: same semantics as M30 scan — explicit load, skip walk; missing → `ConfigError`. Without `--config`, parent-walk discovery from the doctor target path (nearest `.hotspot-scanner.json` wins).

**Status:** **Confirmed — planner locked**

---

## Decision: Dry-run preview contract (LOCKED)

**Question:** What does `scan --dry-run` print, and what does it skip?

**Choice:** Human-readable **text preview on stdout** (not JSON/table report). Always text regardless of `--format`.

**Must print (effective merged values):**

1. Target `repoPath`
2. Effective `since`
3. Effective `include` (empty → show as none / `[]`)
4. Effective `exclude` — **user/config exclude only** (additive); note that built-in default excludes always apply (do not dump the full default list unless cheap — one line “default excludes: always on”)
5. Eligible source file **count** (from `discoverSourceFiles` + `createPathScope` with merged include/exclude)
6. Effective `concurrency` (merged; default `DEFAULT_WORKER_CONCURRENCY`)

**Must NOT run:** Git Change Miner (`git log` mine), Complexity Analyzer (AST/workers), scoring, coupling enrich, reporter rankings, baseline compare.

**Still runs:** Path validation + git-repo check (same as scan prelude), config load/merge (M21/M30), PathScope build, `discoverSourceFiles` (may use `git ls-files` — inventory only, not history mining).

**Flag interactions:**

| Flag with `--dry-run`                                                                    | Behavior                                                               |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `--baseline`                                                                             | **Reject** — `CliUsageError` (meaningless with dry-run)                |
| `--format` / `--output`                                                                  | **Ignored** for preview (no error); preview stays plain text on stdout |
| Scope/config flags (`--since`, `--include`, `--exclude`, `--config`, `--concurrency`, …) | Applied to merge/preview as in a normal scan                           |

**Exit:** `0` on successful preview; config/path/git failures use the same exit classes as scan (`ConfigError` → `2`, other → `1`).

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-485–489.

---

## Decision: Domain vs bin boundary (LOCKED)

**Choice:** Keep domain logic out of `bin/`:

| Concern          | Module                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Exemplar + write | `src/config/` (e.g. `exemplar.ts` / `write-init.ts`)                                                                                        |
| Doctor checks    | New `src/doctor/`                                                                                                                           |
| Scope preview    | New `src/scan-preview.ts` (or small export beside `resolveScanConfig`) — **prefer separate file** to avoid growing fragile `runScan` wiring |
| Commander wiring | `bin/hotspot-scanner.ts` only                                                                                                               |

**Status:** **Confirmed — planner locked**

---

## Related closed decisions (do not reopen)

| Source    | Decision                                                         |
| --------- | ---------------------------------------------------------------- |
| M21       | Filename only `.hotspot-scanner.json`; CLI > config > defaults   |
| M30       | Parent walk + `--config`; invalid → `ConfigError`                |
| M7        | Default excludes always on; exclude additive; include narrows    |
| M36       | `discoverSourceFiles` prefers `git ls-files` + walk fallback     |
| M38       | Polish flags/aliases — **do not depend**; M39 works without them |
| M40       | Workflow subcommands — out of scope                              |
| AGENTS.md | Gate `pnpm build && pnpm test`; no npm publish                   |

---

## Deferred / out of scope notes

- Interactive init wizard / prompts
- JSON Schema file for config validation in doctor
- Doctor fixing issues automatically
- Changing default PathScope patterns
- `npx` / npm publish install path
