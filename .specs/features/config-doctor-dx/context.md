# Milestone 64 — Config and Doctor DX Context

**Feature slug:** `config-doctor-dx`  
**Milestone:** ROADMAP M64 (planning ahead of ROADMAP/STATE sync — intentionally not edited this session)  
**Captured:** 2026-07-26  
**Depth:** Large  
**IDs:** HOTSPOT-1100–1139 (1136–1139 reserved)  
**Sisters:** M21 `config-file`, M30 `path-config-dx`, M39 `cli-init-doctor-dry-run`, M52 `doctor-scope-parity`, M55 `api-trust-docs` (unknown keys)

---

## Feature Boundary

Improve config/doctor/dry-run adoption DX without changing PathScope defaults, scan ranking, or JSON result contract `version: "3.0"`:

1. Richer `init` exemplar (`$schema`, comments, realistic globs)
2. Config JSON Schema + package `"exports"` for schemas
3. `config validate` / `config print` subcommands
4. Dry-run prelude enrichment (config path, remount, unknown keys)
5. Doctor `--since` preflight (soft vs hard)

Domain logic stays in `src/config/`, `src/scan-preview.ts`, `src/doctor/`, `src/git/` (since probe). `bin/` wires only.

---

## Decision: Reserved meta keys (LOCKED)

**Question:** How should `$schema` / `$comment` / `$comments` interact with parse, merge, and `UNKNOWN_CONFIG_KEY`?

**Choice:** Treat as **reserved meta keys**.

| Rule             | Behavior                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------ |
| Parse            | Strip / skip — **not** copied into `HotspotScannerConfig`                                  |
| Merge            | Never become ScanOptions fields                                                            |
| Unknown-key warn | **Do not** include in `unknownKeys` / `UNKNOWN_CONFIG_KEY` (ignore silently for warn spam) |
| Document         | README + config schema describe them as reserved meta                                      |

**Reserved set (exact):** `$schema`, `$comment`, `$comments`.

**Status:** **Confirmed — planner locked (parent mission)**

**Applies to:** HOTSPOT-1100, HOTSPOT-1101, HOTSPOT-1134.

**Supersedes:** M39 context wording “No `_comment` keys” for the exemplar; M55 still warn-only for true unknown keys (non-meta).

---

## Decision: Richer init exemplar (LOCKED)

**Question:** What does `hotspot-scanner init` write?

**Choice:** Valid JSON with:

| Field         | Value                                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `$schema`     | `"https://raw.githubusercontent.com/AlanTaranti/hotspot-scanner/main/schemas/hotspot-scanner-config.json"` (same `$id` family as scan/compare schemas)                   |
| `$comments`   | string array with short human hints (include/exclude semantics, omit concurrency, CLI > config > defaults) — **prefer array** over single `$comment` in the written file |
| `since`       | `"12 months ago"` (`DEFAULT_SINCE`)                                                                                                                                      |
| `include`     | **Non-empty realistic example** — e.g. `["src/**"]` (not `[]`-only)                                                                                                      |
| `exclude`     | **Non-empty realistic example** — e.g. `["**/*.generated.ts"]` (additive; defaults still always on)                                                                      |
| `top`         | `20` (`DEFAULT_TOP`)                                                                                                                                                     |
| `concurrency` | **Omit** (carry M39 lock — hosts keep `DEFAULT_WORKER_CONCURRENCY`)                                                                                                      |

Also accept `$comment` (string) as reserved if operators paste it — reserved, not exemplar-required.

Pretty-print: 2-space indent + trailing newline. Overwrite rules unchanged (refuse without `--force` → exit `2`).

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-1102–1106.

---

## Decision: Config JSON Schema + package exports (LOCKED)

**Question:** Schema file location and how consumers import schemas?

**Choice:**

1. New file: `schemas/hotspot-scanner-config.json`
2. `$id`: `https://raw.githubusercontent.com/AlanTaranti/hotspot-scanner/main/schemas/hotspot-scanner-config.json`
3. Describes known scan keys (`since`, `include`, `exclude`, `top`, `concurrency`) with types/constraints aligned to `parseHotspotScannerConfig`
4. Documents reserved meta (`$schema`, `$comment`, `$comments`) as optional; `additionalProperties: true` (or equivalent) so forward-compat unknown keys remain schema-valid while runtime still warns via M55
5. Add `package.json` `"exports"` subpaths for **all three** schemas:

| Export                                  | Target                                  |
| --------------------------------------- | --------------------------------------- |
| `./schemas/scan-result.json`            | `./schemas/scan-result.json`            |
| `./schemas/compare-result.json`         | `./schemas/compare-result.json`         |
| `./schemas/hotspot-scanner-config.json` | `./schemas/hotspot-scanner-config.json` |

Keep existing `"."` entry. `schemas/` already in `"files"`.

**Supersedes M55 “single `.` export only”** for **schema JSON subpaths only** (not new JS API subpaths).

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-1107–1110.

---

## Decision: `config validate` / `config print` (LOCKED)

**Question:** Subcommand shape, exit codes, print format?

### Commands

