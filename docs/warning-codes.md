# Warning codes

Scan and compare JSON include structured warnings on `meta.warnings` — an array of `{ severity, message, code? }` objects (`ScanWarning`). Programmatic callers receive the same objects via `onWarning` — always the full list, one callback per warning.

## Stderr presentation (`--warnings`)

The CLI writes diagnostics to stderr with a severity prefix (`info:`, `warning:`, `error:`). Presentation is controlled by `--warnings` on `scan`, `compare`, and `baseline save` (**CLI-only** — not a config key):

| Mode | Default? | Stderr behavior |
| ---- | -------- | --------------- |
| `summary` | **Yes** | Buffer warning/error lines, then emit **one line per group** (by code + rename sub-kind) with a **count** and shared next-step text. Repeated ambiguous / unlinked rename noise collapses instead of one line per path or pair. |
| `full` | No | Emit each structured warning immediately (per-path ambiguous renames; unlinked sample + remainder lines as in `meta.warnings`). Use when debugging rename confidence. |

**Unchanged by `--warnings`:** `meta.warnings` content and length; library `onWarning` payloads; JSON / CSV report bodies.

**Flag composition:**

| Flag | Effect on warnings |
| ---- | ------------------ |
| `--quiet` | Suppresses progress and `severity: "info"`; warning/error still follow `--warnings` mode |
| `--quiet` + `--warnings=full` | Quiet wins for progress/info; warning/error emit in full detail |
| `--verbose` | Git spawn argv trace only — does **not** expand warning stderr |

Under `summary`, aggregated lines appear after the scan’s warning emission completes (before the Hotspots report on stdout).

**Severity vs exit code.** `severity` classifies diagnostics only. A successful scan exits `0` even when warnings are present. Hard failures (invalid repo, git error, bad CLI args) still exit non-zero. On compare, `--strict` exits `1` after a successful report write when `COMPARE_SINCE_MISMATCH` is in `meta.warnings` (other warnings alone do not fail under `--strict`).

## Stable codes

| Code | Interpretation |
| ---- | -------------- |
| `EMPTY_SINCE_WINDOW` | No commits in the `--since` window — rankings may be empty or sparse; widen the window |
| `RENAME_HISTORY_INCOMPLETE` | Rename tracking incomplete for one or more paths — churn may be split; includes rename-confidence messages (ambiguous chain, unlinked delete+add, `--since` truncation) |
| `READ_FAILED` | A source file could not be read for NCLOC — file omitted from hotspots; fix permissions or exclude the path |
| `COMPARE_SINCE_MISMATCH` | Baseline and current scan used different `--since` values — rank deltas are less comparable. Default: warning on stderr + `meta.warnings`, exit `0` on success. Use `--strict` on `scan --baseline` or `compare` to exit `1` after the report is still written |
| `MONOREPO_PATH_REMOUNT` | Scan path was remounted to the git root; auto-include `{prefix}/**` applied unless CLI `--include` was set |
| `UNKNOWN_CONFIG_KEY` | Unknown key(s) in `.hotspot-scanner.json` — ignored for merge (values not applied); includes legacy keys such as `granularity` from pre-M57 configs |

## Removed codes (M57)

| Code | Former role |
| ---- | ----------- |
| `PARSE_FAILED` | McCabe/ts-morph parse failure — retired with AST path |
| `PATHSPEC_ARG_MAX_FALLBACK` | Function-mode patch pathspec argv limits — retired with function-churn miner |
