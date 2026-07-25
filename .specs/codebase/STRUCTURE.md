# STRUCTURE — @vitals/hotspot-scanner

## Directory layout

```
hotspot-scanner/
├── bin/
│   ├── hotspot-scanner.ts       # CLI entry (commander) — init, doctor, scan, baseline save, compare
│   └── scan-actions.ts          # Shared scan/compare CLI wiring (runScan, compare render, path validation)
├── src/
│   ├── git/                     # Git Change Miner (+ function-churn M23)
│   ├── complexity/              # McCabe over ts-morph
│   ├── scoring/                 # HotspotScorer + TemporalCouplingScorer
│   ├── diagnostics/             # stderr warnings + progress logging
│   ├── doctor/                  # Pre-flight checks (Node, git, repo, config, tsconfig)
│   ├── report/                  # CLI table + JSON + markdown + CSV reporter
│   ├── config/                  # .hotspot-scanner.json load + merge + init exemplar writer
│   ├── paths/                   # PathScope globs + monorepo git-root remount (resolve-repo)
│   ├── scan-preview.ts          # scan --dry-run scope preview (no mine/AST)
│   ├── scan.ts                  # Pipeline orchestration
│   ├── types/                   # Domain types (no runtime logic)
│   └── index.ts                 # Public library API (optional)
├── tests/
│   └── fixtures/                # Git repos + git log samples + TS complexity fixtures
└── .specs/                      # Living project docs
```

## Module map

| Path                     | Status      | Role                                                                                                                                                                                               |
| ------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bin/hotspot-scanner.ts` | implemented | Commander CLI — `init`, `doctor`, `scan <path>`, `baseline save <path>`, `compare <path> --baseline <file>`; scan flags include `--since`, `--format`, `--granularity`, `--top`, `--min-cochange`, `--include`, `--exclude`, `--config`, `--concurrency`, `--output`, `--baseline`, `--only`, `--no-triage-hints`, `--no-color`, `--dry-run` |
| `bin/scan-actions.ts`    | implemented | Shared CLI wiring — `executeScan`, `executeCompareAndRender`, `writeBaselineJson`, `validateOutputPath`, `validateBaselinePath`, `DEFAULT_BASELINE_OUTPUT` (`./hotspot-baseline.json`); I/O and flag merge only |
| `src/git/`               | implemented | GitMiner — `spawn`, `parse`, `rename`, `aggregate`, `canonicalize`; `function-churn/` for M23 patch overlap                                                                                        |
| `src/complexity/`        | implemented | ComplexityAnalyzer — McCabe via ts-morph (`discover`, `project`, `mccabe`, `analyze-file`)                                                                                                         |
| `src/scoring/`           | implemented | HotspotScorer, FunctionHotspotScorer, TemporalCouplingScorer, static coupling enricher — `normalize`, `hotspot-scorer`, `function-hotspot-scorer`, `coupling-scorer`, `enrich-coupling-static`, `tsconfig-path-map`, `package-exports-map` |
| `src/diagnostics/`       | implemented | stderr logger — warnings + throttled progress                                                                                                                                                      |
| `src/doctor/`            | implemented | `runDoctor()` — Node engines, git on PATH, git repo, config discovery/validity, tsconfig/jsconfig info; aggregate exit codes                                                                       |
| `src/report/`            | implemented | Reporter — `only`, `summary`, `glossary`, `triage`, `color` (M41 interpretation helpers); `slice`, `json`, `table`, `markdown`, `coupling-format`, `csv-utils`, `csv-bundle`, `csv`, `slice-compare`, `compare-*` + `createReporter()` factory (`render` + `renderCompare`; `ReporterOptions`: `only`, `triageHints`, `color`; CSV returns `CsvBundle`) |
| `src/compare/`           | implemented | Baseline loader, entity keys, `compareScanResults()` engine                                                                                                                                        |
| `src/config/`            | implemented | `.hotspot-scanner.json` loader — parent walk or explicit `configPath` (`loadHotspotScannerConfig`), `mergeScanOptions` (CLI > config > defaults), `exemplar.ts` (`writeInitConfig`, locked exemplar for `init`), `ConfigError` |
| `src/paths/`             | implemented | `createPathScope` / `isPathInScope` / `filterGitMinerResult` (M7); `resolveMonorepoScanPath` + `buildAutoIncludePattern` (M43 git-root remount + auto-include) |
| `src/scan-preview.ts`    | implemented | `previewScanScope()` / `formatScanScopePreview()` — merged config + PathScope + `discoverSourceFiles` count for `--dry-run` (no mine/AST/scoring)                                                  |
| `src/scan.ts`            | implemented | `runScan()` — config resolution + pipeline orchestration with granularity branch                                                                                                                   |
| `src/types/`             | implemented | FileChangeStats, HotspotScore, ScanOptions, ScanResult, etc.                                                                                                                                       |
| `src/index.ts`           | implemented | Public API — `runScan`, `loadBaseline`, `compareScanResults`, types, `PACKAGE_NAME`                                                                                                                |

## Test layout

- Co-located `*.test.ts` next to source modules
- `tests/fixtures/git-log/` — raw `git log` output samples
- `tests/fixtures/repos/` — small versioned Git repositories for integration scans
- `tests/fixtures/complexity/` — TS files with known McCabe values
- `tests/fixtures/scoring/` — fixed scoring inputs with documented expected ranking order
- `tests/fixtures/report/` — hand-crafted `ScanResult` for reporter tests
