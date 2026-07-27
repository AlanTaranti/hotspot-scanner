# hotspot-scanner

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org/)
[![GitHub](https://img.shields.io/badge/github-taranti%2Fhotspot-scanner-181717?logo=github)](https://github.com/taranti/hotspot-scanner)

**Package:** `@vitals/hotspot-scanner` · **CLI command:** `hotspot-scanner`

## The problem

Tech leads need to prioritize refactoring work but struggle to see which TypeScript/JavaScript files are hardest to maintain — complex code that changes often.

## The solution

**hotspot-scanner** is a local CLI that ranks maintenance hotspots by combining **NCLOC** (non-commented lines of code) and Git churn at file level. It runs entirely on your machine — no hosted service, no telemetry.

> **Zero network during scan:** Once installed, hotspot-scanner makes **no outbound network calls** (zero network during `scan` or `doctor`). Analysis reads your Git history and source files on disk only; there is no phone-home or remote service. (Cloning and installing the tool still requires network access to fetch this repository and its dependencies.)

## Table of contents

- [Quick start](#quick-start)
- [Use this when…](#use-this-when)
- [Recipes](docs/recipes.md)
- [How it works](#how-it-works)
- [Essential flags](#essential-flags)
- [Requirements](#requirements)
- [Installation](#installation)
- [Shell completion](#shell-completion)
- [Configuration](#configuration)
- [Output formats](#output-formats)
- [Programmatic API](#programmatic-api)
- [Advanced](#advanced)
- [Warning codes](docs/warning-codes.md)
- [Limitations](#limitations)
- [Contributing](#contributing)
- [Security](SECURITY.md)
- [License](#license)

## Quick start

```bash
git clone https://github.com/taranti/hotspot-scanner.git
cd hotspot-scanner
pnpm install
pnpm build
cd /path/to/your-repo
pnpm exec hotspot-scanner scan   # optional path defaults to .
# Path-first shorthand (equivalent to scan):
pnpm exec hotspot-scanner .
```

Try the bundled fixture:

```bash
pnpm exec hotspot-scanner scan tests/fixtures/repos/small-ts
```

### Adoption path

Before your first full scan, use the onboarding commands:

```bash
hotspot-scanner init              # write schema-linked exemplar .hotspot-scanner.json (use --force to overwrite)
hotspot-scanner config validate   # CI-check config parse without a full scan
hotspot-scanner config print      # show effective options with cli/config/default source tags
hotspot-scanner doctor .          # check Node, git, repo, config, since window, and scope
hotspot-scanner trend src/foo.ts  # indentation complexity vs NCLOC size for one file (after scan drill-down)
hotspot-scanner scan . --dry-run  # preview config path, remount, unknown keys, and eligible file count
```

**Trend metrics:** Indentation stats (`indentMean`, `indentSd`, `indentMax`, `indentTotal`) are a Tornhill-style whitespace proxy (not AST/cyclomatic complexity). `ncloc` is file size. Table output includes a legend; JSON (`--format json`) uses contract `version: "2.0"` with `meta.metricLegend` describing each field.

`init` creates a valid config with `$schema`, `$comments`, and realistic `include`/`exclude` examples; `config validate` exits `0` when the file parses and `2` on invalid or missing config; `config print` shows merged precedence without git mining; `doctor` surfaces setup problems early (including a **`since`** preflight and unknown-config-key soft warns) and prints a **`scope`** line with the same eligible-file count `scan --dry-run` would use (shared remount/config prelude — a nested package directory does not need a local `.git`); `scan --dry-run` validates scope and config prelude metadata without mining git history or running NCLOC analysis.

**Example output** (fixture `small-ts`, truncated):

```
Scan window: 12 months ago (scanned 2026-07-24T14:38:40.375Z)

Top Hotspots
Rank  File                      Score     NLOC  NLOCN     Churn  ChurnN  Authors
----  ------------------------  --------  ----  --------  -----  ------  -------
   1  src/high.ts                 0.5590    14    1.0000      5  0.3879        1
   2  src/medium.ts               0.5119     3    0.3440      7  1.0000        1
   3  src/low.ts                  0.0000     1    0.0000      4  0.0000        1
```

![CLI table output from fixture small-ts](docs/assets/cli-table-small-ts.png)

## Use this when…

| Workflow | When to run | Example |
| -------- | ----------- | ------- |
| **Weekly triage** | You want a ranked list of files to refactor this sprint | `hotspot-scanner scan . --since "3 months ago" --top 10` |
| **Markdown in a PR** | You want a shareable report attached to a review | `hotspot-scanner scan . --format markdown --output report.md` |
| **JSON for tooling** | You want machine-readable output for scripts or dashboards | `hotspot-scanner scan . --format json --output scan.json` |

Copy-paste cookbooks for these workflows (and monorepo scoping): [docs/recipes.md](docs/recipes.md).

## How it works

```
git log (streaming) → NCLOC size analysis → scoring (hotspot) → report (table / JSON / markdown / CSV)
```

1. **Git Change Miner** — streams `git log --numstat` for per-file churn
2. **Size analyzer** — counts non-commented lines of code (NCLOC) from working-tree source files
3. **Scoring** — harmonic mean of normalized NCLOC and churn
4. **Reporter** — table, JSON, markdown, or CSV bundle

See [Advanced](#advanced) for concurrency, rename confidence, and the full flag reference.

## Essential flags

| Flag | Default | Description |
| ---- | ------- | ----------- |
| `<path>` | `.` | Scan target (git root or nested directory inside a git workspace) |
| `-V`, `--version` | — | Print package version and exit (program level) |
| `--since` | `12 months ago` | Git history window |
| `-f`, `--format` | `table` | `table`, `json`, `markdown`, or `csv` |
| `-t`, `--top` | `20` | Top N rows in table/markdown (ignored for json/csv) |
| `-o`, `--output` | — | Write report to file (required for `--format csv`) |
| `--only` | — | Include only `hotspots` (repeatable) |
| `--no-triage-hints` | — | Suppress triage hints in scan table/markdown |
| `--no-color` | — | Disable ANSI colors in table output |
| `--explain <target>` | — | After the report, print a file-path score breakdown to stderr |
| `--fail-on-explain-miss` | — | Exit `1` when `--explain` target is not found (default miss still exits `0`; requires `--explain`) |
| `--quiet` | — | Suppress progress, info-level stderr diagnostics, and `--verbose` git traces |
| `--no-progress` | — | Suppress progress lines on stderr only |
| `--verbose` | — | Trace each git spawn argv on stderr (`verbose: git …`; suppressed when `--quiet`) |
| `--warnings` | `summary` | Stderr warning presentation: `summary` (default; one line per category with count), `full` (per-path detail), or `json` (one JSON object on stderr). Does not change JSON `meta.warnings` |
| `--csv-single-file` | — | With `--format csv` and `--output`, write one hotspots CSV to the exact output path instead of the stem bundle |
| `--dry-run` | — | Preview effective scope, config file path, remount note, unknown config keys, and eligible file count (no git mine / NCLOC) |

Short aliases: `-f` / `--format`, `-o` / `--output`, `-t` / `--top`.

Full CLI reference: [Advanced → CLI reference](#cli-reference).

## Requirements

| Requirement | Version |
| ----------- | ------- |
| Node.js | 22+ |
| git | required at scan time |
| pnpm | for development |

## Installation

```bash
git clone https://github.com/taranti/hotspot-scanner.git
cd hotspot-scanner
pnpm install
pnpm build
```

Official install path is clone + build from source. npm registry install is not available yet.

## Shell completion

Tab-complete subcommands and common flags for bash, zsh, or fish. The `completion` subcommand prints a static script to stdout (no scan or git work):

```bash
# bash — append to ~/.bashrc or a sourced file
hotspot-scanner completion bash >> ~/.bashrc

# zsh — write to a directory on fpath (e.g. ~/.zfunc), then compinit
hotspot-scanner completion zsh > ~/.zfunc/_hotspot-scanner

# fish — evaluate in the current session (or save to a completions path)
source (hotspot-scanner completion fish | psub)
```

Restart your shell or reload the config after installing. Invalid shell names exit with usage error (exit `2`). Bash, zsh, and fish scripts share the same long-flag coverage (including `--fail-on-explain-miss`, `--csv-single-file`, and `--warnings` values `summary|full|json`); keep all three aligned when adding flags. See `hotspot-scanner completion --help`.

## Configuration

Run `hotspot-scanner init` to create a schema-linked exemplar **`.hotspot-scanner.json`** in the current directory (or `init <dir>` for another path). The exemplar includes `"$schema": "https://vitals.dev/hotspot-scanner/schemas/hotspot-scanner-config.json"`, a `$comments` array with human hints, and non-empty example `include`/`exclude` arrays. Re-run without `--force` refuses to overwrite an existing file.

Optional **`.hotspot-scanner.json`** supplies shared scan defaults. Discovery filename is **only** `.hotspot-scanner.json` (not `.hotspotrc` or alternate names).

**Reserved meta keys:** `$schema`, `$comment`, and `$comments` are for IDE hints and documentation — they are **not** scan options, are not merged, and do not trigger `UNKNOWN_CONFIG_KEY` warnings.

**Discovery (default):** Starting at `<repoPath>`, the tool walks **upward** through parent directories until it finds `.hotspot-scanner.json` or reaches the filesystem root. **Nearest wins** — a file at `<repoPath>/.hotspot-scanner.json` overrides a parent workspace config. If no file is found on the walk, built-in defaults apply (not an error).

**Explicit path:** `--config <path>` (or `ScanOptions.configPath`) loads that file only and **skips** parent walk. Relative paths resolve from the process cwd. A missing explicit file exits non-zero; invalid JSON or bad types exit non-zero with a clear error.

**Precedence:** CLI flags **>** config file **>** built-in defaults. `--config` only selects which file is read — it does not change option-value precedence.

| Key | Maps to | Type |
| --- | ------- | ---- |
| `since` | `--since` | string |
| `include` | `--include` | string array (globs) |
| `exclude` | `--exclude` | string array (globs) |
| `top` | `--top` | positive integer |
| `concurrency` | `--concurrency` | positive integer |

`format`, `output`, `--only`, `--no-triage-hints`, `--no-color`, `--quiet`, `--no-progress`, `--verbose`, and `--warnings` are **CLI-only** — they cannot be set in the config file. Unknown keys (other than reserved meta) are **not** applied to merge (forward-compatible) but emit a warn-only `UNKNOWN_CONFIG_KEY` diagnostic listing the key names — see [warning codes](docs/warning-codes.md). Invalid JSON or invalid values for known keys exit non-zero with a clear error.

**Validate and print** (no git required):

```bash
hotspot-scanner config validate              # discover + validate (exit 0/2)
hotspot-scanner config validate ./my.json    # explicit file
hotspot-scanner config print                 # effective merge with source tags (text)
hotspot-scanner config print . -f json       # machine-readable provenance JSON
hotspot-scanner config print . --since "6 months ago" --include "src/**"  # CLI overrides tagged cli
```

Example config (init writes a richer exemplar with `$schema` and `$comments`):

```json
{
  "since": "6 months ago",
  "include": ["src/**"],
  "top": 15,
  "concurrency": 2
}
```

Test files (`*.test.*` / `*.spec.*` for eligible extensions — `.ts`/`.tsx`/`.js`/`.jsx`/`.mjs`/`.cjs`/`.mts`/`.cts` — plus `__tests__/`) are excluded by default — no config entry needed. Use `--include-tests` on the CLI to audit test-suite health.

**No `.hotspotignore`:** There is no gitignore-style ignore file. Use `exclude` in config and/or `--exclude` on the CLI — see [docs/recipes.md → Excluding paths](docs/recipes.md#excluding-paths-no-hotspotignore).

A monorepo can keep one workspace config above the git root:

```bash
# workspace/.hotspot-scanner.json exists; scan packages/api (nearest repo-local file wins if present)
hotspot-scanner scan packages/api
```

### Scanning from a package directory (monorepo)

When the scan path is a **nested directory** inside a git workspace (for example `cd packages/api && hotspot-scanner scan .`), the tool:

1. Detects the git root with `git rev-parse --show-toplevel` and runs the pipeline from that root (`.git` validation, git mining, NCLOC discovery).
2. **Auto-includes** `{prefix}/**` (e.g. `packages/api/**`) so rankings stay scoped to that package — unless you already passed CLI `--include` (or programmatic `include`), in which case your patterns win and auto-include is skipped.
3. Still discovers **`.hotspot-scanner.json` from the original request path** (parent-directory walk unchanged); remount affects only pipeline `repoPath`.

An info diagnostic with code `MONOREPO_PATH_REMOUNT` is emitted when remount applies (see [warning codes](docs/warning-codes.md)). Scanning from the git root behaves as before — no remount, no auto-include.

**YAGNI:** path-only heuristic — no `pnpm-workspace.yaml`, nx, turborepo, or lerna parsers. To scan the whole monorepo from a package cwd, run from the git root or pass explicit `--include` globs.

`doctor` and `scan --dry-run` use the same remount, merged include/exclude, and eligible-file inventory (`doctor` reports it as the `scope` finding). `doctor` also preflights effective `since` via a lightweight git probe (empty window → soft warn; git-rejected since → hard fail). Dry-run additionally prints the config file path (or `none`), remount message when present, and unknown config keys when present.

CI can point at a fixed config without discovery:

```bash
hotspot-scanner scan . --config /ci/hotspot-scanner.json --since "3 months ago" --top 10
```

`runScan()` uses the same discovery rules (`configPath` or parent walk from `repoPath`); explicit option values win over the loaded file.

## Output formats

Table and markdown reports include interpretation helpers: an **executive summary** at the top (scan window, shown-vs-total counts, warning count by code, and stage timings when available), a **legend** or **How to read this** section defining metric columns, optional **triage hints** when conservative rules match visible rows, and optional **ANSI colors** on table score cells. JSON and CSV export raw data only (no summary, triage, or color).

**Scan triage rules** (table/markdown; disable with `--no-triage-hints`): one deterministic rule — dual-signal hotspot (`hotspotScore ≥ 0.7` with both normalized NCLOC and churn ≥ 0.5). Up to three matches; section omitted when empty.

**Section filter (`--only`)**: Repeatable flag limiting output to `hotspots` only. Excluded sections are omitted from all formats.

**Colors**: Table format only, when writing to an interactive TTY without `--output`, `--no-color`, or a non-empty `NO_COLOR`. Markdown, JSON, and CSV are always plain text.

### Table

One section: **Top Hotspots**. `--top` limits rows. Default output also includes the executive summary, optional triage hints, and a metric legend footer.

```
Scan window: 12 months ago (scanned 2026-07-24T14:38:40.375Z)

Top Hotspots
Rank  File                      Score     NLOC  NLOCN     Churn  ChurnN  Authors
----  ------------------------  --------  ----  --------  -----  ------  -------
   1  src/high.ts                 0.5590    14    1.0000      5  0.3879        1
   2  src/medium.ts               0.5119     3    0.3440      7  1.0000        1
   3  src/low.ts                  0.0000     1    0.0000      4  0.0000        1
```

### JSON

`--format json` writes the full `ScanResult` shape (`version: "3.0"`). Each hotspot entry includes **normalized scores and raw metrics** (`ncloc`, `commitCount`, `linesChanged`, `authorCount`). Fresh output includes top-level **`$schema`** (IDE/validator link to the published contract) and **`meta.scannerVersion`** (package version that produced the scan). Domain types and in-memory `ScanResult` objects do not require `$schema` — it is added at JSON render time only.

Published JSON Schema files live under [`schemas/`](schemas/) and are exported from the package:

| Schema | TypeScript / use |
| ------ | ---------------- |
| [`schemas/scan-result.json`](schemas/scan-result.json) | `ScanResult` |
| [`schemas/hotspot-scanner-config.json`](schemas/hotspot-scanner-config.json) | `.hotspot-scanner.json` config |

Import in Node (JSON module):

```javascript
import configSchema from "@vitals/hotspot-scanner/schemas/hotspot-scanner-config.json" with { type: "json" };
```

Use these schemas to validate CLI output or config files in your own pipelines.

**`meta.timings`** (successful scans only): `gitMs`, `complexityMs`, `totalMs`. Table and markdown executive summaries include a Timing line when timings are present; a brief stderr line echoes total time after successful scans (unless `--quiet`). File-mode overlap: `gitMs` + `complexityMs` may sum above `totalMs`. **`meta.scannerVersion`** is always present on new scans (from `package.json`).

**`--top` does not slice JSON** — all ranked hotspots are exported for scripting.

```json
{
  "$schema": "https://vitals.dev/hotspot-scanner/schemas/scan-result.json",
  "version": "3.0",
  "hotspots": [
    {
      "filePath": "src/high.ts",
      "hotspotScore": 0.8571,
      "complexityNormalized": 1.0,
      "churnNormalized": 0.75,
      "ncloc": 42,
      "commitCount": 15,
      "linesChanged": 320,
      "authorCount": 3
    }
  ],
  "meta": {
    "since": "12 months ago",
    "scannedAt": "2026-07-22T12:00:00.000Z",
    "warnings": [],
    "scannerVersion": "1.0.0",
    "timings": {
      "gitMs": 1200,
      "complexityMs": 800,
      "totalMs": 1500
    }
  }
}
```

### Markdown

`--format markdown` produces a GitHub-flavored report with executive summary, `## How to read this`, hotspot tables, and optional triage hints. Includes raw and normalized columns plus a `Lines` column. `--top` slices rows at render time.

### CSV bundle

`--format csv` writes a **multi-file bundle** derived from the `--output` path stem. **`--output` is required** for CSV; metadata lives only in `{stem}.meta.json`, not inside data files. **`--top` is ignored** — full ranked lists are exported.

**Scan bundle** (`--output out/report.csv`):

| File | Contents |
| ---- | -------- |
| `out/report.meta.json` | Scan metadata (`since`, `scannedAt`, `warnings`, `timings` when present) |
| `out/report.hotspots.csv` | File hotspot ranking |

Empty sections produce header-only CSV files. Data files have no section title rows.

**Single-file CSV (`--csv-single-file`).** Opt-in alternative when you only need one ranking table at an exact path: pass `--format csv --output <path> --csv-single-file`. Writes `hotspots` CSV content to `<path>` exactly (no `{stem}.meta.json` or `{stem}.hotspots.csv` siblings). Requires `--output`; incompatible with `--only` that excludes the needed section. Default stem bundle behavior is unchanged when the flag is omitted.

### Exit codes

| Code | Meaning |
| ---- | ------- |
| `0` | Scan completed successfully (`--explain` miss without `--fail-on-explain-miss` also exits `0`) |
| `1` | `--fail-on-explain-miss` when `--explain` target is not found |
| `2` | Invalid usage (missing command, bad flags), invalid config, or usage errors (including unknown removed `compare` / `baseline` / `--baseline` / `--strict`) |
| `130` | Scan cancelled by `SIGINT` (POSIX 128+2) — no report written |
| `143` | Scan cancelled by `SIGTERM` (POSIX 128+15) — no report written |

## Programmatic API

Import from the package entry point. After `pnpm build`, the public entry resolves to `dist/index.js` with types at `dist/index.d.ts` (`main` / `"exports"."."`).

```typescript
import {
  runScan,
  parseScanResult,
  ScanResultParseError,
  previewScanScope,
  runDoctor,
} from "@vitals/hotspot-scanner";
import type {
  ScanOptions,
  ScanResult,
  ScanScopePreview,
  DoctorResult,
  RunDoctorOptions,
} from "@vitals/hotspot-scanner";

const result: ScanResult = await runScan({
  repoPath: "/path/to/repo",
  since: "12 months ago",
  onWarning: (warning) =>
    console.warn(`[${warning.code ?? "warning"}] ${warning.message}`),
});

// Validate saved scan JSON programmatically
const raw: unknown = JSON.parse(fileContents);
const parsed = parseScanResult(raw); // throws ScanResultParseError on invalid shape

// Dry-run scope preview (no git mine / NCLOC)
const scope: ScanScopePreview = await previewScanScope({
  repoPath: "/path/to/repo",
});

// Pre-flight checks (Node, git, repo, config)
const doctor: DoctorResult = await runDoctor({
  targetPath: "/path/to/repo",
} satisfies RunDoctorOptions);
```

`runScan()` returns a typed `ScanResult` with full ranked arrays (no `--top` slicing). The CLI applies `--top` only when rendering table or markdown. `previewScanScope()` mirrors `scan --dry-run`; `runDoctor()` mirrors `doctor`. Public exports also include domain types (`HotspotScore`, `ScanMeta`, `DoctorFinding`, etc.) — see `src/index.ts`.

## Advanced

### Pipeline detail

```
git log --numstat (streaming) ∥ NCLOC size analysis → scoring (file hotspots) → table / JSON / markdown / CSV
```

1. **Git Change Miner** — streams `git log -M --numstat` to aggregate per-file churn; parses `old => new` rename lines into a `PathAliasMap` to canonicalize paths (no global `git log --follow`); emits rename-confidence warnings when applicable
2. **Size analyzer** — counts NCLOC from working-tree source files (state-machine scanner; no AST)
3. **Scoring** — ranks file hotspots from normalized NCLOC + churn (harmonic mean)
4. **Reporter** — renders table, JSON, markdown, or CSV bundle output

#### Scoring

- **Hotspot score:** `2 × normalize(ncloc) × normalize(churn) / (normalize(ncloc) + normalize(churn))` — harmonic mean after log1p + min-max normalization per scan

Churn is measured as raw commit count (not relative code churn). NCLOC is computed from the current working tree, not historical file versions.

### Performance and diagnostics

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

**Warnings (`meta.warnings`).** Structured `{ severity, message, code? }` objects — always the full list regardless of `--warnings`. See [docs/warning-codes.md](docs/warning-codes.md).

#### Warning codes

| Code | Interpretation |
| ---- | -------------- |
| `EMPTY_SINCE_WINDOW` | No commits in the `--since` window — widen the window |
| `RENAME_HISTORY_INCOMPLETE` | Rename tracking incomplete — churn may be split |
| `READ_FAILED` | Source file could not be read — omitted from hotspots |
| `MONOREPO_PATH_REMOUNT` | Scan remounted to git root; auto-include unless CLI `--include` set |
| `UNKNOWN_CONFIG_KEY` | Unknown config key (e.g. legacy `granularity`) — not applied |

Find-renames (`-M`) is enabled on git log spawns. The scanner does **not** use global `git log --follow`.

#### Rename confidence

Rename blind-spot messages use `code: "RENAME_HISTORY_INCOMPLETE"` (ambiguous chain, unlinked delete+add, `--since` truncation). Each appends an actionable **Next step:** sentence. Default stderr mode summarizes these; pass `--warnings=full` for per-path detail.

### Features

- **Hotspot ranking** — harmonic mean of NCLOC and churn to surface large, actively maintained files
- **Streaming Git parse** — single `git log --numstat` pass for file churn
- **Path scoping** — eligible TS/JS extensions; artifact and test default excludes; monorepo remount
- **Repo config file** — `.hotspot-scanner.json` with CLI > config > defaults
- **Flexible output** — table, JSON, markdown, or CSV bundle
- **Score explain** — `--explain <path>` prints a file breakdown to stderr

### `--explain` (stderr)

Runs the **full scan** and normal report first, then prints a breakdown to **stderr**.

Explains current file hotspot ranking.

**Target:** repo-relative or absolute file path (`<path>`). Function suffix (`path:name`) is rejected — file hotspots only.

Lookup uses full ranking arrays (ignores `--top`). Not found → message on stderr; scan still exits `0` on success unless `--fail-on-explain-miss` is set (then exit `1`). The flag requires `--explain`; used on `scan`.

### CLI reference

```
hotspot-scanner [-V|--version]
hotspot-scanner init [directory] [--force]
hotspot-scanner config validate [path]
hotspot-scanner config print [path] [--since <period>] [--include <glob>] [--exclude <glob>] [-t|--top <n>] [--concurrency <n>] [--config <path>] [-f|--format text|json]
hotspot-scanner doctor [path] [--config <path>] [--include-tests] [-f|--format text|json]
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
| `--no-color` | — | Disable ANSI colors in table output |
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

**`config validate`** — exits `0` when the config file parses; `2` on invalid JSON/types or when no discoverable config (and no explicit file). Does not require a git repository.

**`config print`** — shows effective merged options with per-field `cli` / `config` / `default` source tags; `-f json` for machine-readable output. Does not invoke git mining, NCLOC, or scoring.

**Error hints.** Common failures include a `Hint:` line with a concrete next step: non-git path, `--format csv` without `--output`, or missing explicit `--config` file. Exit `2` for usage and config errors; exit `1` for other runtime failures and `--fail-on-explain-miss`.

Run `hotspot-scanner scan --help` for copy-paste examples (cwd default, JSON output, short aliases).

#### Examples

```bash
hotspot-scanner --version
hotspot-scanner init                    # write schema-linked exemplar .hotspot-scanner.json
hotspot-scanner config validate         # validate discovered or explicit config (CI-friendly)
hotspot-scanner config print -f json    # effective options + provenance JSON
hotspot-scanner doctor .                # pre-flight: Node, git, repo, config, since, scope
hotspot-scanner doctor . -f json        # structured findings for scripts
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
```

## Limitations

- **TypeScript/JavaScript only** — other languages are not analyzed (eligible extensions: `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.mts`, `.cts`)
- **Commit-count churn** — churn is measured as raw commit count per file, not relative lines-of-code changed
- **Node.js 22+** — older Node versions are not supported (`engines.node >= 22`)
- **Git required** — the scanner shells out to `git log` at scan time; non-git trees use filesystem walk only for discovery

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, quality gates, and contribution workflow.

## Security

See [SECURITY.md](SECURITY.md) for the local trust model and how to report vulnerabilities.

## License

MIT — Copyright (c) 2026 Alan Taranti. See [LICENSE](LICENSE).
