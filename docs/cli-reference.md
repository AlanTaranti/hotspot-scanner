# CLI reference

Deep reference for **hotspot-scanner** flags, pipeline internals, and power-user behavior. For first-run and adoption, see [README](../README.md). Recipes: [recipes.md](recipes.md). Warning codes: [warning-codes.md](warning-codes.md).

## Table of contents

- [Pipeline detail](#pipeline-detail)
- [Performance and diagnostics](#performance-and-diagnostics)
- [Rename confidence](#rename-confidence)
- [Scan → assess](#scan--assess)
- [`--explain` (stderr)](#explain-stderr)
- [Command synopsis and flags](#command-synopsis-and-flags)
- [Exit codes](#exit-codes)
- [Examples](#examples)

## Pipeline detail

```
git log --numstat (streaming) ∥ NCLOC size analysis → scoring (file hotspots) → table / JSON / markdown / CSV
```

1. **Git Change Miner** — streams `git log -M --numstat` to aggregate per-file churn; parses `old => new` rename lines into a `PathAliasMap` to canonicalize paths (no global `git log --follow`); emits rename-confidence warnings when applicable
2. **Size analyzer** — counts NCLOC from working-tree source files (state-machine scanner; no AST)
3. **Scoring** — ranks file hotspots from normalized NCLOC + churn (harmonic mean)
4. **Reporter** — renders table, JSON, markdown, or CSV bundle output

### Scoring

- **Hotspot score:** `2 × normalize(ncloc) × normalize(churn) / (normalize(ncloc) + normalize(churn))` — harmonic mean after log1p + min-max normalization per scan

Churn is measured as raw commit count (not relative code churn). NCLOC is computed from the current working tree, not historical file versions.

## Performance and diagnostics

**Concurrency.** The size analysis stage processes files in parallel via a bounded `worker_threads` pool. Default pool size is `min(os.availableParallelism(), 8)`. Override with `--concurrency <n>` or the `concurrency` key in `.hotspot-scanner.json` — precedence is **CLI > config > default**.

**Stage overlap.** By default, git mining and NCLOC analysis run concurrently. Use `--sequential` (or alias `--no-overlap`) to run them sequentially for lower peak memory — rankings unchanged.

**Source discovery.** In Git repositories, discovery prefers `git ls-files` (tracked paths only) filtered by eligible extensions and PathScope; on failure it falls back to a filesystem walk.

**Progress (stderr).** Three phases on one ephemeral stderr line (last-writer-wins when git and complexity overlap):

- **`git`** — indeterminate commit counter only (`git 12,000 commits…`); throttled every 1,000 commits. No fill bar or percentage (total commits unknown).
- **`complexity`** — honest file/batch counters with an inline fill bar when `totalFiles` is known: TTY uses block glyphs (`█` / `░`), piped/CI uses ASCII (`#` / `-`), e.g. `complexity [████████░░] 800/1,050 files · batch 16/21`. Omit the bracketed bar when total is unknown; show 100% when all files are processed (no fake overall scan %). Throttled per batch (interval = batch size 50).
- **`finalize`** — after git and complexity complete, `Finalizing…` stays visible through scoring, render, and stdout/file write.

On an **interactive TTY**, progress updates **one live line** on stderr (overwritten in place). **Piped / CI** (non-TTY) keeps permanent `\n`-delimited progress logs for grepping. The live line is **cleared after** the report is written (`flushWarnings`); warning/error/info diagnostics still **clear first**. The first progress line prefixes the active `--since` window; later lines do not repeat it. `--explain` runs after that flush. Use `--no-progress` or `--quiet` to suppress all progress (including finalize).

**Cancel (`SIGINT` / `SIGTERM`).** Aborts in-progress `runScan()`; no report on cancel; exit `130`/`143`.

**Verbose git argv (`--verbose`).** On `scan` only: one stderr line per numstat spawn (`verbose: git …`). Not a config key; `--quiet` suppresses. Does **not** expand warning detail — use `--warnings=full` for that.

**Warnings on stderr (`--warnings`).** Default `summary`: aggregate repeated same-code / rename sub-kind lines into one stderr line per group (with count + next-step). Pass `--warnings=full` for per-path / per-pair detail (useful when debugging renames). Pass `--warnings=json` to flush one JSON object to stderr after the run: `{"warnings":[...]}` with full `ScanWarning` objects (empty → `{"warnings":[]}`); no human summary/full lines in json mode. CLI-only (not a config key). Composes with `--quiet` (progress/info suppressed; json mode still omits info-level entries from the payload). `--verbose` traces git argv only — does not force full warnings.

| `phase` | When emitted |
| ------- | ------------ |
| `git` | Numstat stream (`--numstat`) |
| `complexity` | NCLOC analyzer batches (inline or worker pool) |
| `finalize` | Once after git + complexity complete; through score / render / write |

**Warnings (`meta.warnings`).** Structured `{ severity, message, code? }` objects — always the full list regardless of `--warnings`. See [warning-codes.md](warning-codes.md).

Find-renames (`-M`) is enabled on git log spawns. The scanner does **not** use global `git log --follow`.

## Rename confidence

Rename blind-spot messages use `code: "RENAME_HISTORY_INCOMPLETE"` (ambiguous chain, unlinked delete+add, `--since` truncation). Each appends an actionable **Next step:** sentence. Default stderr mode summarizes these; pass `--warnings=full` for per-path detail. Stable codes and interpretation: [warning-codes.md](warning-codes.md).

## Scan → assess

`hotspot-scanner assess [path]` runs the full scan, keeps hotspots with `hotspotScore >= --min-hotspot-score` (default **0.7**), caps to `--top` (default **20**), then runs **sequential** `runComplexityTrend` per candidate. Table and markdown show summary pattern counts and a detail section **only for deteriorating** files. On an interactive TTY, assess **table** output bolds the title and `Deteriorating` section and colors pattern kinds and scores (see [README → Output formats](../README.md#output-formats)). JSON uses `kind: "hotspot-assess"` / `version: "1.0"` — isolated from scan JSON `3.0`; candidates include `growthPattern` without full revision `points`.

```bash
hotspot-scanner assess . --min-hotspot-score 0.7 --top 10
hotspot-scanner assess . --since "6 months ago" --include "src/**" --format json -o assess.json
```

`--min-hotspot-score` is **CLI-only** (not in `.hotspot-scanner.json`). Scan-backed flags (`--since`, `--include`, `--exclude`, `--config`, `--concurrency`, `--sequential`, `--include-tests`) follow scan semantics. Per-file trend failures are recorded and the batch continues (exit `0` unless usage/cancel). Expect **scan time + N× per-file trend cost** — cap candidates with `--top` and raise `--min-hotspot-score` on large repos.

**Formatter cliffs:** mass re-indent or Prettier can false-label **deteriorating** (same classifier as `trend`). Treat Pattern as indicative — not CI truth. See [recipes.md → Tornhill growth curves](recipes.md#tornhill-growth-curves-trend-pattern).

Batch recipe: [Scan → assess](recipes.md#scan--assess-batch-deteriorating-hotspots).

## `--explain` (stderr)

Runs the **full scan** and normal report first, then prints a breakdown to **stderr**.

Explains current file hotspot ranking.

**Target:** repo-relative or absolute file path (`<path>`). Function suffix (`path:name`) is rejected — file hotspots only.

Lookup uses full ranking arrays (ignores `--top`). Not found → message on stderr; scan still exits `0` on success unless `--fail-on-explain-miss` is set (then exit `1`). The flag requires `--explain`; used on `scan`.

Drill-down recipe: [Hotspot drill-down](recipes.md#hotspot-drill-down-scan--explain--trend).

## Command synopsis and flags

```
hotspot-scanner [-V|--version]
hotspot-scanner init [directory] [--force]
hotspot-scanner config validate [path]
hotspot-scanner config print [path] [--since <period>] [--include <glob>] [--exclude <glob>] [-t|--top <n>] [--concurrency <n>] [--config <path>] [-f|--format text|json]
hotspot-scanner doctor [path] [--config <path>] [--include-tests] [--no-color] [-f|--format text|json]
hotspot-scanner assess [path] [options]
hotspot-scanner scan [path] [options]
hotspot-scanner completion <bash|zsh|fish>
hotspot-scanner <path>   # path-first shorthand → scan <path> (., ./dir, absolute, or existing directory)
```

**Path-first invocation.** When the first argument looks like a path (`.`, `./…`, absolute path, or an existing directory) and is not a known subcommand or flag, the CLI rewrites argv to `scan <path> …` before parsing. Bare `hotspot-scanner` (no subcommand) still prints help and exits `2`.

| Flag | Default | Description |
| ---- | ------- | ----------- |
| `<path>` | `.` | Scan target (git root or nested directory inside a git workspace) |
| `-V`, `--version` | — | Print package version from `package.json` and exit |
| `--since` | `12 months ago` | Git history window |
| `-f`, `--format` | `table` | Output format: `table`, `json`, `markdown`, or `csv` (csv requires `--output`) |
| `-o`, `--output <path>` | — | Write report to file instead of stdout (required for `--format csv`) |
| `-t`, `--top` | `20` | Top N rows in table/markdown output (ignored for json/csv) |
| `--only <section>` | — | Include only `hotspots` (repeatable) |
| `--no-triage-hints` | — | Suppress triage hints in scan table/markdown |
| `--no-color` | — | Disable ANSI colors in scan table output |
| `--explain <target>` | — | After the report, print file-path score breakdown to stderr |
| `--fail-on-explain-miss` | — | Exit `1` when `--explain` target is not found (requires `--explain`) |
| `--include <glob>` | — | Include only paths matching glob (repeatable) |
| `--exclude <glob>` | — | Exclude paths matching glob (repeatable, additive) |
| `--include-tests` | — | Include test/spec files and `__tests__/` (lifts built-in test excludes only; artifact defaults and `--exclude` still apply) |
| `--config <path>` | — | Load config from explicit file (skips parent-directory discovery) |
| `--concurrency` | `min(availableParallelism(), 8)` | NCLOC analyzer worker-pool size (positive integer ≥ 1) |
| `--sequential` | — | Run git mining then NCLOC analysis sequentially (disables concurrent stage overlap; lowers peak memory); `--no-overlap` is an alias |
| `--quiet` | — | Suppress progress and info-level diagnostics on stderr (warnings/errors remain per `--warnings`) |
| `--no-progress` | — | Suppress progress lines on stderr only |
| `--dry-run` | — | Preview effective since/include/exclude, config file path, remount note, unknown config keys, test-file policy, and eligible file count without mining git or running NCLOC; `--format` / `--output` ignored |
| `--verbose` | — | Trace each git spawn argv on stderr (`verbose: git …`; `scan` only; suppressed when `--quiet`; does not expand warnings) |
| `--warnings` | `summary` | Stderr warning presentation: `summary` (default), `full` (per-path detail), or `json` (one JSON object on stderr). JSON `meta.warnings` always full; CLI-only |
| `--csv-single-file` | — | With `--format csv`, write one CSV to exact `--output` (hotspots) instead of stem bundle |

**`doctor --format`** — `text` (default) prints `status: message` lines; `json` prints `{ "version": "1.0", "findings": [...], "exitCode": N }` to stdout (JSON is emitted even when `exitCode` ≠ 0). Findings include `since` (git since preflight), `scope` (eligible file count), config validity (unknown keys soft-warn), and other pre-flight checks. Invalid format → usage error (exit `2`). Doctor does not run the scan pipeline.

**`doctor` colors** — On an interactive stdout TTY with `--format text`, only the `pass:` / `warn:` / `fail:` prefix is ANSI-colored (green / yellow / red); finding messages, paths, and numbers stay plain. Color is disabled when stdout is not a TTY (piped/CI), when doctor `--no-color` is set, when `NO_COLOR` is non-empty (empty string is treated as unset), or when `--format json`. Scan `--no-color` does not affect doctor; each subcommand has its own flag. Not a config key.

**`config validate`** — exits `0` when the config file parses; `2` on invalid JSON/types or when no discoverable config (and no explicit file). Does not require a git repository.

**`config print`** — shows effective merged options with per-field `cli` / `config` / `default` source tags; `-f json` for machine-readable output. Does not invoke git mining, NCLOC, or scoring.

**Error hints.** Common failures include a `Hint:` line with a concrete next step: non-git path, `--format csv` without `--output`, or missing explicit `--config` file. See [Exit codes](#exit-codes).

## Exit codes

Canonical exit-code table for the CLI (SoT). Adoption overview also in [README](../README.md#exit-codes).

| Code | Meaning |
| ---- | ------- |
| `0` | Scan completed successfully (`--explain` miss without `--fail-on-explain-miss` also exits `0`) |
| `1` | `--fail-on-explain-miss` with missing explain target |
| `2` | Invalid CLI args, config validation, or usage errors (including unknown/removed `compare` / `baseline` / `--strict`) |
| `130` | Cancelled by `SIGINT` (POSIX 128+2) |
| `143` | Cancelled by `SIGTERM` (POSIX 128+15) |

Run `hotspot-scanner scan --help` for copy-paste examples (cwd default, JSON output, short aliases).

## Examples

```bash
hotspot-scanner --version
hotspot-scanner init                    # write schema-linked exemplar .hotspot-scanner.json
hotspot-scanner config validate         # validate discovered or explicit config (CI-friendly)
hotspot-scanner config print -f json    # effective options + provenance JSON
hotspot-scanner doctor .                # pre-flight: Node, git, repo, config, since, scope
hotspot-scanner doctor . -f json        # structured findings for scripts
hotspot-scanner doctor . --no-color     # plain status lines (no ANSI prefixes)
hotspot-scanner scan . --dry-run        # scope + config prelude preview before a full scan
hotspot-scanner scan                    # scan current directory (default path .)
hotspot-scanner scan . --since "6 months ago"
hotspot-scanner scan -f json -o report.json
hotspot-scanner scan -f table -t 10
hotspot-scanner scan . --format json --top 10  # --top ignored; full arrays exported
hotspot-scanner scan . --format markdown --output report.md
# CSV bundle (writes report.meta.json, report.hotspots.csv)
hotspot-scanner scan . --format csv --output report.csv
hotspot-scanner scan . --format json --output scan.json
hotspot-scanner scan . --only hotspots --format json
hotspot-scanner scan . --include "src/**"
hotspot-scanner scan . --include-tests --top 10
hotspot-scanner scan . --concurrency 1
hotspot-scanner scan . --explain src/hot.ts
hotspot-scanner scan . --quiet -f json -o report.json
hotspot-scanner scan . --verbose
hotspot-scanner scan . --warnings=full   # per-path rename / multi-file warning detail on stderr
hotspot-scanner scan . --warnings=json   # machine-readable warnings on stderr
hotspot-scanner .                        # path-first shorthand (same as scan .)
hotspot-scanner scan . --format csv --output hotspots.csv --csv-single-file
hotspot-scanner scan . --explain src/missing.ts --fail-on-explain-miss   # CI: exit 1 on miss
hotspot-scanner assess . --min-hotspot-score 0.7 --top 10
hotspot-scanner assess . --format markdown --output assess.md --min-hotspot-score 0.75 --top 5
```
