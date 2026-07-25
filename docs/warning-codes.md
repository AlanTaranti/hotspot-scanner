# Warning codes

Scan and compare JSON include structured warnings on `meta.warnings` — an array of `{ severity, message, code? }` objects (`ScanWarning`). The CLI prints each warning to stderr with a severity prefix (`info:`, `warning:`, `error:`). Programmatic callers receive the same objects via `onWarning`.

**Severity vs exit code.** `severity` classifies diagnostics only. A successful scan exits `0` even when warnings are present. Hard failures (invalid repo, git error, bad CLI args) still exit non-zero.

## Stable codes

| Code | Interpretation |
| ---- | -------------- |
| `EMPTY_SINCE_WINDOW` | No commits in the `--since` window — rankings may be empty or sparse; widen the window |
| `RENAME_HISTORY_INCOMPLETE` | Rename tracking incomplete for one or more paths — churn may be split; includes rename-confidence messages (ambiguous chain, unlinked delete+add, `--since` truncation, function-mode overlap confidence) |
| `PARSE_FAILED` | A source file could not be parsed for complexity — file skipped; fix syntax or exclude the path |
| `COMPARE_SINCE_MISMATCH` | Baseline and current scan used different `--since` values — rank deltas are less comparable |
| `MEGA_COMMIT_SKIPPED` | One or more commits exceeded 100 unique in-scope files — those commits did not contribute to coupling pair counts (churn still counted); coupling rankings may omit pairs from bulk commits |
| `MONOREPO_PATH_REMOUNT` | Scan path was remounted to the git root; auto-include `{prefix}/**` applied unless CLI `--include` was set |
