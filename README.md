# hotspot-scanner

Local CLI for TypeScript/JavaScript maintenance hotspot analysis.

**hotspot-scanner** helps developers and tech leads prioritize refactoring targets without commercial tooling. It ranks files (or functions) by combining cyclomatic complexity, Git churn, and temporal coupling — entirely on your machine, with no network calls.

## Features

- **Hotspot ranking** — harmonic mean of complexity and churn to surface actively maintained complex code
- **Temporal coupling** — find file pairs that co-change together; static enrichment flags import edges (`hasStaticDependency`), direction (`a→b` / `b→a` / `both`), and edge kinds (runtime, type-only, re-export) including tsconfig `paths` aliases
- **Function granularity** — rank individual functions with `--granularity function`; per-function churn comes from hunk overlap on a patch stream, not inherited parent-file stats
- **Scan compare** — diff current results against a saved baseline JSON (`--baseline`)
- **Streaming Git parse** — file mode streams `git log --numstat` for churn and coupling; function mode adds a patch stream (`git log -p --unified=0`) for per-function hunk attribution
- **Path scoping** — default excludes for `node_modules`, `.git`, `dist`, `coverage`, `build`, `.next`, `out`, `vendor`, `storybook-static`, and `__snapshots__`; optional `--include` / `--exclude` globs (additive on defaults)
- **Repo config file** — optional `.hotspot-scanner.json` discovered at the scan target or in a parent directory; `--config <path>` for explicit CI paths (CLI flags override)
- **Flexible output** — CLI table, JSON, GitHub-flavored markdown, or multi-file CSV bundle

## Requirements

| Requirement | Version               |
| ----------- | --------------------- |
| Node.js     | 22+                   |
| git         | required at scan time |
| pnpm        | for development       |

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