| Invocation                               | Behavior                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hotspot-scanner config validate [path]` | Validate file: optional `[path]` = config file path **or** directory (then discover `.hotspot-scanner.json` with M30 walk from that dir / cwd). Invalid JSON/types → exit **`2`**. Valid → exit **`0`** (+ short stdout confirmation). Missing discovery (no file) → exit **`2`** with clear message (validate is explicit about needing a file). Explicit missing file → **`2`**. |
| `hotspot-scanner config print [path]`    | Print **effective merged** options with **source tags** per field: `cli` \| `config` \| `default`. `[path]` = scan target directory (default cwd); optional `--config <file>` same as scan. Does **not** run mine/NCLOC/scoring.                                                                                                                                                   |

### Print formats (LOCKED — include JSON; Low cost)

| Flag            | Output                                                                                                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (default)       | Human text lines: `since: <value> (source: default\|config\|cli)`, etc. for `since`, `include`, `exclude`, `top`, `concurrency`; also show `config file: <path\|none>` |
| `--format json` | JSON object with effective values + per-field `source` + `configPath` (`null` if none)                                                                                 |

Invalid `--format` → `CliUsageError` exit `2`.

### Domain vs bin

| Concern                             | Owner                         |
| ----------------------------------- | ----------------------------- |
| Validate / print / provenance merge | `src/config/`                 |
| Commander `config` command group    | `bin/hotspot-scanner.ts` only |

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-1111–1122.

---

## Decision: Dry-run enrichment (LOCKED)

**Question:** What extra prelude info should `scan --dry-run` show?

**Choice:** Mirror useful prelude already available from `resolveScanPipelineContext` / config load:

| Line / field | Content                                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| Config path  | Discovered or `--config` absolute path, or explicit `none` when no file                                   |
| Remount      | If `remountWarning` present — print its message (info/warn class); omit line when absent                  |
| Unknown keys | If non-empty after reserved-meta strip — list keys (same spirit as `UNKNOWN_CONFIG_KEY`); omit when empty |

Keep existing preview lines (repo, since, include, exclude, defaults, tests, eligible, concurrency). Still **no** Git Change Miner / NCLOC / scoring. `--baseline` still rejected.

**Requires:** `LoadedHotspotScannerConfig` (or prelude context) expose `path: string | null` so dry-run/doctor/print share one discovery result.

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-1123–1128.

---

## Decision: Doctor `--since` preflight (LOCKED)

**Question:** Soft vs hard fail for effective `since`?

**Choice:**

| Case                                                                         | Severity      | Exit alone                |
| ---------------------------------------------------------------------------- | ------------- | ------------------------- |
| `git log -1 --since=<effective>` succeeds and returns a commit               | **Pass**      | —                         |
| Git accepts `--since` but window is empty / no commit (dubious)              | **Soft warn** | Exit `0` if no hard fails |
| Git **rejects** the since string (non-zero with parse/usage error on stderr) | **Hard fail** | Non-zero (`1`)            |

**Rules:**

1. Use **effective merged** `since` from prelude (config + defaults). **No** new `doctor --since` CLI flag (M52 out-of-scope carried).
2. Lightweight probe only — prefer `git log -1 --since=…` (or equivalent) in **`src/git/`** adapter (honor INTEGRATIONS: do not add ad-hoc git spawn in doctor beyond existing `git --version` PATH check).
3. New finding id: **`since`**.
4. Soft warn message should hint widening `--since` / fixing config (align tone with empty-window git rename warnings).

**Status:** **Confirmed — planner locked (parent mission)**

**Applies to:** HOTSPOT-1129–1133.

---

## Decision: Doctor unknown-key surfacing (LOCKED)

**Question:** Close M55 gap — should doctor mention unknown keys?

**Choice:** **Yes** — when unknown keys remain after reserved-meta strip, doctor emits a **`config` warn** (or additive message on config finding) listing them; **never** hard-fail solely for unknown keys (M55). Soft → exit `0` if no hard fails.

**Status:** **Confirmed — planner locked (closes M55 intent gap)**

**Applies to:** HOTSPOT-1134.

---

## Related closed decisions (do not reopen)

| Source    | Decision                                                                                        |
| --------- | ----------------------------------------------------------------------------------------------- |
| M21       | Filename only `.hotspot-scanner.json`; CLI > config > defaults                                  |
| M30       | Parent walk + `--config`; invalid → `ConfigError`                                               |
| M39       | Doctor hard/soft exit policy; init overwrite/`--force`; dry-run text preview; domain vs bin     |
| M52       | Doctor uses `resolveScanPipelineContext`; no doctor `--since`/`--include`/`--exclude` CLI flags |
| M55       | Unknown keys warn-only `UNKNOWN_CONFIG_KEY`; never fail scan solely for unknowns                |
| M57       | No `granularity` / `minCochange` as known keys                                                  |
| AGENTS.md | Gate `pnpm build && pnpm test`; no Execute in planning session                                  |

---

## Out of scope

| Item                                      | Reason                                               |
| ----------------------------------------- | ---------------------------------------------------- |
| Interactive init wizard                   | YAGNI                                                |
| Auto-fix / mutate from doctor             | Diagnose only                                        |
| Changing PathScope / default excludes     | Sisters own                                          |
| ScanResult / CompareResult `version` bump | Unrelated                                            |
| New known scan config keys                | YAGNI                                                |
| Publishing to npm                         | Deferred horizon                                     |
| Doctor CLI `--since` flag                 | M52; use config or `scan --dry-run` / `config print` |
