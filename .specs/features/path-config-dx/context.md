# Milestone 30 — Path & Config DX Context

**Feature slug:** `path-config-dx`  
**Captured:** 2026-07-23  
**Trigger:** ROADMAP M30 + planner lock (parent session)  
**Depth:** Large

---

## Decision: Extra default excludes (LOCKED)

**Question:** Which directory names join `DEFAULT_EXCLUDE_PATTERNS` beyond M7?

**Choice — include all five from ROADMAP (no cuts inside the list):**

| Directory          | Pattern form             | Rationale                                        |
| ------------------ | ------------------------ | ------------------------------------------------ |
| `.next`            | `**/.next/**`            | Next.js build output (often under `apps/*`)      |
| `out`              | `**/out/**`              | Static export / generic build out dirs           |
| `vendor`           | `**/vendor/**`           | Composer/Go-style dependency trees in monorepos  |
| `storybook-static` | `**/storybook-static/**` | Storybook static build output                    |
| `__snapshots__`    | `**/__snapshots__/**`    | Jest/Vitest snapshot dirs (almost always nested) |

**Pattern form:** New entries use `**/<name>/**` so nested package artifacts match. Existing M7 patterns (`node_modules/**`, `.git/**`, `dist/**`, `coverage/**`, `build/**`) stay unchanged in this milestone (no surprise rewrite).

**Still always-on:** Defaults remain non-disableable (M7 lock — no `--no-default-excludes`). User `--exclude` / config `exclude` stay **additive**.

### YAGNI cuts (explicitly NOT added)

| Candidate                                                                 | Why cut                                    |
| ------------------------------------------------------------------------- | ------------------------------------------ |
| `.turbo`, `.vercel`, `.cache`, `.nuxt`, `.output`, `.parcel-cache`, `tmp` | Not in ROADMAP M30 list                    |
| File globs (`*.min.js`, `*.snap`)                                         | M7 defaults are directory-oriented         |
| Rewriting M7 patterns to `**/…/**`                                        | Separate behavior change; out of M30 scope |
| `.hotspotignore` / `.gitignore`                                           | Future; globs + defaults suffice           |

**Status:** **Confirmed — planner locked**

---

## Decision: Config discovery = parent walk AND `--config` (LOCKED)

**Question:** Parent-directory walk and/or `--config <path>`?

**Choice:** **Both.**

| Mode                                         | Behavior                                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Default discovery                            | From `repoPath`, walk **upward** looking for **only** `.hotspot-scanner.json`; **nearest wins** (first found) |
| `--config <path>` / `ScanOptions.configPath` | Load that exact file; **skip** parent walk                                                                    |

**Walk stop conditions:**

1. File found → return parsed config
2. Else move to `dirname(candidate)`; stop when candidate is filesystem root (no parent) or `dirname` equals candidate
3. No file anywhere on the chain → `null` (not an error) — same as M21 missing file

**Do not:** stop specially at `$HOME`; do not load alternate filenames during walk; do not change git validation (`repoPath/.git` still required — YAGNI).

**Status:** **Confirmed — user/planner locked**

---

## Decision: Filename (LOCKED — M21, do not reopen)

**Choice:** Discovery filename remains **ONLY** `.hotspot-scanner.json`.

**Forbidden:** `.hotspotrc`, dual lookup, cascading alternate names.

**Exception:** `--config <path>` may point at any path the user supplies; contents must still validate as the same JSON schema/keys. Discovery walk never looks for other names.

**Status:** **Confirmed — M21 user lock carried forward**

---

## Decision: Precedence (LOCKED — M21, unchanged)

**Choice:** **CLI flags > config file > built-in defaults**

- `--config` / `configPath` only selects **which file** is loaded (discovery precedence), not option-value precedence.
- Once loaded, keys merge exactly as M21 (`mergeScanOptions`).
- `format`, `output`, `baseline` remain CLI-only (not config keys).

**Status:** **Confirmed**

---

## Decision: Explicit `--config` missing file

**Choice:** If `--config` / `configPath` is set and the file is missing or unreadable (non-ENOENT I/O) → **`ConfigError`**, non-zero exit. ENOENT on explicit path is an error (unlike discovery miss → `null`).

**Status:** **Confirmed**

---

## Decision: API surface

**Choice:** Add optional `configPath?: string` on `ScanOptions`. `loadHotspotScannerConfig` / `resolveScanConfig` accept it so CLI and programmatic `runScan` share one discovery path. Bin must pass `--config` through so its pre-scan merge for `top` matches `runScan`.

**Status:** **Confirmed**

---

## Related closed decisions (do not reopen)

| Source    | Decision                                     |
| --------- | -------------------------------------------- |
| M7        | Default excludes always on; exclude additive |
| M7        | Include narrows; exclude wins                |
| M21       | Six config keys only; unknown keys ignored   |
| M21       | Invalid JSON / bad types → `ConfigError`     |
| AGENTS.md | Gate `pnpm build && pnpm test`               |
