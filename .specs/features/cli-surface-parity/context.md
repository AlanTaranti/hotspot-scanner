# Milestone 63 — CLI Surface Parity Context

**Feature slug:** `cli-surface-parity`  
**Captured:** 2026-07-26  
**Trigger:** ROADMAP M63 + planner lock (parent session)  
**Depth:** Large  
**IDs:** HOTSPOT-1060–1099 (1096–1099 reserved)

All gray areas for M63 are closed below. No open `PENDENTE-DISCUSSÃO`.

---

## Feature Boundary

Close remaining CLI **surface gaps** so operators get consistent flags across commands, shell completions that match bash, safer path→scan ergonomics, opt-in explain-miss failure, machine-readable stderr warnings, and an opt-in single-file CSV write path — without changing ranking, JSON contract version, or default CSV multi-file layout.

**In scope:** `bin/hotspot-scanner.ts`, `bin/scan-actions.ts`, `bin/completion-scripts.ts`, `src/diagnostics/` (warnings JSON mode), small helpers in `src/report/explain.ts` if needed for miss detection, living docs.

**Out of scope:** Schema / `version` bump; new config keys; ranking / NCLOC / git miner changes; fail-on-warning CI gates; section-marker multi-block CSV revival; PowerShell completion; changing bare-invocation help+exit 2; default CSV bundle layout (M18 remains default).

**Sisters:** csv-bundle (M18), cli-surface-polish (M38), workflow-subcommands (M40), explain-and-scan-feedback (M42), cli-adoption-extras (M54), cli-warnings-mode (M58).

---

## Decision: `baseline save` diagnostic flag parity (LOCKED)

**Question:** Which presentation flags does `baseline save` lack vs `scan` / `compare`?

**Choice:** Add the same diagnostic flags already on `scan` / `compare`:

| Flag | Behavior (parity) |
| ---- | ----------------- |
| `--quiet` | Suppress progress + `severity: "info"`; warnings/errors remain |
| `--no-progress` | Suppress progress only |
| `--verbose` | Trace git spawn argv on stderr (M51); quiet wins over verbose |

Wire through `executeScan` / `createCliDiagnosticHandlers` the same way as `scan`. `--warnings` already present on `baseline save` (M58) — leave it.

**Rationale:** Baseline save runs a full scan; operators scripting CI need quiet/progress control without switching to `scan --format json`.

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-1060–1063

---

## Decision: Completions — zsh/fish align with bash (LOCKED)

**Question:** How far should completion scripts go?

**Choice:** Bring **zsh** and **fish** flag lists to **parity with bash** for `scan`, `compare`, and `baseline save`, and include **all flags introduced or required by this milestone** (`--quiet`, `--verbose`, `--no-progress`, `--fail-on-explain-miss`, `--csv-single-file`, `--warnings` values including `json`, and any other long flags already in bash `SCAN_FLAGS` that zsh/fish omit today).

| Shell | Expectation |
| ----- | ----------- |
| bash | Keep as SoT list in `SCAN_FLAGS` (+ baseline subset); extend with new flags |
| zsh | Full long-flag `_arguments` matching bash coverage (not the thin subset today) |
| fish | Full `-l` completions matching bash coverage |

**Drift control:** Unit tests assert representative flags appear in **all three** scripts (extend M54 pattern).

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-1088–1091

---

## Decision: Default path → `scan` rewrite (LOCKED)

**Question:** When may a bare path become an implicit `scan`?

**Choice:** Rewrite **only** when **first user argv** (`argv[2]`) looks like a path **and** is **not** a known subcommand:

| First argv | Rewrite? |
| ---------- | --------- |
| `.` | Yes → `scan .` |
| `./…` (leading `./`) | Yes → `scan ./…` |
| Absolute path (`/`… or Windows-style absolute if ever relevant) | Yes → `scan <abs>` |
| Existing **directory** (cwd-relative, `fs` check) | Yes → `scan <dir>` |
| Known subcommand (`init`, `doctor`, `scan`, `baseline`, `compare`, `completion`) | No |
| Help/version tokens (`-h`, `--help`, `-V`, `--version`) | No |
| Bare invocation (no args / `argv.length <= 2`) | **No** — still help + exit **2** (M38/M40 lock) |
| Token that is neither subcommand nor path-like / existing dir | No — commander unknown-command path |

**Implementation sketch:** In `runCli`, before `parseAsync`, if rewrite applies, insert `"scan"` at `argv[2]` (shift path to positional for `scan`).

**Do not** rewrite when the first token is a flag (e.g. `--quiet`).

**Rationale:** Best DX for `hotspot-scanner .` / `hotspot-scanner /repo` without stealing real subcommands or changing no-arg help.

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-1065–1068

---

## Decision: `--fail-on-explain-miss` (LOCKED)

**Question:** Should explain target misses fail the process?

**Choice:**

