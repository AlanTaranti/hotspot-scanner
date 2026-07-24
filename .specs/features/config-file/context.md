# Milestone 21 — Config File Context

**Feature slug:** `config-file`  
**Captured:** 2026-07-23  
**Trigger:** ROADMAP M21 + **locked user decision**

---

## Decision: Config file name (LOCKED)

**Question:** `.hotspot-scanner.json` vs `.hotspotrc` vs dual lookup?

**Choice:** **ONLY** `.hotspot-scanner.json`  
**NOT** `.hotspotrc`  
**NOT** dual lookup / cascading filenames

**Status:** **Confirmed — user locked** — do not re-open

**Applies to:** All M21 tasks, HOTSPOT-166+.

---

## Decision: Precedence (LOCKED)

**Choice:** **CLI flags > config file > built-in defaults**

| Source | Wins when |
| ------ | --------- |
| CLI flag explicitly provided | Always overrides config for that option |
| Config file key present | Overrides default when CLI omitted |
| Built-in default | When neither CLI nor config sets the value |

**Status:** **Confirmed — user locked**

---

## Decision: Supported keys (LOCKED)

| Key | Maps to | Notes |
| --- | ------- | ----- |
| `since` | `--since` | string |
| `include` | `--include` | string array (globs) |
| `exclude` | `--exclude` | string array (globs) |
| `granularity` | `--granularity` | `"file"` \| `"function"` |
| `minCochange` | `--min-cochange` | positive integer |
| `top` | `--top` | positive integer |

**Not in M21 config:** `format`, `output`, `baseline`, hooks — CLI-only (YAGNI).

**Status:** **Confirmed — user locked**

---

## Decision: Discovery root

**Question:** Where is `.hotspot-scanner.json` loaded from?

**Choice:** Load from **`repoPath`** (the scan target directory) — `<repoPath>/.hotspot-scanner.json`. Do not walk parent directories (no cascading). If missing, use defaults + CLI only (not an error).

**Rationale:** Matches “scan this repo” mental model; avoids surprise home-directory configs.

**Status:** **Confirmed** (agent decision; consistent with locked filename)

---

## Decision: Invalid config

**Choice:** Invalid JSON or invalid value types/enums → clear CLI error (non-zero exit), same class as invalid flags (`CliUsageError` or dedicated `ConfigError`). Unknown keys: **ignore** (forward compat) or warn once — prefer **ignore unknown keys** without failing.

**Status:** **Confirmed**
