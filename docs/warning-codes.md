# Warning codes

Scan JSON includes structured warnings on `meta.warnings` — an array of `{ severity, message, code? }` objects (`ScanWarning`). Programmatic callers receive the same objects via `onWarning` — always the full list, one callback per warning.

## Stderr presentation (`--warnings`)

The CLI writes diagnostics to stderr with a severity prefix (`info:`, `warning:`, `error:`). Presentation is controlled by `--warnings` on `scan` (**CLI-only** — not a config key):

| Mode | Default? | Stderr behavior |
| ---- | -------- | --------------- |
| `summary` | **Yes** | Buffer warning/error during the scan. After report write: **one aggregated line per group** (by code + rename sub-kind) with count and next-step text. |
| `full` | No | Emit each structured warning immediately during the scan (per-path ambiguous renames; unlinked sample + remainder lines as in `meta.warnings`). `flushWarnings()` clears live progress only — does not re-emit. |
| `json` | No | Buffer all warnings; after report write, `flushWarnings()` writes one JSON document: `{"warnings":ScanWarning[]}`. No teaser or human summary lines. |

**Unchanged by `--warnings`:** `meta.warnings` content and length; library `onWarning` payloads; JSON / CSV report bodies.

**Flag composition:**

| Flag | Effect on warnings |
| ---- | ------------------ |
| `--quiet` | Suppresses progress and `severity: "info"`; warning/error still follow `--warnings` mode |
| `--quiet` + `--warnings=full` | Quiet wins for progress/info; warning/error emit in full detail |
| `--verbose` | Git spawn argv trace only — does **not** expand warning stderr |

Under `summary`, warnings buffer during the scan; after the report is written (stdout or `--output`), `flushWarnings()` emits the aggregated per-group lines, preceded by one blank line on stderr when any warnings were buffered. `Finalizing…` stays visible through scoring, render, and write until `flushWarnings()` clears the live progress line. Under `json`, one JSON emission happens only after the write (also preceded by a blank line when the buffer is non-empty). Under `full`, warnings stream during the scan; flush clears live progress only.

**Warnings/Timing rollups** (`Warnings: N total (…)` and the Timing line) appear only in table/markdown executive summaries — not on stderr.

**Severity vs exit code.** `severity` classifies diagnostics only. A successful scan exits `0` even when warnings are present. Hard failures use the exit codes in [docs/cli-reference.md → Exit codes](cli-reference.md#exit-codes) (`1` for `--fail-on-explain-miss`, `2` for usage/config errors, `130`/`143` for cancel).

## Stable codes

| Code | Interpretation |
| ---- | -------------- |
| `EMPTY_SINCE_WINDOW` | No commits in the `--since` window — rankings may be empty or sparse; widen the window |
| `RENAME_HISTORY_INCOMPLETE` | Rename tracking incomplete for one or more paths — churn may be split; includes rename-confidence messages (ambiguous chain, unlinked delete+add, `--since` truncation) |
| `READ_FAILED` | A source file could not be read for NCLOC — file omitted from hotspots; fix permissions or exclude the path |
| `MONOREPO_PATH_REMOUNT` | Scan path was remounted to the git root; auto-include `{prefix}/**` applied unless CLI `--include` was set |
| `UNKNOWN_CONFIG_KEY` | Unknown key(s) in `.hotspot-scanner.json` — ignored for merge (values not applied); includes legacy keys such as `granularity` from older configs |

## Removed codes

| Code | Former role |
| ---- | ----------- |
| `PARSE_FAILED` | McCabe/ts-morph parse failure — retired with AST path |
| `PATHSPEC_ARG_MAX_FALLBACK` | Function-mode patch pathspec argv limits — retired with function-churn miner |
