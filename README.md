# hotspot-scanner

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org/)
[![GitHub](https://img.shields.io/badge/github-taranti%2Fhotspot-scanner-181717?logo=github)](https://github.com/taranti/hotspot-scanner)

**Package:** `@vitals/hotspot-scanner` · **CLI command:** `hotspot-scanner`

## The problem

Tech leads need to prioritize refactoring work but struggle to see which TypeScript/JavaScript files are hardest to maintain and which file pairs change together without a static import link.

## The solution

**hotspot-scanner** is a local CLI that ranks maintenance hotspots by combining cyclomatic complexity, Git churn, and temporal coupling. It runs entirely on your machine — no hosted service, no telemetry.

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

`init` creates a valid config you can edit; `doctor` surfaces setup problems early and prints a **`scope`** line with the same eligible-file count `scan --dry-run` would use (shared remount/config prelude — a nested package directory does not need a local `.git`); `scan --dry-run` validates scope without mining git history or running AST analysis. When eligible file count exceeds 1000, dry-run preview includes a pathspec-scale warning (function mode will batch patch pathspecs).

**Example output** (fixture `small-ts`, truncated):

```
Scan window: 12 months ago (scanned 2026-07-24T14:38:40.375Z)

Top Hotspots
Rank  File                      Score     Cpx   CpxN      Churn  ChurnN  Funcs  Authors
----  ------------------------  --------  ----  --------  -----  ------  -----  -------
   1  src/high.ts                 0.5590    14    1.0000      5  0.3879      1        1
   2  src/medium.ts               0.5119     3    0.3440      7  1.0000      1        1
   3  src/low.ts                  0.0000     1    0.0000      4  0.0000      1        1

Top Coupling Pairs
Rank  File A                    File B                    Strength  Co-changes  StaticDep  Direction  Kinds
----  ------------------------  ------------------------  --------  ----------  ---------  ---------  ----------------------
   1  src/low.ts                src/medium.ts               0.7500           3         no       none  —
   2  src/high.ts               src/medium.ts               0.6000           3        yes        a→b  runtime
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
git log (streaming) → complexity (McCabe) → scoring (hotspot + coupling) → report (table / JSON / markdown / CSV)
```

1. **Git Change Miner** — streams `git log --numstat` for per-file churn and coupling pair counts
2. **Complexity Analyzer** — McCabe cyclomatic complexity over the working-tree AST via ts-morph
3. **Scoring** — harmonic mean of normalized complexity and churn; coupling strength from co-change counts
4. **Reporter** — table, JSON, markdown, or CSV bundle

See [Advanced](#advanced) for concurrency, mega-commit guard, rename confidence, and the full flag reference.

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
| `--only` | — | Include only `hotspots`, `coupling`, or `functions` (repeatable; union) |
| `--no-triage-hints` | — | Suppress triage hints in scan and compare table/markdown |
| `--no-color` | — | Disable ANSI colors in table output |
| `--explain <target>` | — | After the report, print a score breakdown for `<path>` or `<path>:<functionName>` to stderr (compare mode: delta classification) |
| `--strict` | — | On compare (`scan --baseline` or `compare`): exit `1` when `COMPARE_SINCE_MISMATCH` is present after report write |
| `--quiet` | — | Suppress progress, info-level stderr diagnostics, and `--verbose` git traces |
| `--no-progress` | — | Suppress progress lines on stderr only |
| `--verbose` | — | Trace each git spawn argv on stderr (`verbose: git …`; suppressed when `--quiet`) |
| `--dry-run` | — | Preview effective scope and eligible file count (no git mine / AST) |

Short aliases: `-f` / `--format`, `-o` / `--output`, `-t` / `--top`, `-g` / `--granularity`.

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
| `granularity` | `--granularity` | `"file"` or `"function"` |
| `minCochange` | `--min-cochange` | positive integer |
| `megaCommitThreshold` | `--mega-commit-threshold` | positive integer (default `100`) |
| `top` | `--top` | positive integer |
| `concurrency` | `--concurrency` | positive integer |

`format`, `output`, `baseline`, `--only`, `--no-triage-hints`, and `--no-color` are **CLI-only** — they cannot be set in the config file. Unknown keys are **not** applied to merge (forward-compatible) but emit a warn-only `UNKNOWN_CONFIG_KEY` diagnostic listing the key names — see [warning codes](docs/warning-codes.md). Invalid JSON or invalid values for known keys exit non-zero with a clear error.

Example:

```json
{
  "since": "6 months ago",
  "include": ["src/**"],
  "granularity": "file",
  "minCochange": 3,
  "megaCommitThreshold": 100,
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

1. Detects the git root with `git rev-parse --show-toplevel` and runs the pipeline from that root (`.git` validation, git mining, complexity discovery).
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

Table and markdown reports include interpretation helpers (M41 + M51 + M53 on compare): an **executive summary** at the top (scan window, granularity, shown-vs-total counts, coupling totals, warning count by code — `Warnings: 0` or `Warnings: N total (CODE: n, …)`), a **legend** or **How to read this** section defining metric columns, optional **triage hints** when conservative rules match visible rows, and optional **ANSI colors** on table score/StaticDep cells. JSON and CSV export raw data only (no summary, triage, or color).

**Scan triage rules** (table/markdown; disable with `--no-triage-hints`): three deterministic rules — dual-signal hotspot (`hotspotScore ≥ 0.7` with both normalized complexity and churn ≥ 0.5), strong coupling with a static dependency, and strong coupling without a static edge. Up to three matches per rule; section omitted when empty. Thresholds and hint text: [`.specs/features/output-interpretation-ux/context.md`](.specs/features/output-interpretation-ux/context.md) § D4.

**Compare triage rules** (M53 — compare table/markdown only; same `--no-triage-hints` flag): three **delta-aware** rules evaluated on the displayed compare rows — new dual-signal entity vs baseline, rank worsened by ≥5 with `hotspotScore ≥ 0.5`, and new strong coupling with a static dependency. Up to three matches per rule; omitted in JSON/CSV. Details: [`.specs/features/compare-interpretation/context.md`](.specs/features/compare-interpretation/context.md).

**Section filter (`--only`)**: Repeatable flag limiting output to `hotspots`, `coupling`, and/or `functions`. Excluded sections are omitted from all formats (no headers in table/markdown; keys/files omitted in JSON/CSV). **Do not use `--only` with `--format json` output as a `--baseline`** — filtered JSON omits top-level keys and will fail baseline validation. Save baselines from unfiltered JSON (`hotspot-scanner scan . --format json --output baseline.json`).

**Colors**: Table format only, when writing to an interactive TTY without `--output`, `--no-color`, or a non-empty `NO_COLOR`. Markdown, JSON, and CSV are always plain text.

### Table

Two sections: **Top Hotspots** (or **Top Functions** in function mode) and **Top Coupling Pairs**. `--top` limits rows per section. Default output also includes the executive summary, optional triage hints, and a metric legend footer.

```
Scan window: 12 months ago (scanned 2026-07-24T14:38:40.375Z)

Top Hotspots
Rank  File                      Score     Cpx   CpxN      Churn  ChurnN  Funcs  Authors
----  ------------------------  --------  ----  --------  -----  ------  -----  -------
   1  src/high.ts                 0.5590    14    1.0000      5  0.3879      1        1
   2  src/medium.ts               0.5119     3    0.3440      7  1.0000      1        1
   3  src/low.ts                  0.0000     1    0.0000      4  0.0000      1        1

Top Coupling Pairs
Rank  File A                    File B                    Strength  Co-changes  StaticDep  Direction  Kinds
----  ------------------------  ------------------------  --------  ----------  ---------  ---------  ----------------------
   1  src/low.ts                src/medium.ts               0.7500           3         no       none  —
   2  src/high.ts               src/medium.ts               0.6000           3        yes        a→b  runtime
```

### JSON

`--format json` writes the full `ScanResult` shape. Each hotspot entry includes **normalized scores and raw metrics** (`cyclomaticComplexity`, `functionCount`, `commitCount`, `linesChanged`, `authorCount`). Coupling entries include `hasStaticDependency`, `staticDependencyDirection`, and the three edge-kind booleans.

Published JSON Schema files live under [`schemas/`](schemas/):

| Schema | TypeScript type |
| ------ | --------------- |
| [`schemas/scan-result.json`](schemas/scan-result.json) | `ScanResult` |
| [`schemas/compare-result.json`](schemas/compare-result.json) | `CompareResult` |

Use these schemas to validate CLI output or baselines in your own pipelines.

**`meta.timings`** (successful scans only; wall-clock milliseconds, integers ≥ 0): `gitMs`, `complexityMs`, `totalMs`, and `functionChurnMs` (function mode only — omitted in file mode, not sent as `0`). `totalMs` covers the full `runScan()` body through scoring/enrich. In **file mode**, `gitMs` and `complexityMs` run concurrently (M34 overlap), so their sum may exceed `totalMs`; each field is that stage's own duration, not exclusive wall clock. Baselines saved before M51 may omit `timings`; `loadBaseline()` accepts documents with or without the field.

`--granularity` selects the active ranking array:

| Mode | Active array | Inactive array | `meta.granularity` |
| ---- | ------------ | -------------- | ------------------ |
| `file` (default) | `hotspots` | `functions: []` | `"file"` |
| `function` | `functions` | `hotspots: []` | `"function"` |

`coupling` is always file-pair ranked in both modes. **`--top` does not slice JSON** — all ranked entities are exported for scripting and baselines. **`--only` omits excluded top-level keys** — that export is for triage/scripting, not compare baselines (see [Section filter](#output-formats) above).

```json
{
  "version": "1.0",
  "hotspots": [
    {
      "filePath": "src/high.ts",
      "hotspotScore": 0.8571,
      "complexityNormalized": 1.0,
      "churnNormalized": 0.75,
      "cyclomaticComplexity": 42,
      "functionCount": 8,
      "commitCount": 15,
      "linesChanged": 320,
      "authorCount": 3
    }
  ],
  "functions": [],
  "coupling": [
    {
      "fileA": "src/high.ts",
      "fileB": "src/medium.ts",
      "coChangeCount": 3,
      "couplingStrength": 0.75,
      "hasStaticDependency": true,
      "staticDependencyDirection": "a-to-b",
      "hasRuntimeStaticDependency": true,
      "hasTypeOnlyStaticDependency": false,
      "hasReExportStaticDependency": false
    }
  ],
  "meta": {
    "since": "12 months ago",
    "scannedAt": "2026-07-22T12:00:00.000Z",
    "granularity": "file",
    "warnings": [
      {
        "severity": "warning",
        "code": "PARSE_FAILED",
        "message": "Failed to parse src/broken.ts: ..."
      }
    ],
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

`--format markdown` produces a GitHub-flavored report with executive summary, `## How to read this`, hotspot (or function) and coupling tables, and optional triage hints. Includes raw and normalized columns plus a `Lines` column on hotspots. `--top` slices rows at render time. Use `--output report.md` to write to a file. No ANSI colors in markdown.

### CSV bundle

`--format csv` writes a **multi-file bundle** derived from the `--output` path stem. **`--output` is required** for CSV; metadata lives only in `{stem}.meta.json`, not inside data files. **`--top` is ignored** — full ranked lists are exported.

**Scan bundle** (`--output out/report.csv`):

| File | Contents |
| ---- | -------- |
| `out/report.meta.json` | Scan metadata (`since`, `scannedAt`, `granularity`, `warnings`, `timings` when present) |
| `out/report.hotspots.csv` | File-mode ranking (or `report.functions.csv` in function mode) |
| `out/report.coupling.csv` | Coupling pairs (includes `staticDependencyDirection` and kind columns) |

**Compare bundle** (`--baseline baseline.json --format csv --output out/compare.csv`):

| File | Contents |
| ---- | -------- |
| `out/compare.meta.json` | Baseline/current metadata and warnings |
| `out/compare.hotspots.new.csv` | New hotspots (or `functions.*` in function mode) |
| `out/compare.hotspots.removed.csv` | Removed hotspots |
| `out/compare.hotspots.rank-changed.csv` | Rank changes with baseline/current/delta columns |
| `out/compare.coupling.new.csv` | New coupling pairs |
| `out/compare.coupling.removed.csv` | Removed coupling pairs |
| `out/compare.coupling.rank-changed.csv` | Coupling rank changes |

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

**Baseline validation:** `loadBaseline()` (used by `--baseline` and the programmatic API) performs strong structural validation on the saved JSON — not just top-level keys. Malformed hotspot, function, or coupling items throw `BaselineError` with a path-specific message. Coupling items must include all static enrichment fields (`hasStaticDependency`, `staticDependencyDirection`, and the three kind booleans); baselines from older scanner versions that omit these fields are rejected with a message to **re-scan** and save a fresh baseline. See [`schemas/scan-result.json`](schemas/scan-result.json) for the full contract.

Delta sections classify entities as **new**, **removed**, or **rank changed** for hotspots/functions (mode-dependent) and coupling pairs. Granularity must match between baseline and current scan.

**Compare JSON** overview (schema: [`schemas/compare-result.json`](schemas/compare-result.json)):

```json
{
  "version": "1.0",
  "granularity": "file",
  "hotspots": {
    "new": [/* HotspotScore[] */],
    "removed": [/* HotspotScore[] */],
    "rankChanged": [
      {
        "entity": {
          "filePath": "src/medium.ts",
          "hotspotScore": 0.3,
          "...": "..."
        },
        "baselineRank": 2,
        "currentRank": 1,
        "rankDelta": -1
      }
    ]
  },
  "functions": { "new": [], "removed": [], "rankChanged": [] },
  "coupling": { "new": [], "removed": [], "rankChanged": [] },
  "meta": {
    "baseline": {
      "since": "12 months ago",
      "scannedAt": "...",
      "granularity": "file"
    },
    "current": {
      "since": "12 months ago",
      "scannedAt": "...",
      "granularity": "file"
    },
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
  granularity: "file",
  minCochange: 3,
  onWarning: (warning) =>
    console.warn(`[${warning.code ?? "warning"}] ${warning.message}`),
});

// Compare against a saved baseline
const baseline = await loadBaseline("baseline.json");
const delta: CompareResult = compareScanResults(baseline, result);

// Dry-run scope preview (no git mine / AST)
const scope: ScanScopePreview = await previewScanScope({
  repoPath: "/path/to/repo",
});

// Pre-flight checks (Node, git, repo, config)
const doctor: DoctorResult = await runDoctor({
  targetPath: "/path/to/repo",
} satisfies RunDoctorOptions);
```

`runScan()` returns a typed `ScanResult` with full ranked arrays (no `--top` slicing). The CLI applies `--top` only when rendering table or markdown. `previewScanScope()` mirrors `scan --dry-run`; `runDoctor()` mirrors `doctor`. Public exports also include domain types (`HotspotScore`, `CouplingPair`, `ScanMeta`, `DoctorFinding`, etc.) — see `src/index.ts`.

## Advanced

### Pipeline detail

```
git log --numstat (streaming) ∥ complexity (McCabe) [file mode] → scoring (file hotspots or function hunk-overlap churn) → coupling + static enrich → table / JSON / markdown / CSV
```

1. **Git Change Miner** — streams `git log -M --numstat` to aggregate per-file churn and coupling pair counts (`pair → coChangeCount` during the stream — no retained per-commit event array for scoring); parses `old => new` rename lines into a `PathAliasMap` to canonicalize paths (no global `git log --follow`); skips coupling increments for mega-commits (unique in-scope files `>` effective `megaCommitThreshold`, default 100) while still counting churn; emits rename-confidence and mega-commit warnings when applicable
2. **Complexity Analyzer** — computes McCabe cyclomatic complexity over the working-tree AST via ts-morph
3. **Scoring** — file mode ranks hotspots from file churn + complexity; function mode (`--granularity function`) runs sequential pathspec-restricted `git log -M -p --unified=0` patch stream(s) (batched when allowlist `> 1000`) and attributes commits whose hunks overlap each function's current line range — per-function churn is **not** inherited from parent-file stats; coupling pairs are ranked from the numstat pass in both modes
4. **Static coupling enricher** — sets static-dependency fields on each coupling pair from working-tree import/export/require edges (relative paths + tsconfig/jsconfig `paths`/`baseUrl`; direction and edge-kind flags)
5. **Reporter** — renders table, JSON, markdown, or CSV bundle output

#### Scoring

- **Hotspot score:** `2 × normalize(complexity) × normalize(churn) / (normalize(complexity) + normalize(churn))` — harmonic mean after log1p + min-max normalization per scan
- **Coupling strength:** `coChangeCount / min(commitsA, commitsB)`
- **Static dependency:** `hasStaticDependency` is `true` when either file has a resolvable static import/export/require to the other; `staticDependencyDirection` and kind flags (`hasRuntimeStaticDependency`, `hasTypeOnlyStaticDependency`, `hasReExportStaticDependency`) add triage detail; ranking is unchanged

Churn is measured as raw commit count (not relative code churn). Complexity is computed from the current working tree, not historical file versions.

### Performance and diagnostics

**Concurrency.** The complexity stage processes files in parallel via a bounded `worker_threads` pool. Default pool size is `min(os.availableParallelism(), 8)` (same as `DEFAULT_WORKER_CONCURRENCY` in code). Higher concurrency uses more memory (N workers × batch AST heap); lower with `--concurrency 1`–`4` on memory-constrained hosts. Override with `--concurrency <n>` or the `concurrency` key in `.hotspot-scanner.json` — precedence is **CLI > config > default**. Invalid values (non-integer or less than 1) exit non-zero before the scan starts.

**Stage overlap (file mode).** By default, git mining and complexity analysis run concurrently (M34). Use `--sequential` (or alias `--no-overlap`) to run them one after the other for lower peak memory or deterministic stage order — rankings unchanged. Not a config key. For manual wall-clock A/B, see `pnpm bench` in [`scripts/benchmark-scan.md`](scripts/benchmark-scan.md) (outside `pnpm test`).

**Source discovery.** In Git repositories, complexity discovery prefers `git ls-files` (tracked paths only) filtered by eligible extensions (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`) and PathScope; on spawn failure it falls back to a recursive filesystem walk with directory prune (same as non-git trees).

**Mega-commit guard (coupling).** Commits with more unique in-scope files than the effective mega-commit threshold (default **100**) skip coupling pair increments (churn still counted) and may emit `MEGA_COMMIT_SKIPPED` warnings. Override with `--mega-commit-threshold <n>` or `megaCommitThreshold` in `.hotspot-scanner.json` (CLI > config > default). This prevents `C(n, 2)` pair explosion on bulk commits; coupling rankings may omit pairs from those commits.

**Function-mode pathspec batching.** When `--granularity function` and the churned eligible allowlist exceeds 1000 paths, patch mining runs sequential `git log -p` batches with pathspecs (`≤ 1000` per spawn). Dry-run previews a warning when eligible discovery count exceeds 1000. ARG_MAX failures retry with half-size chunks, then may fall back to unrestricted streaming with `PATHSPEC_ARG_MAX_FALLBACK`.

**Progress (stderr).** During long git streams, the CLI logs throttled progress every 1,000 commits per phase. During complexity analysis, progress logs after each batch (throttled on file count, interval = batch size 50). Use `--no-progress` to silence all progress lines, or `--quiet` to also suppress info-level warnings and `--verbose` git traces (`--quiet` is a superset of `--no-progress`). Reports on stdout (or `--output`) and warning/error diagnostics still appear unless suppressed by severity rules above.

**Cancel (`SIGINT` / `SIGTERM`).** While `scan` or `compare` is in flight, the CLI installs process signal listeners, aborts the in-progress `runScan()`, and waits for git children and complexity workers to settle (same M34 abort path as sibling failures). No scan/compare report is written on cancel; stderr prints one line: `warning: scan cancelled`. Exit `130` for `SIGINT`, `143` for `SIGTERM`.

**Verbose git argv (`--verbose`).** On `scan` and `compare` only: before each git numstat or function-churn patch spawn, one stderr line `verbose: git <argv joined by space>`. Scope is spawn argv only — not AST dumps, progress, or scoring traces. Not a config key; `--quiet` suppresses verbose lines even when `--verbose` is set.

| `phase` | When emitted |
| ------- | ------------ |
| `git` | File-mode numstat stream (`--numstat`) |
| `function-churn` | Function-mode patch stream (`-p --unified=0`) |
| `complexity` | Complexity analyzer batches (inline or worker pool) |

Git format: `Processing <phase> commit <N>...` (e.g. `Processing function-churn commit 1,000...`). Complexity format: `Processing complexity batch <N>/<totalBatches> (<filesProcessed>/<totalFiles> files)...`.

**Warnings (`meta.warnings`).** Scan and compare JSON include structured warnings on `meta.warnings` — an array of `{ severity, message, code? }` objects (`ScanWarning`). The CLI also prints each warning to stderr with a severity prefix (`info:`, `warning:`, `error:`). Programmatic callers receive the same objects via `onWarning`.

**Severity vs exit code.** `severity` classifies diagnostics only. A successful scan exits `0` even when warnings are present. Hard failures (invalid repo, git error, bad CLI args) still exit non-zero per the [exit codes table](#exit-codes).

#### Warning codes

Stable `code` field for filtering and docs. Full cheatsheet: [docs/warning-codes.md](docs/warning-codes.md).

Short reference:

| Code | Interpretation |
| ---- | -------------- |
| `EMPTY_SINCE_WINDOW` | No commits in the `--since` window — rankings may be empty or sparse; widen the window |
| `RENAME_HISTORY_INCOMPLETE` | Rename tracking incomplete for one or more paths — churn may be split; includes rename-confidence messages (ambiguous chain, unlinked delete+add, `--since` truncation, function-mode overlap confidence) |
| `PARSE_FAILED` | A source file could not be parsed for complexity — file skipped; fix syntax or exclude the path |
| `COMPARE_SINCE_MISMATCH` | Baseline and current scan used different `--since` values — rank deltas are less comparable; add `--strict` on compare to exit `1` after the report is written |
| `MEGA_COMMIT_SKIPPED` | One or more commits exceeded the effective mega-commit threshold (default 100 unique in-scope files) — those commits did not contribute to coupling pair counts (churn still counted); override with `--mega-commit-threshold` or config `megaCommitThreshold` |
| `PATHSPEC_ARG_MAX_FALLBACK` | Function-mode patch pathspec batch exceeded argv limits after retry — miner fell back to unrestricted stream for the failing remainder; rankings remain correct |
| `MONOREPO_PATH_REMOUNT` | Scan path was remounted to the git root; auto-include pattern applied unless CLI `--include` was set — see [Scanning from a package directory](#scanning-from-a-package-directory-monorepo) |
| `UNKNOWN_CONFIG_KEY` | Unknown key(s) in `.hotspot-scanner.json` — ignored for merge; fix typos or move CLI-only keys to flags |

Find-renames (`-M`) is enabled on git log spawns so real renames can unify churn under canonical paths. The scanner does **not** use global `git log --follow`.

#### Rename confidence

Rename blind-spot messages are emitted with `code: "RENAME_HISTORY_INCOMPLETE"`. Typical human-readable patterns (each appends an actionable **Next step:** sentence — codes unchanged):

| Message pattern | When | Next step |
| --------------- | ---- | --------- |
| `Rename history may be incomplete for: …` | Ambiguous rename chain (`PathAliasMap`) | Verify rename detection or widen `--since` |
| `Suspected unlinked rename (no git rename metadata): …` | Same-commit delete+add that looks like a move but git emitted no `=>` line | Ensure git records renames (`-M` is enabled) or widen `--since` |
| `Rename history before the --since window (…) may be missing under canonical paths` | `--since` is set and at least one rename link was seen in the window | Widen `--since` to include pre-window rename history |
| Function overlap confidence (function mode only) | Rename links or ambiguous paths during per-function hunk attribution | Treat function ranks cautiously after moves; prefer file mode or wider `--since` |

`EMPTY_SINCE_WINDOW` also appends a next-step hint to widen `--since` or check path scope.

### Features

- **Hotspot ranking** — harmonic mean of complexity and churn to surface actively maintained complex code
- **Temporal coupling** — find file pairs that co-change together; static enrichment flags import edges (`hasStaticDependency`), direction (`a→b` / `b→a` / `both`), and edge kinds (runtime, type-only, re-export) including tsconfig `paths` aliases
- **Function granularity** — rank individual functions with `--granularity function`; per-function churn comes from hunk overlap on a patch stream, not inherited parent-file stats
- **Scan compare** — diff current results against a saved baseline JSON (`baseline save`, `compare --baseline`, or `scan --baseline`)
- **Streaming Git parse** — file mode streams `git log --numstat` for churn and coupling; function mode adds sequential pathspec-restricted patch stream(s) (`git log -p --unified=0`, batched when allowlist `> 1000`) for per-function hunk attribution
- **Path scoping** — eligible sources: `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`; default artifact excludes for `node_modules`, `.git`, `dist`, `coverage`, `build`, `.next`, `out`, `vendor`, `storybook-static`, `__snapshots__`, `.turbo`, `.vercel`, `.cache`, `.nuxt`, `.output`, `.parcel-cache`, and `tmp`; default test excludes for `*.test.ts`/`.tsx`/`.js`/`.jsx`, `*.spec.ts`/`.tsx`/`.js`/`.jsx`, and `__tests__/`; optional `--include` / `--exclude` globs (additive on defaults); `--include-tests` lifts built-in test excludes only; nested package cwd → git root remount with auto-include `{prefix}/**` unless CLI `--include` is set
- **Repo config file** — optional `.hotspot-scanner.json` discovered at the scan target or in a parent directory; `--config <path>` for explicit CI paths (CLI flags override)
- **Flexible output** — CLI table, JSON, GitHub-flavored markdown, or multi-file CSV bundle
- **Score explain** — `--explain <path>` or `--explain <path>:<functionName>` prints a breakdown to stderr after the normal report (full scan always; with `--baseline` / `compare`, explains compare deltas — new / removed / rank-changed)

### `--explain` (stderr)

Runs the **full scan** and normal report first, then prints a human-readable breakdown to **stderr** (stdout and `--output` files stay report-only).

**Compare mode** (`scan --baseline` or `compare`): explains against **compare deltas** — classification `new`, `removed`, or `rank-changed` with baseline/current ranks and score fields. Not found → `explain: no compare delta for <target>` on stderr.

**Scan-only** (`scan` without `--baseline`): explains current rankings (M42 behavior below).

**Target grammar** (`--explain <target>`):

| Form | Meaning |
| ---- | ------- |
| `<path>` | File path relative to repo root (or absolute under repo); leading `./` ignored |
| `<path>:<functionName>` | Function — suffix after the **last** `:` must match identifier segments (`foo`, `Foo.bar`); otherwise the whole string is treated as a path |

**Granularity:**

| `--granularity` | Accepted target |
| --------------- | --------------- |
| `file` (default) | `<path>` only — `path:function` exits with usage error; suggest `--granularity function` |
| `function` | `<path>` explains all ranked functions in that file; `<path>:<functionName>` explains one function |

Lookup uses the **full** ranking arrays (ignores `--top`). A target not in rankings prints `explain: no hotspot ranking for …` or `explain: no function ranking for …` to stderr; the scan still exits `0` on success.

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

**`baseline save`** — runs a full scan and writes `ScanResult` JSON. Default output is `./hotspot-baseline.json` (cwd-relative). Supports scan options (`--since`, `--granularity`, `--include`, `--exclude`, `--include-tests`, `--config`, `--concurrency`, `--min-cochange`, `--mega-commit-threshold`, `--top`) but not `--format` or `--baseline`. Overwrites an existing file without prompting.

**`compare`** — requires `--baseline <file>`; runs scan + compare + render (parity with `scan --baseline`). Accepts `--format`, `--output`, `--top`, and the same scan/config flags as `scan`.

| Flag | Default | Description |
| ---- | ------- | ----------- |
| `<path>` | `.` | Scan target (git root or nested directory inside a git workspace) |
| `-V`, `--version` | — | Print package version from `package.json` and exit |
| `--since` | `12 months ago` | Git history window |
| `-f`, `--format` | `table` | Output format: `table`, `json`, `markdown`, or `csv` (csv requires `--output`) |
| `-g`, `--granularity` | `file` | Ranking granularity: `file` or `function` |
| `-o`, `--output <path>` | — | Write report to file instead of stdout (required for `--format csv`) |
| `--baseline <path>` | — | Compare scan against baseline JSON from a prior run |
| `-t`, `--top` | `20` | Top N rows in table/markdown output (ignored for json/csv) |
| `--only <section>` | — | Include only `hotspots`, `coupling`, or `functions` (repeatable) |
| `--no-triage-hints` | — | Suppress triage hints in scan and compare table/markdown |
| `--no-color` | — | Disable ANSI colors in table output |
| `--explain <target>` | — | After the report, print score breakdown for `<path>` or `<path>:<functionName>` to stderr |
| `--strict` | — | On compare: exit `1` when `COMPARE_SINCE_MISMATCH` is present after report write |
| `--min-cochange` | `3` | Minimum co-change count for coupling pairs |
| `--mega-commit-threshold` | `100` | Unique in-scope files per commit above which coupling pair increments are skipped (churn still counted) |
| `--include <glob>` | — | Include only paths matching glob (repeatable) |
| `--exclude <glob>` | — | Exclude paths matching glob (repeatable, additive) |
| `--include-tests` | — | Include test/spec files and `__tests__/` (lifts built-in test excludes only; artifact defaults and `--exclude` still apply) |
| `--config <path>` | — | Load config from explicit file (skips parent-directory discovery) |
| `--concurrency` | `min(availableParallelism(), 8)` | Complexity analyzer worker-pool size (positive integer ≥ 1) |
| `--sequential` | — | Run git mining then complexity sequentially (disables M34 file-mode overlap); `--no-overlap` is an alias |
| `--quiet` | — | Suppress progress and info-level diagnostics on stderr (warnings/errors remain) |
| `--no-progress` | — | Suppress progress lines on stderr only |
| `--dry-run` | — | Preview effective since/include/exclude, test-file policy (`test files: excluded\|included`), and eligible file count without mining git history or running AST analysis; warns when eligible files exceed 1000 (function-mode pathspec batching); `--format` / `--output` ignored; incompatible with `--baseline` |
| `--verbose` | — | Trace each git spawn argv on stderr (`verbose: git …`; `scan` / `compare` only; suppressed when `--quiet`) |

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
hotspot-scanner scan -f table -t 10 -g function
hotspot-scanner scan . --format json --top 10  # --top ignored; full arrays exported
hotspot-scanner scan . --granularity function --format json
hotspot-scanner scan . --format markdown --output report.md
# CSV bundle (writes report.meta.json, report.hotspots.csv, report.coupling.csv)
hotspot-scanner scan . --format csv --output report.csv
hotspot-scanner scan . --format json --output baseline.json
hotspot-scanner baseline save .                              # writes ./hotspot-baseline.json by default
hotspot-scanner baseline save . --output ci/baseline.json    # custom baseline path
hotspot-scanner compare . --baseline ./hotspot-baseline.json
hotspot-scanner scan . --baseline baseline.json              # same compare path as above
hotspot-scanner compare . --baseline baseline.json --explain src/medium.ts   # delta explain on stderr
hotspot-scanner compare . --baseline baseline.json --strict   # fail CI on since mismatch
hotspot-scanner scan . --only coupling --format json   # partial export — not a valid baseline
hotspot-scanner scan . --baseline baseline.json --format markdown
# Compare CSV bundle (writes compare.meta.json + six data CSVs)
hotspot-scanner compare . --baseline baseline.json --format csv --output compare.csv
hotspot-scanner scan . --include "src/**"                    # tests excluded by default
hotspot-scanner scan . --include-tests --top 10              # audit test-suite hotspots
hotspot-scanner scan . --concurrency 1   # sequential complexity batches (debug / low-memory)
hotspot-scanner scan . --mega-commit-threshold 200   # raise mega-commit coupling skip threshold
hotspot-scanner scan . --explain src/hot.ts   # score breakdown on stderr after report
hotspot-scanner scan . -g function --explain src/hot.ts:myFn
hotspot-scanner scan . --quiet -f json -o report.json   # CI: clean stderr, full report
hotspot-scanner scan . --verbose                        # debug git argv on stderr
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
