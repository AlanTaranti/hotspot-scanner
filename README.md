# hotspot-scanner

Local CLI for TypeScript/JavaScript maintenance hotspot analysis.

**hotspot-scanner** helps developers and tech leads prioritize refactoring targets without commercial tooling. It ranks files by combining cyclomatic complexity, Git churn, and temporal coupling — entirely on your machine, with no network calls.

## Features

- **Hotspot ranking** — harmonic mean of complexity and churn to surface actively maintained complex code
- **Temporal coupling** — find file pairs that co-change without static imports (hidden dependencies)
- **Streaming Git parse** — single `git log` pass scales from small repos to large histories
- **Path scoping** — default excludes for `node_modules`, `.git`, `dist`, `coverage`, and `build`; optional `--include` / `--exclude` globs
- **Flexible output** — CLI table or JSON for scripting

## Requirements

| Requirement | Version |
|-------------|---------|
| Node.js | 22+ |
| git | required at scan time |
| pnpm | for development |

## Installation

```bash
git clone <repo-url>
cd hotspot-scanner
pnpm install
pnpm build
```

## Quick start

Scan a repository:

```bash
pnpm exec hotspot-scanner scan /path/to/your-repo
```

Try the bundled fixture:

```bash
pnpm exec hotspot-scanner scan tests/fixtures/repos/small-ts
```

## CLI reference

```
hotspot-scanner scan <path> [options]
```

| Flag | Default | Description |
|------|---------|-------------|
| `<path>` | — | Repository path (required) |
| `--since` | `12 months ago` | Git history window |
| `--format` | `table` | Output format: `table`, `json`, `markdown`, or `csv` (csv requires `--output`) |
| `--granularity` | `file` | Ranking granularity: `file` or `function` |
| `--output <path>` | — | Write report to file instead of stdout (required for `--format csv`) |
| `--baseline <path>` | — | Compare scan against baseline JSON from a prior run |
| `--top` | `20` | Top N rows in table/markdown output (ignored for json/csv) |
| `--min-cochange` | `3` | Minimum co-change count for coupling pairs |
| `--include <glob>` | — | Include only paths matching glob (repeatable) |
| `--exclude <glob>` | — | Exclude paths matching glob (repeatable, additive) |

### Examples

```bash
hotspot-scanner scan . --since "6 months ago"
hotspot-scanner scan . --format json --top 10  # --top ignored; full arrays exported
hotspot-scanner scan . --granularity function --format json
hotspot-scanner scan . --format markdown --output report.md
# CSV bundle (writes report.meta.json, report.hotspots.csv, report.coupling.csv)
hotspot-scanner scan . --format csv --output report.csv
hotspot-scanner scan . --format json --output baseline.json
hotspot-scanner scan . --baseline baseline.json --format markdown
# Compare CSV bundle (writes compare.meta.json + six data CSVs)
hotspot-scanner scan . --baseline baseline.json --format csv --output compare.csv
hotspot-scanner scan . --include "src/**" --exclude "**/*.test.ts"
```

## How it works

```
git log (streaming) → complexity (McCabe) → hotspot + coupling scoring → table / JSON
```

1. **Git Change Miner** — streams `git log --numstat` to aggregate per-file churn and co-change events
2. **Complexity Analyzer** — computes McCabe cyclomatic complexity over the working-tree AST via ts-morph
3. **Scoring** — ranks hotspots and coupling pairs from the combined signals
4. **Reporter** — renders table or JSON output

### Scoring

- **Hotspot score:** `2 × normalize(complexity) × normalize(churn) / (normalize(complexity) + normalize(churn))` — log1p + min-max normalization per scan
- **Coupling strength:** `coChangeCount / min(commitsA, commitsB)`

Churn is measured as raw commit count (not relative code churn). Complexity is computed from the current working tree, not historical file versions.

## Output

### Table

Two sections: **Top Hotspots** and **Top Coupling Pairs**.

```
Scan window: 12 months ago (scanned 2026-07-22T12:00:00.000Z)

Top Hotspots
Rank  File                      Score     Complexity  Churn
----  ------------------------  --------  ----------  ----------
   1  src/high.ts               0.8571      1.0000      0.7500

Top Coupling Pairs
Rank  File A                    File B                    Strength  Co-changes
----  ------------------------  ------------------------  --------  ----------
   1  src/high.ts               src/medium.ts             0.7500           3
```

### JSON

```json
{
  "version": "1.0",
  "hotspots": [
    {
      "filePath": "src/high.ts",
      "complexityNormalized": 1.0,
      "churnNormalized": 0.75,
      "hotspotScore": 0.8571
    }
  ],
  "coupling": [
    {
      "fileA": "src/high.ts",
      "fileB": "src/medium.ts",
      "coChangeCount": 3,
      "couplingStrength": 0.75
    }
  ],
  "meta": {
    "since": "12 months ago",
    "scannedAt": "2026-07-22T12:00:00.000Z"
  }
}
```

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Scan completed successfully |
| `2` | Invalid usage (missing command, bad flags) |
| `1` | Runtime error (invalid path, git failure) |

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, quality gates, and contribution workflow.

```bash
pnpm build && pnpm test
```

## License

MIT — Copyright (c) 2026 Alan Taranti. See [LICENSE](LICENSE).
