# hotspot-scanner

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org/)
[![GitHub](https://img.shields.io/badge/github-taranti%2Fhotspot-scanner-181717?logo=github)](https://github.com/taranti/hotspot-scanner)

**Package:** `@vitals/hotspot-scanner` · **CLI command:** `hotspot-scanner`

## The problem

Tech leads need to prioritize refactoring work but struggle to see which TypeScript/JavaScript files are hardest to maintain — complex code that changes often.

## The solution

**hotspot-scanner** is a local CLI that ranks maintenance hotspots by combining **NCLOC** (non-commented lines of code) and Git churn at file level. It runs entirely on your machine — no hosted service, no telemetry.

> **Zero network during scan:** Once installed, hotspot-scanner makes **no outbound network calls** (zero network during `scan`, `compare`, `doctor`, or `baseline save`). Analysis reads your Git history and source files on disk only; there is no phone-home or remote service. (Cloning and installing the tool still requires network access to fetch this repository and its dependencies.)

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
- [Compare / baseline](#compare)
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
```

Try the bundled fixture:

```bash
pnpm exec hotspot-scanner scan tests/fixtures/repos/small-ts
```

### Adoption path

Before your first full scan, use the three onboarding commands:

```bash
hotspot-scanner init              # write exemplar .hotspot-scanner.json (use --force to overwrite)
hotspot-scanner doctor .          # check Node, git, repo, and config
hotspot-scanner scan . --dry-run  # preview effective since/include/exclude and eligible file count
```

`init` creates a valid config you can edit; `doctor` surfaces setup problems early and prints a **`scope`** line with the same eligible-file count `scan --dry-run` would use (shared remount/config prelude — a nested package directory does not need a local `.git`); `scan --dry-run` validates scope without mining git history or running NCLOC analysis.

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
| **Baseline / compare** | You want to track hotspot drift between scans over time | `hotspot-scanner baseline save .` then `hotspot-scanner compare . --baseline ./hotspot-baseline.json` (or `scan . --baseline ./hotspot-baseline.json`) |
| **Markdown in a PR** | You want a shareable report attached to a review | `hotspot-scanner scan . --format markdown --output report.md` |

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
| `--baseline` | — | Compare against a saved baseline JSON |
| `--only` | — | Include only `hotspots` (repeatable) |
| `--no-triage-hints` | — | Suppress triage hints in scan and compare table/markdown |
| `--no-color` | — | Disable ANSI colors in table output |
| `--explain <target>` | — | After the report, print a file-path score breakdown to stderr (compare mode: delta classification) |
| `--strict` | — | On compare (`scan --baseline` or `compare`): exit `1` when `COMPARE_SINCE_MISMATCH` is present after report write |
| `--quiet` | — | Suppress progress, info-level stderr diagnostics, and `--verbose` git traces |
| `--no-progress` | — | Suppress progress lines on stderr only |
| `--verbose` | — | Trace each git spawn argv on stderr (`verbose: git …`; suppressed when `--quiet`) |
| `--warnings` | `summary` | Stderr warning presentation: `summary` (default; one line per category with count) or `full` (per-path detail). Does not change JSON `meta.warnings` |
| `--dry-run` | — | Preview effective scope and eligible file count (no git mine / NCLOC) |

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

Restart your shell or reload the config after installing. Invalid shell names exit with usage error (exit `2`). See `hotspot-scanner completion --help`.

## Configuration

Run `hotspot-scanner init` to create an exemplar **`.hotspot-scanner.json`** in the current directory (or `init <dir>` for another path). Re-run without `--force` refuses to overwrite an existing file.

Optional **`.hotspot-scanner.json`** supplies shared scan defaults. Discovery filename is **only** `.hotspot-scanner.json` (not `.hotspotrc` or alternate names).

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

`format`, `output`, `baseline`, `--only`, `--no-triage-hints`, `--no-color`, `--quiet`, `--no-progress`, `--verbose`, and `--warnings` are **CLI-only** — they cannot be set in the config file. Unknown keys are **not** applied to merge (forward-compatible) but emit a warn-only `UNKNOWN_CONFIG_KEY` diagnostic listing the key names — see [warning codes](docs/warning-codes.md). Invalid JSON or invalid values for known keys exit non-zero with a clear error.

Example:

```json
{
  "since": "6 months ago",
  "include": ["src/**"],
  "top": 15,
  "concurrency": 2
}
```

Test files (`*.test.ts`/`.tsx`/`.js`/`.jsx`, `*.spec.ts`/`.tsx`/`.js`/`.jsx`, `__tests__/`) are excluded by default — no config entry needed. Use `--include-tests` on the CLI to audit test-suite health. Co-located `*.test.mjs` / `*.spec.cjs` (and similar) are **not** in the built-in test globs — see [Limitations](#limitations).

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
3. Still discovers **`.hotspot-scanner.json` from the original request path** (M30 parent walk unchanged); remount affects only pipeline `repoPath`.

An info diagnostic with code `MONOREPO_PATH_REMOUNT` is emitted when remount applies (see [warning codes](docs/warning-codes.md)). Scanning from the git root behaves as before — no remount, no auto-include.

**YAGNI:** path-only heuristic — no `pnpm-workspace.yaml`, nx, turborepo, or lerna parsers. To scan the whole monorepo from a package cwd, run from the git root or pass explicit `--include` globs.

`doctor` and `scan --dry-run` use the same remount, merged include/exclude, and eligible-file inventory (`doctor` reports it as the `scope` finding).

CI can point at a fixed config without discovery:

```bash
hotspot-scanner scan . --config /ci/hotspot-scanner.json --since "3 months ago" --top 10
```

`runScan()` uses the same discovery rules (`configPath` or parent walk from `repoPath`); explicit option values win over the loaded file.

## Output formats

Table and markdown reports include interpretation helpers (M41 + M51 + M53 on compare): an **executive summary** at the top (scan window, shown-vs-total counts, warning count by code), a **legend** or **How to read this** section defining metric columns, optional **triage hints** when conservative rules match visible rows, and optional **ANSI colors** on table score cells. JSON and CSV export raw data only (no summary, triage, or color).

**Scan triage rules** (table/markdown; disable with `--no-triage-hints`): one deterministic rule — dual-signal hotspot (`hotspotScore ≥ 0.7` with both normalized NCLOC and churn ≥ 0.5). Up to three matches; section omitted when empty.

**Compare triage rules** (M53 — compare table/markdown only; same `--no-triage-hints` flag): two **delta-aware** rules evaluated on the displayed compare rows — new dual-signal entity vs baseline, rank worsened by ≥5 with `hotspotScore ≥ 0.5`. Up to three matches per rule; omitted in JSON/CSV. Details: [`.specs/features/compare-interpretation/context.md`](.specs/features/compare-interpretation/context.md).

**Section filter (`--only`)**: Repeatable flag limiting output to `hotspots` only. Excluded sections are omitted from all formats. **Do not use `--only` with `--format json` output as a `--baseline`** — filtered JSON may fail baseline validation.

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

`--format json` writes the full `ScanResult` shape (`version: "3.0"`). Each hotspot entry includes **normalized scores and raw metrics** (`ncloc`, `commitCount`, `linesChanged`, `authorCount`).

Published JSON Schema files live under [`schemas/`](schemas/):

| Schema | TypeScript type |
| ------ | --------------- |
| [`schemas/scan-result.json`](schemas/scan-result.json) | `ScanResult` |
| [`schemas/compare-result.json`](schemas/compare-result.json) | `CompareResult` |

Use these schemas to validate CLI output or baselines in your own pipelines.

**`meta.timings`** (successful scans only): `gitMs`, `complexityMs`, `totalMs`. File-mode overlap: `gitMs` + `complexityMs` may sum above `totalMs`. Baselines at JSON `version: "2.0"`/`"1.0"`, with `coupling`, `cyclomaticComplexity`, or `functions` are rejected — re-scan with a current scanner (M57).

**`--top` does not slice JSON** — all ranked hotspots are exported for scripting and baselines.

```json
{
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
    "timings": {
      "gitMs": 1200,
      "complexityMs": 800,
      "totalMs": 1500
    }
  }
}
```

Save a baseline for compare mode:

```bash
# Preferred workflow (M40): explicit save verb — default ./hotspot-baseline.json
hotspot-scanner baseline save .

# Equivalent manual save (still supported)
hotspot-scanner scan . --format json --output baseline.json
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

**Compare bundle** (`--baseline baseline.json --format csv --output out/compare.csv`):

| File | Contents |
| ---- | -------- |
| `out/compare.meta.json` | Baseline/current metadata and warnings |
| `out/compare.hotspots.new.csv` | New hotspots |
| `out/compare.hotspots.removed.csv` | Removed hotspots |
| `out/compare.hotspots.rank-changed.csv` | Rank changes with baseline/current/delta columns |

Empty sections produce header-only CSV files. Data files have no section title rows.

### Compare

Save a baseline with `baseline save` (writes full `ScanResult` JSON; default `./hotspot-baseline.json`) or `scan . --format json --output <path>`. Then compare with the explicit `compare` subcommand or `scan --baseline`.

```bash
# Save baseline (default ./hotspot-baseline.json in cwd)
hotspot-scanner baseline save .

# Compare — explicit verb (recommended)
hotspot-scanner compare . --baseline ./hotspot-baseline.json

# Compare — scan flag (unchanged; same behavior)
hotspot-scanner scan . --baseline ./hotspot-baseline.json
```

Pass `--baseline <path>` with a prior `ScanResult` JSON. The CLI runs `compareScanResults()` and renders a **CompareResult** delta in the same `--format` as a normal scan (`compare` accepts the same format/output/top flags as `scan --baseline`).

**Baseline validation:** `loadBaseline()` performs strong structural validation. Baselines at JSON `version: "2.0"`/`"1.0"`, with `coupling`, `cyclomaticComplexity`, or `functions` are rejected — re-scan and save a fresh baseline (M57 `version: "3.0"`).

**Compare JSON** overview (schema: [`schemas/compare-result.json`](schemas/compare-result.json)):

```json
{
  "version": "3.0",
  "hotspots": {
    "new": [/* HotspotScore[] */],
    "removed": [/* HotspotScore[] */],
    "rankChanged": [
      {
        "entity": {
          "filePath": "src/medium.ts",
          "hotspotScore": 0.3,
          "ncloc": 12,
          "...": "..."
        },
        "baselineRank": 2,
        "currentRank": 1,
        "rankDelta": -1
      }
    ]
  },
  "meta": {
    "baseline": { "since": "12 months ago", "scannedAt": "..." },
    "current": { "since": "12 months ago", "scannedAt": "..." },
    "warnings": []
  }
}
```

`--top` slices table and markdown compare output only; JSON and CSV compare exports receive full delta arrays. Compare table and markdown include executive summary, how-to-read, and **delta-aware triage hints** (default on; `--no-triage-hints` to suppress). Use `--explain <path>` with `scan --baseline` or `compare` to print delta classification (new / removed / rank-changed) on stderr. Use `--strict` to fail CI when baseline and current `--since` windows differ (`COMPARE_SINCE_MISMATCH` — report still written).

### Exit codes

| Code | Meaning |
| ---- | ------- |
| `0` | Scan or compare completed successfully (compare with `--strict` may still exit `1` when `COMPARE_SINCE_MISMATCH` is present — see below) |
| `2` | Invalid usage (missing command, bad flags) |
| `1` | Runtime error (invalid path, git failure) or compare `--strict` hard fail on `COMPARE_SINCE_MISMATCH` after report write |
| `130` | Scan or compare cancelled by `SIGINT` (POSIX 128+2) — no report written |
| `143` | Scan or compare cancelled by `SIGTERM` (POSIX 128+15) — no report written |

## Programmatic API

Import from the package entry point. After `pnpm build`, the public entry resolves to `dist/index.js` with types at `dist/index.d.ts` (`main` / `"exports"."."`).

```typescript
import {
  runScan,
  compareScanResults,
  loadBaseline,
  parseScanResult,
  previewScanScope,
  runDoctor,
} from "@vitals/hotspot-scanner";
import type {
  ScanOptions,
  ScanResult,
  CompareResult,
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

// Compare against a saved baseline
const baseline = await loadBaseline("baseline.json");
const delta: CompareResult = compareScanResults(baseline, result);

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

**Stage overlap.** By default, git mining and NCLOC analysis run concurrently (M34). Use `--sequential` (or alias `--no-overlap`) to run them sequentially for lower peak memory — rankings unchanged.

**Source discovery.** In Git repositories, discovery prefers `git ls-files` (tracked paths only) filtered by eligible extensions and PathScope; on failure it falls back to a filesystem walk.

**Progress (stderr).** Git phase: throttled every 1,000 commits. Size analysis: throttled per batch (interval = batch size 50). On an **interactive TTY**, progress updates **one live line** on stderr (overwritten in place) and is **cleared** when the scan finishes or before warning lines — no permanent scroll spam. **Piped / CI** (non-TTY) keeps permanent newline-delimited progress logs for grepping. Use `--no-progress` or `--quiet` to suppress.

**Cancel (`SIGINT` / `SIGTERM`).** Aborts in-progress `runScan()`; no report on cancel; exit `130`/`143`.

**Verbose git argv (`--verbose`).** On `scan` and `compare` only: one stderr line per numstat spawn (`verbose: git …`). Not a config key; `--quiet` suppresses. Does **not** expand warning detail — use `--warnings=full` for that.

**Warnings on stderr (`--warnings`).** Default `summary`: aggregate repeated same-code / rename sub-kind lines into one stderr line per group (with count + next-step). Pass `--warnings=full` for per-path / per-pair detail (useful when debugging renames). CLI-only (not a config key). Composes with `--quiet` (progress/info still suppressed; warning/error follow the mode) and `--verbose` (git argv only — does not force full warnings).

| `phase` | When emitted |
| ------- | ------------ |
| `git` | Numstat stream (`--numstat`) |
| `complexity` | NCLOC analyzer batches (inline or worker pool) |

**Warnings (`meta.warnings`).** Structured `{ severity, message, code? }` objects — always the full list regardless of `--warnings`. See [docs/warning-codes.md](docs/warning-codes.md).

#### Warning codes

| Code | Interpretation |
| ---- | -------------- |
| `EMPTY_SINCE_WINDOW` | No commits in the `--since` window — widen the window |
| `RENAME_HISTORY_INCOMPLETE` | Rename tracking incomplete — churn may be split |
| `READ_FAILED` | Source file could not be read — omitted from hotspots |
| `COMPARE_SINCE_MISMATCH` | Baseline and current `--since` differ — use `--strict` to fail CI after report |
| `MONOREPO_PATH_REMOUNT` | Scan remounted to git root; auto-include unless CLI `--include` set |
| `UNKNOWN_CONFIG_KEY` | Unknown config key (e.g. legacy `granularity`) — not applied |

Find-renames (`-M`) is enabled on git log spawns. The scanner does **not** use global `git log --follow`.

#### Rename confidence

Rename blind-spot messages use `code: "RENAME_HISTORY_INCOMPLETE"` (ambiguous chain, unlinked delete+add, `--since` truncation). Each appends an actionable **Next step:** sentence. Default stderr mode summarizes these; pass `--warnings=full` for per-path detail.

### Features

- **Hotspot ranking** — harmonic mean of NCLOC and churn to surface large, actively maintained files
- **Scan compare** — diff current results against a saved baseline JSON
- **Streaming Git parse** — single `git log --numstat` pass for file churn
- **Path scoping** — eligible TS/JS extensions; artifact and test default excludes; monorepo remount
- **Repo config file** — `.hotspot-scanner.json` with CLI > config > defaults
- **Flexible output** — table, JSON, markdown, or CSV bundle
- **Score explain** — `--explain <path>` prints a file breakdown to stderr (compare mode: delta classification)

### `--explain` (stderr)

Runs the **full scan** and normal report first, then prints a breakdown to **stderr**.

**Compare mode:** explains against compare deltas (`new`, `removed`, `rank-changed`). **Scan-only:** explains current file hotspot ranking.

**Target:** repo-relative or absolute file path (`<path>`). Function suffix (`path:name`) is rejected — file hotspots only.

Lookup uses full ranking arrays (ignores `--top`). Not found → message on stderr; scan still exits `0` on success.

### CLI reference

```
hotspot-scanner [-V|--version]
hotspot-scanner init [directory] [--force]
hotspot-scanner doctor [path] [--config <path>] [--include-tests] [-f|--format text|json]
hotspot-scanner baseline save [path] [options]
hotspot-scanner compare [path] --baseline <file> [options]
hotspot-scanner scan [path] [options]
hotspot-scanner completion <bash|zsh|fish>
```

**`baseline save`** — runs a full scan and writes `ScanResult` JSON. Default output is `./hotspot-baseline.json` (cwd-relative). Supports scan options (`--since`, `--include`, `--exclude`, `--include-tests`, `--config`, `--concurrency`, `--top`) but not `--format` or `--baseline`.

**`compare`** — requires `--baseline <file>`; runs scan + compare + render (parity with `scan --baseline`). Accepts `--format`, `--output`, `--top`, and the same scan/config flags as `scan`.

| Flag | Default | Description |
| ---- | ------- | ----------- |
| `<path>` | `.` | Scan target (git root or nested directory inside a git workspace) |
| `-V`, `--version` | — | Print package version from `package.json` and exit |
| `--since` | `12 months ago` | Git history window |
| `-f`, `--format` | `table` | Output format: `table`, `json`, `markdown`, or `csv` (csv requires `--output`) |
| `-o`, `--output <path>` | — | Write report to file instead of stdout (required for `--format csv`) |
| `--baseline <path>` | — | Compare scan against baseline JSON from a prior run |
| `-t`, `--top` | `20` | Top N rows in table/markdown output (ignored for json/csv) |
| `--only <section>` | — | Include only `hotspots` (repeatable) |
| `--no-triage-hints` | — | Suppress triage hints in scan and compare table/markdown |
| `--no-color` | — | Disable ANSI colors in table output |
| `--explain <target>` | — | After the report, print file-path score breakdown to stderr |
| `--strict` | — | On compare: exit `1` when `COMPARE_SINCE_MISMATCH` is present after report write |
| `--include <glob>` | — | Include only paths matching glob (repeatable) |
| `--exclude <glob>` | — | Exclude paths matching glob (repeatable, additive) |
| `--include-tests` | — | Include test/spec files and `__tests__/` (lifts built-in test excludes only; artifact defaults and `--exclude` still apply) |
| `--config <path>` | — | Load config from explicit file (skips parent-directory discovery) |
| `--concurrency` | `min(availableParallelism(), 8)` | NCLOC analyzer worker-pool size (positive integer ≥ 1) |
| `--sequential` | — | Run git mining then NCLOC analysis sequentially (disables M34 overlap); `--no-overlap` is an alias |
| `--quiet` | — | Suppress progress and info-level diagnostics on stderr (warnings/errors remain per `--warnings`) |
| `--no-progress` | — | Suppress progress lines on stderr only |
| `--dry-run` | — | Preview effective since/include/exclude, test-file policy, and eligible file count without mining git or running NCLOC; `--format` / `--output` ignored; incompatible with `--baseline` |
| `--verbose` | — | Trace each git spawn argv on stderr (`verbose: git …`; `scan` / `compare` only; suppressed when `--quiet`; does not expand warnings) |
| `--warnings` | `summary` | Stderr warning presentation: `summary` (default) or `full` (per-path detail). JSON `meta.warnings` always full; CLI-only |

**`doctor --format`** — `text` (default) prints `status: message` lines; `json` prints `{ "version": "1.0", "findings": [...], "exitCode": N }` to stdout (JSON is emitted even when `exitCode` ≠ 0). Invalid format → usage error (exit `2`). Doctor does not run the scan pipeline.

**Error hints.** Common failures include a `Hint:` line with a concrete next step: non-git path, `--format csv` without `--output`, missing/invalid `--baseline`, or missing explicit `--config` file. Exit codes are unchanged (`2` for usage/config errors, `1` for other failures).

Run `hotspot-scanner scan --help` for copy-paste examples (cwd default, JSON output, short aliases, baseline).

#### Examples

```bash
hotspot-scanner --version
hotspot-scanner init                    # write exemplar .hotspot-scanner.json
hotspot-scanner doctor .                # pre-flight: Node, git, repo, config
hotspot-scanner doctor . -f json        # structured findings for scripts
hotspot-scanner scan . --dry-run        # scope preview before a full scan
hotspot-scanner scan                    # scan current directory (default path .)
hotspot-scanner scan . --since "6 months ago"
hotspot-scanner scan -f json -o report.json
hotspot-scanner scan -f table -t 10
hotspot-scanner scan . --format json --top 10  # --top ignored; full arrays exported
hotspot-scanner scan . --format markdown --output report.md
# CSV bundle (writes report.meta.json, report.hotspots.csv)
hotspot-scanner scan . --format csv --output report.csv
hotspot-scanner scan . --format json --output baseline.json
hotspot-scanner baseline save .                              # writes ./hotspot-baseline.json by default
hotspot-scanner baseline save . --output ci/baseline.json    # custom baseline path
hotspot-scanner compare . --baseline ./hotspot-baseline.json
hotspot-scanner scan . --baseline baseline.json              # same compare path as above
hotspot-scanner compare . --baseline baseline.json --explain src/medium.ts   # delta explain on stderr
hotspot-scanner compare . --baseline baseline.json --strict   # fail CI on since mismatch
hotspot-scanner scan . --only hotspots --format json   # partial export — not a valid baseline
hotspot-scanner scan . --baseline baseline.json --format markdown
# Compare CSV bundle (writes compare.meta.json + hotspot delta CSVs)
hotspot-scanner compare . --baseline baseline.json --format csv --output compare.csv
hotspot-scanner scan . --include "src/**"
hotspot-scanner scan . --include-tests --top 10
hotspot-scanner scan . --concurrency 1
hotspot-scanner scan . --explain src/hot.ts
hotspot-scanner scan . --quiet -f json -o report.json
hotspot-scanner scan . --verbose
hotspot-scanner scan . --warnings=full   # per-path rename / multi-file warning detail on stderr
```

## Limitations

- **TypeScript/JavaScript only** — other languages are not analyzed (eligible extensions: `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`; not `.mts`/`.cts`)
- **Test globs vs `.mjs`/`.cjs`** — built-in test excludes cover `.ts`/`.tsx`/`.js`/`.jsx` test/spec patterns only; `foo.test.mjs` or `bar.spec.cjs` may appear in rankings unless you `--exclude` them
- **Commit-count churn** — churn is measured as raw commit count per file, not relative lines-of-code changed
- **Node.js 22+** — older Node versions are not supported (`engines.node >= 22`)
- **Git required** — the scanner shells out to `git log` at scan time; non-git trees use filesystem walk only for discovery

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, quality gates, and contribution workflow.

## Security

See [SECURITY.md](SECURITY.md) for the local trust model and how to report vulnerabilities.

## License

MIT — Copyright (c) 2026 Alan Taranti. See [LICENSE](LICENSE).
