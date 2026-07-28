# STRUCTURE — @vitals/hotspot-scanner

## Directory layout

```
hotspot-scanner/
├── bin/
│   ├── hotspot-scanner.ts       # CLI entry (commander) — init, config validate/print, doctor, trend, scan, completion
│   ├── scan-actions.ts          # Shared scan CLI wiring (runScan, path validation, render/write)
│   ├── trend-actions.ts         # trend CLI wiring (runComplexityTrend, formats, cancel)
│   └── completion-scripts.ts    # Static bash/zsh/fish completion scripts (M54)
├── src/
│   ├── git/                     # Git Change Miner (numstat churn only)
│   ├── complexity/              # NCLOC + indentation metrics (file-level)
│   ├── trend/                   # Complexity trend orchestration (M72) + growth pattern classify (M75)
│   │   ├── classify.ts          # classifyGrowthPattern — Tornhill growth curves (pure)
│   │   ├── run-trend.ts         # runComplexityTrend — revision sample + meta.growthPattern
│   │   └── types.ts             # ComplexityTrendResult (version 3.0)
│   ├── scoring/                 # HotspotScorer (file hotspots)
│   ├── diagnostics/             # stderr warnings + progress logging
│   ├── doctor/                  # Pre-flight checks (Node, git, repo, config, scope, tsconfig)
│   ├── scan-result/             # parseScanResult + ScanResultParseError (library)
│   ├── report/                  # CLI table + JSON + markdown + CSV reporter
│   ├── config/                  # .hotspot-scanner.json load + merge + validate/print + init exemplar
│   ├── paths/                   # PathScope globs + monorepo git-root remount (resolve-repo)
│   ├── scan-preview.ts          # scan --dry-run scope preview (no mine/NCLOC)
│   ├── scan.ts                  # Pipeline orchestration
│   ├── package-meta.ts          # Cached package.json version for meta.scannerVersion (M66)
│   ├── types/                   # Domain types (no runtime logic)
│   └── index.ts                 # Public library API
├── schemas/                     # JSON Schema scan + config + complexity-trend contracts
├── tests/
│   └── fixtures/                # Git repos + git log samples + NCLOC fixtures
└── .specs/                      # Living project docs
```

## Module map

| Path                     | Status      | Role                                                                                                                                                                                               |
| ------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bin/hotspot-scanner.ts` | implemented | Commander CLI — `init`, `config validate`, `config print`, `doctor`, `trend <file>`, `scan [path]`, `completion <shell>`; scan flags include `--since`, `--format`, `--top`, `--include`, `--exclude`, `--config`, `--concurrency`, `--output`, `--only`, `--no-triage-hints`, `--no-color`, `--explain`, `--fail-on-explain-miss`, `--dry-run`, `--include-tests`, `--sequential` / `--no-overlap`, `--quiet`, `--no-progress`, `--verbose`, `--warnings`, `--csv-single-file` |
| `bin/trend-actions.ts` | implemented | Trend CLI wiring — `runComplexityTrend`, formats, cancel signals |
| `bin/scan-actions.ts`    | implemented | Shared CLI wiring — `executeScan`, `runWithScanCancelSignals`, `createVerboseSpawnArgvHandler`, path validators |
| `bin/completion-scripts.ts` | implemented | `getCompletionScript(shell)` — static bash/zsh/fish scripts (M54) |
| `src/git/`               | implemented | GitMiner — `spawn`, `parse`, `rename`, `aggregate`, `canonicalize`; `ls-files.ts` (M36); `probe-since.ts` (M64 doctor since preflight); `git-error-hint.ts` (M65 stderr→Hint helper for spawn failures) |
| `src/complexity/`        | implemented | Size analyzer — NCLOC (`ncloc.ts`, `analyze-file`, `analyze-batch`, `discover`, `pool`, `worker`) |
| `src/trend/`             | implemented | `classifyGrowthPattern` (`classify.ts`), `runComplexityTrend` (`run-trend.ts`), types — per-file revision trend + `meta.growthPattern` |
| `src/scoring/`           | implemented | `HotspotScorer` — `normalize`, `hotspot-scorer` |
| `src/diagnostics/`       | implemented | stderr logger — warnings + throttled progress |
| `src/doctor/`            | implemented | `runDoctor()` — Node, git, remount-aware repo, config (unknown-key soft warn), `since` preflight (`probeSinceWindow`), scope via `previewScanScope`, tsconfig |
| `src/report/`            | implemented | Reporter — `path-column`, `schema-urls` (M66 JSON `$schema` constants), `only`, `summary`, `glossary`, `triage`, `explain` (+ `formatTrendNextStep`), `trend-table`, `color`; table/json/markdown/csv |
| `src/package-meta.ts`    | implemented | `getPackageVersion()` — sync cached read of `package.json` `"version"` for `meta.scannerVersion` on scan (M66) |
| `src/scan-result/`       | implemented | `parseScanResult`, `ScanResultParseError` — programmatic scan JSON validation |
| `src/config/`            | implemented | `.hotspot-scanner.json` loader (`RESERVED_META_KEYS`, `path` on load), `mergeScanOptions` + provenance merge, `validate-config.ts`, `print-config.ts`, `exemplar.ts` (schema-linked init), `UNKNOWN_CONFIG_KEY` for legacy keys |
| `src/paths/`             | implemented | `createPathScope`, `resolveMonorepoScanPath`, `filterGitMinerResult` |
| `src/scan-preview.ts`    | implemented | `previewScanScope()` — prelude + eligible file count + config path / remount / unknown keys (no mine/NCLOC) |
| `src/scan.ts`            | implemented | `resolveScanPipelineContext`, `createScanPathScope`, `runScan()` — file-only pipeline |
| `src/types/`             | implemented | `FileChangeStats`, `HotspotScore`, `ScanResult` (`version: "3.0"`), etc. |
| `src/index.ts`           | implemented | Public API — `runScan`, `previewScanScope`, `runDoctor`, `parseScanResult`, `ScanResultParseError` |

**Removed (M71):** `src/compare/`, compare report modules (`compare-*`, `explain-compare`, `slice-compare`), `schemas/compare-result.json`.

## Test layout

- Co-located `*.test.ts` next to source modules
- `tests/fixtures/git-log/` — raw `git log` output samples
- `tests/fixtures/repos/` — small versioned Git repositories for integration scans
- `tests/fixtures/complexity/` — NCLOC-verified source snippets (M57)
- `tests/fixtures/scoring/` — fixed scoring inputs with documented expected ranking order
- `tests/fixtures/report/` — hand-crafted `ScanResult` for reporter tests
- `tests/contract/` — JSON schema validation against `schemas/`