| Flag                | Default         | Description                                                                    |
| ------------------- | --------------- | ------------------------------------------------------------------------------ |
| `<path>`            | —               | Repository path (required)                                                     |
| `--since`           | `12 months ago` | Git history window                                                             |
| `--format`          | `table`         | Output format: `table`, `json`, `markdown`, or `csv` (csv requires `--output`) |
| `--granularity`     | `file`          | Ranking granularity: `file` or `function`                                      |
| `--output <path>`   | —               | Write report to file instead of stdout (required for `--format csv`)           |
| `--baseline <path>` | —               | Compare scan against baseline JSON from a prior run                            |
| `--top`             | `20`            | Top N rows in table/markdown output (ignored for json/csv)                     |
| `--min-cochange`    | `3`             | Minimum co-change count for coupling pairs                                     |
| `--include <glob>`  | —               | Include only paths matching glob (repeatable)                                  |
| `--exclude <glob>`  | —               | Exclude paths matching glob (repeatable, additive)                             |
| `--config <path>`   | —               | Load config from explicit file (skips parent-directory discovery)              |
| `--concurrency`     | `min(availableParallelism(), 4)` | Complexity analyzer worker-pool size (positive integer ≥ 1)              |

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
hotspot-scanner scan . --concurrency 1   # sequential complexity batches (debug / low-memory)
```

## Configuration file

Optional **`.hotspot-scanner.json`** supplies shared scan defaults. Discovery filename is **only** `.hotspot-scanner.json` (not `.hotspotrc` or alternate names).

**Discovery (default):** Starting at `<repoPath>`, the tool walks **upward** through parent directories until it finds `.hotspot-scanner.json` or reaches the filesystem root. **Nearest wins** — a file at `<repoPath>/.hotspot-scanner.json` overrides a parent workspace config. If no file is found on the walk, built-in defaults apply (not an error).

**Explicit path:** `--config <path>` (or `ScanOptions.configPath`) loads that file only and **skips** parent walk. Relative paths resolve from the process cwd. A missing explicit file exits non-zero; invalid JSON or bad types exit non-zero with a clear error.

**Precedence:** CLI flags **>** config file **>** built-in defaults. `--config` only selects which file is read — it does not change option-value precedence.

| Key           | Maps to          | Type                     |
| ------------- | ---------------- | ------------------------ |
| `since`       | `--since`        | string                   |
| `include`     | `--include`      | string array (globs)     |
| `exclude`     | `--exclude`      | string array (globs)     |
| `granularity` | `--granularity`  | `"file"` or `"function"` |
| `minCochange` | `--min-cochange` | positive integer         |
| `top`         | `--top`          | positive integer         |
| `concurrency` | `--concurrency`  | positive integer         |

`format`, `output`, and `baseline` are **CLI-only** — they cannot be set in the config file. Unknown keys are ignored. Invalid JSON or invalid values exit non-zero with a clear error.

Example:

```json
{
  "since": "6 months ago",
  "include": ["src/**"],
  "exclude": ["**/*.test.ts"],
  "granularity": "file",
  "minCochange": 3,
  "top": 15,
  "concurrency": 2
}
```

A monorepo can keep one workspace config above the git root:

```bash
# workspace/.hotspot-scanner.json exists; scan packages/api (nearest repo-local file wins if present)
hotspot-scanner scan packages/api
```

CI can point at a fixed config without discovery:

```bash
hotspot-scanner scan . --config /ci/hotspot-scanner.json --since "3 months ago" --top 10
```

`runScan()` uses the same discovery rules (`configPath` or parent walk from `repoPath`); explicit option values win over the loaded file.

## Programmatic API

Import from the package entry point:

```typescript
import {
  runScan,
  compareScanResults,
  loadBaseline,
  parseScanResult,
} from "@vitals/hotspot-scanner";
import type {
  ScanOptions,
  ScanResult,
  CompareResult,
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
```

`runScan()` returns a typed `ScanResult` with full ranked arrays (no `--top` slicing). The CLI applies `--top` only when rendering table or markdown. Public exports also include domain types (`HotspotScore`, `CouplingPair`, `ScanMeta`, etc.) — see `src/index.ts`.

## How it works

```
git log --numstat (streaming) → complexity (McCabe) → scoring (file hotspots or function hunk-overlap churn) → coupling + static enrich → table / JSON / markdown / CSV
```

1. **Git Change Miner** — streams `git log -M --numstat` to aggregate per-file churn and co-change events (file-mode hotspot ranking uses these stats directly); parses `old => new` rename lines into a `PathAliasMap` to canonicalize paths (no global `git log --follow`); emits rename-confidence warnings when history may be incomplete
2. **Complexity Analyzer** — computes McCabe cyclomatic complexity over the working-tree AST via ts-morph
3. **Scoring** — file mode ranks hotspots from file churn + complexity; function mode (`--granularity function`) runs a second `git log -M -p --unified=0` patch stream and attributes commits whose hunks overlap each function's current line range — per-function churn is **not** inherited from parent-file stats; coupling pairs are ranked from the numstat pass in both modes
4. **Static coupling enricher** — sets static-dependency fields on each coupling pair from working-tree import/export/require edges (relative paths + tsconfig/jsconfig `paths`/`baseUrl`; direction and edge-kind flags)
5. **Reporter** — renders table, JSON, markdown, or CSV bundle output

### Scoring

- **Hotspot score:** `2 × normalize(complexity) × normalize(churn) / (normalize(complexity) + normalize(churn))` — harmonic mean after log1p + min-max normalization per scan
- **Coupling strength:** `coChangeCount / min(commitsA, commitsB)`
- **Static dependency:** `hasStaticDependency` is `true` when either file has a resolvable static import/export/require to the other; `staticDependencyDirection` and kind flags (`hasRuntimeStaticDependency`, `hasTypeOnlyStaticDependency`, `hasReExportStaticDependency`) add triage detail; ranking is unchanged

Churn is measured as raw commit count (not relative code churn). Complexity is computed from the current working tree, not historical file versions.

### Performance and diagnostics

**Concurrency.** The complexity stage processes files in parallel via a bounded `worker_threads` pool. Default pool size is `min(os.availableParallelism(), 4)` (same as `DEFAULT_WORKER_CONCURRENCY` in code). Override with `--concurrency <n>` or the `concurrency` key in `.hotspot-scanner.json` — precedence is **CLI > config > default**. Invalid values (non-integer or less than 1) exit non-zero before the scan starts.

**Progress (stderr).** During long git streams, the CLI logs throttled progress every 1,000 commits per phase:

| `phase`            | When emitted                         |
| ------------------ | ------------------------------------ |
| `git`              | File-mode numstat stream (`--numstat`) |
| `function-churn`   | Function-mode patch stream (`-p --unified=0`) |

Format: `Processing <phase> commit <N>...` (e.g. `Processing function-churn commit 1,000...`). Complexity batching does not emit progress lines in v1.

**Warnings (`meta.warnings`).** Scan and compare JSON include structured warnings on `meta.warnings` — an array of `{ severity, message, code? }` objects (`ScanWarning`). The CLI also prints each warning to stderr with a severity prefix (`info:`, `warning:`, `error:`). Programmatic callers receive the same objects via `onWarning`.

**Severity vs exit code.** `severity` classifies diagnostics only. A successful scan exits `0` even when warnings are present. Hard failures (invalid repo, git error, bad CLI args) still exit non-zero per the table below.

**M28 warning codes** (stable `code` field for filtering and docs):

| Code | Interpretation |
| ---- | -------------- |
| `EMPTY_SINCE_WINDOW` | No commits in the `--since` window — rankings may be empty or sparse; widen the window |
| `RENAME_HISTORY_INCOMPLETE` | Rename tracking incomplete for one or more paths — churn may be split; includes M26 rename-confidence messages (ambiguous chain, unlinked delete+add, `--since` truncation, function-mode overlap confidence) |
| `PARSE_FAILED` | A source file could not be parsed for complexity — file skipped; fix syntax or exclude the path |
| `COMPARE_SINCE_MISMATCH` | Baseline and current scan used different `--since` values — rank deltas are less comparable |

**M26 boundary.** M28 routes **existing** rename and parse warnings into `ScanWarning` with codes above. It does **not** add new rename-confidence message families beyond M26 (RT-003). See [Rename confidence (M26)](#rename-confidence-m26) below for message patterns.

Find-renames (`-M`) is enabled on git log spawns so real renames can unify churn under canonical paths. The scanner does **not** use global `git log --follow`.

### Rename confidence (M26)

Rename blind-spot messages are emitted with `code: "RENAME_HISTORY_INCOMPLETE"`. Typical human-readable patterns:

| Message pattern | When |
| --------------- | ---- |
| `Rename history may be incomplete for: …` | Ambiguous rename chain (`PathAliasMap`) |
| `Suspected unlinked rename (no git rename metadata): …` | Same-commit delete+add that looks like a move but git emitted no `=>` line |
| `Rename history before the --since window (…) may be missing under canonical paths` | `--since` is set and at least one rename link was seen in the window |
| Function overlap confidence (function mode only) | Rename links or ambiguous paths during per-function hunk attribution |

## Output

### Table

Two sections: **Top Hotspots** (or **Top Functions** in function mode) and **Top Coupling Pairs**. `--top` limits rows per section.

```
Scan window: 12 months ago (scanned 2026-07-22T12:00:00.000Z)

Top Hotspots
Rank  File                      Score     Complexity  Churn
----  ------------------------  --------  ----------  ----------
   1  src/high.ts               0.8571      1.0000      0.7500

Top Coupling Pairs
Rank  File A                    File B                    Strength  Co-changes  StaticDep  Direction  Kinds
----  ------------------------  ------------------------  --------  ----------  ---------  ---------  ----------------------
   1  src/high.ts               src/medium.ts             0.7500           3       yes      a→b        runtime
```

### JSON

`--format json` writes the full `ScanResult` shape. Each hotspot entry includes **normalized scores and raw metrics** (`cyclomaticComplexity`, `functionCount`, `commitCount`, `linesChanged`, `authorCount`). Coupling entries include `hasStaticDependency`, `staticDependencyDirection`, and the three edge-kind booleans.

Published JSON Schema files live under [`schemas/`](schemas/):

| Schema                                                       | TypeScript type |
| ------------------------------------------------------------ | --------------- |
| [`schemas/scan-result.json`](schemas/scan-result.json)       | `ScanResult`    |
| [`schemas/compare-result.json`](schemas/compare-result.json) | `CompareResult` |

Use these schemas to validate CLI output or baselines in your own pipelines.

`--granularity` selects the active ranking array:

| Mode             | Active array | Inactive array  | `meta.granularity` |
| ---------------- | ------------ | --------------- | ------------------ |
| `file` (default) | `hotspots`   | `functions: []` | `"file"`           |
| `function`       | `functions`  | `hotspots: []`  | `"function"`       |

`coupling` is always file-pair ranked in both modes. **`--top` does not slice JSON** — all ranked entities are exported for scripting and baselines.

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
    ]
  }
}
```
```

Save a baseline for compare mode:

```bash
hotspot-scanner scan . --format json --output baseline.json
```

### Markdown

`--format markdown` produces a GitHub-flavored report with hotspot (or function) and coupling tables. Includes raw and normalized columns plus a `Lines` column on hotspots. `--top` slices rows at render time. Use `--output report.md` to write to a file.

### CSV bundle

`--format csv` writes a **multi-file bundle** derived from the `--output` path stem. **`--output` is required** for CSV; metadata lives only in `{stem}.meta.json`, not inside data files. **`--top` is ignored** — full ranked lists are exported.

**Scan bundle** (`--output out/report.csv`):

| File                      | Contents                                                       |
| ------------------------- | -------------------------------------------------------------- |
| `out/report.meta.json`    | Scan metadata (`since`, `scannedAt`, `granularity`)            |
| `out/report.hotspots.csv` | File-mode ranking (or `report.functions.csv` in function mode) |
| `out/report.coupling.csv` | Coupling pairs (includes `staticDependencyDirection` and kind columns) |

**Compare bundle** (`--baseline baseline.json --format csv --output out/compare.csv`):

| File                                    | Contents                                         |
| --------------------------------------- | ------------------------------------------------ |
| `out/compare.meta.json`                 | Baseline/current metadata and warnings           |
| `out/compare.hotspots.new.csv`          | New hotspots (or `functions.*` in function mode) |
| `out/compare.hotspots.removed.csv`      | Removed hotspots                                 |
| `out/compare.hotspots.rank-changed.csv` | Rank changes with baseline/current/delta columns |
| `out/compare.coupling.new.csv`          | New coupling pairs                               |
| `out/compare.coupling.removed.csv`      | Removed coupling pairs                           |
| `out/compare.coupling.rank-changed.csv` | Coupling rank changes                            |

Empty sections produce header-only CSV files. Data files have no section title rows.

### Compare

Pass `--baseline <path>` with a prior `ScanResult` JSON (from `--format json --output`). The CLI runs `compareScanResults()` and renders a **CompareResult** delta in the same `--format` as a normal scan.

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

`--top` slices table and markdown compare output only; JSON and CSV compare exports receive full delta arrays.

### Exit codes

| Code | Meaning                                    |
| ---- | ------------------------------------------ |
| `0`  | Scan completed successfully                |
| `2`  | Invalid usage (missing command, bad flags) |
| `1`  | Runtime error (invalid path, git failure)  |

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, quality gates, and contribution workflow.

```bash
pnpm build && pnpm test
```

## License

MIT — Copyright (c) 2026 Alan Taranti. See [LICENSE](LICENSE).