| Item | Value |
| ---- | ----- |
| Flag | `--fail-on-explain-miss` (boolean, no value) |
| Scope | CLI-only; on `scan` and `compare` (any path that runs `--explain`) |
| Default | **Off** — miss still prints not-found on stderr and exits **0** if scan/compare succeeded (M42 lock) |
| When set + miss | Exit **1** (prefer `CliExitError(1)` after report + explain not-found message) |
| When set + found | Unchanged success path |
| Without `--explain` | Flag ignored (or YAGNI: allow no-op; prefer **CliUsageError** if set without `--explain` — **locked: CliUsageError exit 2**) |

Miss detection: reuse explain helpers — scan miss when `formatExplainBlock` yields the not-found message shape; compare miss when `formatCompareExplain` / empty matches path used today (`explain: no compare delta for …`). Prefer a small pure helper (`isExplainNotFound` / return status from format) in `src/report/explain.ts` rather than string-prefix sniffing in bin alone.

**No config key.**

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-1070–1074

---

## Decision: `--warnings=json` third mode (LOCKED)

**Question:** How does machine-readable stderr warnings work?

**Choice:**

| Item | Value |
| ---- | ----- |
| Values | `summary` \| `full` \| **`json`** |
| Default | **`summary`** (unchanged M58) |
| Invalid | `CliUsageError` exit **2**, message lists `summary`, `full`, or `json` |
| `meta.warnings` | **Always full** structured list (M58 lock — no thinning) |
| Programmatic `onWarning` | Unchanged (full objects) |
| Config key | **None** (CLI-only) |

**`json` stderr behavior:**

1. Buffer warning/error diagnostics in the CLI sink (same lifecycle as `summary` — flush after emission / after write per current defer rules).
2. On `flushWarnings()`, write **one** JSON document to stderr (single object + trailing newline), then clear buffer.
3. Payload shape (locked):

```json
{
  "warnings": [
    { "code": "RENAME_HISTORY_INCOMPLETE", "message": "…", "severity": "warning" }
  ]
}
```

- Array entries are the **full** structured `ScanWarning` objects received by the handler (not text-aggregated summary groups).
- Under `--quiet`, `info` remains suppressed (never enters buffer) — same as M58.
- Under `--warnings=json`, do **not** also print human `summary`/`full` text lines.

**`--verbose`:** Still git argv only (M51); does not change JSON payload.

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-1075–1081

---

## Decision: `--csv-single-file` (LOCKED)

**Question:** Single-file CSV layout vs M18 multi-file bundle?

**Choice:** **Opt-in** flag; **default remains M18 multi-file stem bundle**.

| Item | Value |
| ---- | ----- |
| Flag | `--csv-single-file` (boolean) |
| Requires | `--format csv` **and** `--output` (csv still cannot go to stdout) |
| Without `--format csv` | `CliUsageError` exit **2** (flag only valid with csv) |
| Scan write | Write **hotspots-only** CSV (same columns as `{stem}.hotspots.csv`) to the **exact** `--output` path — **no** stem expansion, **no** `.hotspots.csv` suffix, **no** `meta.json` sidecar |
| Compare write | Write **hotspots.new** CSV only (same columns as `{stem}.hotspots.new.csv`) to the **exact** `--output` path — no stem expansion, no other compare CSVs / meta |
| Default (flag off) | Unchanged M18 `writeCsvBundle(deriveCsvStem(…))` |

**Rejected alternative:** Section-marker multi-block single file (M17 revival) — worse for pandas/Sheets; user asked for simpler DX.

**`--only`:** Still filters which sections are rendered into the in-memory bundle; single-file mode then writes the hotspots (scan) / hotspots.new (compare) content to `--output`. If `--only` excludes hotspots such that there is no ranking CSV to write, `CliUsageError` with a clear hint.

**No config key.**

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-1082–1087

---

## Decision: Module ownership (LOCKED)

| Area | Owner |
| ---- | ----- |
| Primary | `bin/hotspot-scanner.ts`, `bin/scan-actions.ts`, `bin/completion-scripts.ts`, `bin/*.test.ts` |
| Diagnostics | `src/diagnostics/` for `--warnings=json` flush payload only |
| Explain miss helper | `src/report/explain.ts` (+ compare explain helpers) if needed |
| Forbidden | Ranking, schemas, git miner, complexity, new config keys, JSON `version` bump |

**Status:** **Confirmed**

---

## Related closed decisions (do not reopen)

| Decision | Value | Relevance |
| -------- | ----- | --------- |
| Bare CLI → help + exit 2 | M38 / current `runCli` | Path rewrite must not change this |
| CSV requires `--output` | M18 | Single-file still requires `--output` |
| M18 multi-file default | M18 | Opt-in only via `--csv-single-file` |
| Explain miss → exit 0 | M42 | Default preserved; opt-in fail |
| `meta.warnings` full | M58 | JSON mode is stderr-only |
| `--verbose` = git argv | M51 | Not warning detail |
| Exit codes | 0 / 2 usage+config / 1 else | Fail-on-explain-miss → 1; usage → 2 |
| Completion shells | bash/zsh/fish only (M54) | No new shells |
