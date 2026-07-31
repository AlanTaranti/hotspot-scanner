# hotspot-scanner

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org/)
[![GitHub](https://img.shields.io/badge/github-AlanTaranti%2Fhotspot-scanner-181717?logo=github)](https://github.com/AlanTaranti/hotspot-scanner)
[![CodeScene Average Code Health](https://codescene.io/projects/83124/status-badges/average-code-health)](https://codescene.io/projects/83124)
[![CodeScene Hotspot Code Health](https://codescene.io/projects/83124/status-badges/hotspot-code-health)](https://codescene.io/projects/83124)

**Package:** `@taranti/hotspot-scanner` · **CLI command:** `hotspot-scanner`

## The problem

Tech leads need to prioritize refactoring, but most codebases don't make that obvious. Which files are actually hard to maintain — complex, and changing all the time?

## The solution

**hotspot-scanner** is a local CLI that ranks maintenance hotspots by combining NCLOC (non-commented lines of code) and Git churn, at file level. It runs entirely on your machine. No hosted service, no telemetry.

> **Zero network during scan.** Once installed, hotspot-scanner makes no outbound calls — not during `scan`, not during `doctor`. Analysis reads your Git history and source files on disk, nothing else. No phone-home, no remote service. (Cloning and installing the tool still needs network access, to fetch the repo and its dependencies.)

## Table of contents

- [Quick start](#quick-start)
- [Commands at a glance](#commands-at-a-glance)
- [Use this when…](#use-this-when)
- [Recipes](docs/recipes.md)
- [How it works](#how-it-works)
  - [Why these metrics?](#why-these-metrics)
- [Methodology](docs/methodology.md)
- [Essential flags](#essential-flags)
- [Requirements](#requirements)
- [Installation](#installation)
- [Shell completion](#shell-completion)
- [Configuration](#configuration)
- [Output formats](#output-formats)
- [Programmatic API](#programmatic-api)
- [CLI reference](docs/cli-reference.md)
- [Documentation](#documentation)
- [Limitations](#limitations)
- [Contributing](#contributing)
- [Security](SECURITY.md)
- [License](#license)

## Quick start

```bash
git clone https://github.com/AlanTaranti/hotspot-scanner.git
cd hotspot-scanner
pnpm install
pnpm build
cd /path/to/your-repo
pnpm exec hotspot-scanner scan   # optional path defaults to .
# Path-first shorthand (equivalent to scan):
pnpm exec hotspot-scanner .
```

Or try the bundled fixture first:

```bash
pnpm exec hotspot-scanner scan tests/fixtures/repos/small-ts
```

Before your first full scan, run `hotspot-scanner init`, then `config validate` / `config print`, then `doctor .`, then `scan . --dry-run`. Each one catches a different setup problem early. See [Configuration](#configuration).

**Example output** (fixture `small-ts`, truncated):

```
Scan window: 12 months ago (scanned 2026-07-30T12:13:38.361Z)

Top Hotspots
Rank  File                      Score     NLOC  NLOCN     Churn  ChurnN  Authors  Lines
----  ------------------------  --------  ----  --------  -----  ------  -------  -----
   1  src/high.ts                 0.6089    26    0.5350      5  0.7067        1     35
   2  src/medium.ts               0.4085     9    0.2567      7  1.0000        1     21
   3  bootstrap-repo.mjs          0.0000   141    1.0000      2  0.0000        1    235
```

## Commands at a glance

| Command  | Question it answers                    | Example                            |
| -------- | -------------------------------------- | ---------------------------------- |
| `init`   | Scaffold a schema-linked config file?  | `hotspot-scanner init`             |
| `doctor` | Is this repo ready to scan?            | `hotspot-scanner doctor .`         |
| `scan`   | Which files are maintenance hotspots?  | `hotspot-scanner scan . --top 10`  |
| `trend`  | How did this file's complexity evolve? | `hotspot-scanner trend src/foo.ts` |
| `assess` | Are the top hotspots getting worse?    | `hotspot-scanner assess .`         |

Typical flow: `scan` → `scan --explain <path>` → `trend <path>`. Or, for a batch, `assess .`.

Cookbooks: [Hotspot drill-down](docs/recipes.md#hotspot-drill-down-scan--explain--trend) · [Scan → assess](docs/recipes.md#scan--assess-batch-deteriorating-hotspots).

Assess orchestration: [CLI reference → Scan → assess](docs/cli-reference.md#scan--assess).

## Use this when…

| You want…                                          | When to run                            | Example                                                       |
| -------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------- |
| A ranked list for this sprint                      | Weekly triage of files to refactor     | `hotspot-scanner scan . --since "3 months ago" --top 10`      |
| A shareable report in a PR                         | Attach markdown output to a review     | `hotspot-scanner scan . --format markdown --output report.md` |
| Machine-readable output                            | Scripts, dashboards, CI artifacts      | `hotspot-scanner scan . --format json --output scan.json`     |
| Score context, then history for one file           | A hotspot catches your eye, dig in     | `scan --explain <path>` → `trend <path>`                      |
| Which top hotspots look like they're getting worse | Batch check, no manual trends per file | `assess . --min-hotspot-score 0.7 --top 10`                   |

Copy-paste cookbooks, including monorepo scoping: [docs/recipes.md](docs/recipes.md).

## How it works

```
scan   → find hotspots
trend  → inspect one file over time
assess → scan + trend on top hotspots
```

`scan` pipeline:

```
git log (streaming) → NCLOC size analysis → scoring (hotspot) → report (table / JSON / markdown / CSV)
```

1. **Git Change Miner** — streams `git log --numstat` for per-file churn
2. **Size analyzer** — counts non-commented lines of code (NCLOC) from working-tree source files
3. **Scoring** — harmonic mean of normalized NCLOC and churn
4. **Reporter** — table, JSON, markdown, or CSV bundle

`trend` is a separate per-file history command. `assess` orchestrates scan, then runs trend sequentially on the top results. Pipeline internals: [docs/cli-reference.md](docs/cli-reference.md#pipeline-detail).

### Why these metrics?

NCLOC and indentation are proxies for prioritization, not a replacement for AST or McCabe. The framework comes from Tornhill's _Your Code as a Crime Scene_: a hotspot is structural weight intersecting change frequency — complexity alone, in a file nobody touches, is low-interest debt.

- `scan` ranks with the harmonic mean of normalized NCLOC and Git churn — a size signal stakeholders already understand, and churn is where the team is actually editing
- Indentation is for `trend` / `assess` only — whitespace nesting over Git history, Tornhill-style, not the main ranking
- The goal is the small slice of files absorbing most of the commits. That's the high-interest debt

Full write-up: [docs/methodology.md](docs/methodology.md). Growth-pattern labels: [Tornhill growth curves](docs/recipes.md#tornhill-growth-curves-trend-pattern).

## Essential flags

| Flag                      | Default         | Description                                                                                          |
| ------------------------- | --------------- | ---------------------------------------------------------------------------------------------------- |
| `<path>`                  | `.`             | Scan target (git root or nested directory inside a git workspace)                                    |
| `--since`                 | `12 months ago` | Git history window                                                                                   |
| `-f`, `--format`          | `table`         | `table`, `json`, `markdown`, or `csv`                                                                |
| `-t`, `--top`             | `20`            | `scan`: top N table/markdown rows (ignored for json/csv); `assess`: candidate cap after score filter |
| `-o`, `--output`          | —               | Write report to file (required for `--format csv`)                                                   |
| `--include` / `--exclude` | —               | Path globs (repeatable)                                                                              |
| `--explain <target>`      | —               | After the report, print a file-path score breakdown to stderr                                        |
| `--dry-run`               | —               | Preview scope and config, skip the git mine and NCLOC pass                                           |

Full flag list: [docs/cli-reference.md](docs/cli-reference.md#command-synopsis-and-flags). Also: `hotspot-scanner scan --help`.

## Requirements

| Requirement | Version               |
| ----------- | --------------------- |
| Node.js     | 22+                   |
| git         | required at scan time |
| pnpm        | for development       |

## Installation

Official install is clone + build from source — see [Quick start](#quick-start). No npm registry install yet.

## Shell completion

Tab-complete subcommands and common flags for bash, zsh, or fish. The `completion` subcommand just prints a static script to stdout — no scan, no git work:

```bash
# bash — append to ~/.bashrc or a sourced file
hotspot-scanner completion bash >> ~/.bashrc

# zsh — write to a directory on fpath (e.g. ~/.zfunc), then compinit
hotspot-scanner completion zsh > ~/.zfunc/_hotspot-scanner

# fish — evaluate in the current session (or save to a completions path)
source (hotspot-scanner completion fish | psub)
```

Restart your shell, or reload the config, after installing. Invalid shell names exit with a usage error (exit `2`). See `hotspot-scanner completion --help`.

## Configuration

`hotspot-scanner init` writes a schema-linked exemplar `.hotspot-scanner.json` (`--force` to overwrite). Discovery filename is only that name. Reserved `$schema` / `$comment` / `$comments` are IDE metadata — not merged as options.

**Discovery:** walk upward from `<repoPath>`, nearest wins. No file, defaults kick in.

`--config <path>` loads one file and skips the walk (missing or invalid, non-zero exit).

**Precedence:** CLI > config > defaults.

| Key           | Maps to         | Type                 |
| ------------- | --------------- | -------------------- |
| `since`       | `--since`       | string               |
| `include`     | `--include`     | string array (globs) |
| `exclude`     | `--exclude`     | string array (globs) |
| `top`         | `--top`         | positive integer     |
| `concurrency` | `--concurrency` | positive integer     |

`format`, `output`, and most presentation flags are CLI-only. Unknown keys emit `UNKNOWN_CONFIG_KEY` ([warning codes](docs/warning-codes.md)). Use `config validate` / `config print` without running a full scan.

```json
{
  "since": "6 months ago",
  "include": ["src/**"],
  "top": 15,
  "concurrency": 2
}
```

Tests (`*.test.*` / `*.spec.*`, `__tests__/`) are excluded by default — `--include-tests` to bring them back.

No `.hotspotignore`. Use `exclude` / `--exclude` instead ([recipes](docs/recipes.md#excluding-paths-no-hotspotignore)).

Nested package scans remount to the git root with auto-include — [Monorepo config](docs/recipes.md#monorepo-config).

## Output formats

Table and markdown include an executive summary, a metric legend, optional triage hints, and optional ANSI colors on score cells. JSON and CSV export raw data only.

**Triage** (table/markdown, `--no-triage-hints` to disable): a dual-signal hotspot is `hotspotScore ≥ 0.7` with both normalized NCLOC and churn ≥ 0.5. Up to three matches.

**Colors:** on an interactive TTY, without `--output` / `--no-color` / `NO_COLOR`, the scan table colors score bands, trend/assess color the pattern tokens, and doctor colors the status prefixes. Each subcommand has its own `--no-color` — not a config key.

### Table

One section: Top Hotspots. `--top` limits rows. See [Quick start](#quick-start) for a sample.

### JSON

`--format json` writes `ScanResult` (`version: "3.0"`) with normalized scores, raw metrics, `$schema`, and `meta.scannerVersion`. `--top` doesn't slice JSON — you get the full ranked list. Schemas under [`schemas/`](schemas/) (`scan-result`, `hotspot-scanner-config`, `complexity-trend`, `hotspot-assess`).

### Markdown

GitHub-flavored report: summary, how-to-read, hotspot table, optional triage. `--top` slices at render time.

### CSV bundle

`--format csv` requires `--output`. Default is a stem bundle (`{stem}.meta.json`, `{stem}.hotspots.csv`). Opt-in `--csv-single-file` writes one hotspots CSV to the exact output path. `--top` is ignored here too.

### Exit codes

Canonical table: [docs/cli-reference.md → Exit codes](docs/cli-reference.md#exit-codes).

| Code          | Meaning                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------ |
| `0`           | Success (`--explain` miss without `--fail-on-explain-miss` is also `0`)                    |
| `1`           | `--fail-on-explain-miss` on a missing target; or `doctor` with a non-config `fail` finding |
| `2`           | Invalid usage / config / unknown removed commands (doctor config-only `fail` is also `2`)  |
| `130` / `143` | Cancelled by `SIGINT` / `SIGTERM`                                                          |

## Programmatic API

After `pnpm build`, import from `@taranti/hotspot-scanner` (`dist/index.js`):

```typescript
import {
  runScan,
  runAssess,
  runComplexityTrend,
  parseScanResult,
  previewScanScope,
  runDoctor,
} from "@taranti/hotspot-scanner";
import type {
  ScanResult,
  AssessResult,
  DoctorResult,
} from "@taranti/hotspot-scanner";

const result: ScanResult = await runScan({
  repoPath: "/path/to/repo",
  since: "12 months ago",
});
const assess: AssessResult = await runAssess({
  repoPath: "/path/to/repo",
  minHotspotScore: 0.7,
  top: 10,
});
parseScanResult(JSON.parse(fileContents)); // throws ScanResultParseError
await previewScanScope({ repoPath: "/path/to/repo" }); // mirrors scan --dry-run
const doctor: DoctorResult = await runDoctor({ targetPath: "/path/to/repo" });
await runComplexityTrend({ filePath: "/path/to/repo/src/foo.ts" });
```

`runScan()` returns the full ranked arrays — scan CLI `--top` is render-only. `runAssess({ top })` / assess CLI `--top` cap candidates after the score filter. Full exports: `src/index.ts`.

## Documentation

| Doc                                            | Contents                                                               |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| [docs/recipes.md](docs/recipes.md)             | Copy-paste workflows (triage, PR report, monorepo, drill-down, assess) |
| [docs/methodology.md](docs/methodology.md)     | Why NCLOC and indentation                                              |
| [docs/warning-codes.md](docs/warning-codes.md) | Stable `meta.warnings` codes and stderr modes                          |
| [docs/cli-reference.md](docs/cli-reference.md) | Full flags, pipeline internals, assess / explain, examples             |
| [CONTRIBUTING.md](CONTRIBUTING.md)             | Local setup and contribution workflow                                  |
| [SECURITY.md](SECURITY.md)                     | Local trust model and vulnerability reporting                          |

## Limitations

- **TypeScript/JavaScript only.** Other languages aren't analyzed (eligible extensions: `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.mts`, `.cts`)
- **Commit-count churn.** Churn is raw commit count per file, not relative lines changed
- **Node.js 22+.** Older versions aren't supported (`engines.node >= 22`)
- **Git required.** `scan` needs a Git repository (`.git`); discovery prefers `git ls-files`, with a filesystem walk only if that listing fails
- **Metric rationale.** NCLOC and indentation are deliberate proxies — see [docs/methodology.md](docs/methodology.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, quality gates, and the contribution workflow.

## Security

See [SECURITY.md](SECURITY.md) for the local trust model and how to report vulnerabilities.

## License

MIT — Copyright (c) 2026 Alan Taranti. See [LICENSE](LICENSE).
