# STRUCTURE — @vitals/hotspot-scanner

## Directory layout

```
hotspot-scanner/
├── bin/
│   ├── hotspot-scanner.ts       # CLI entry (commander) — init, doctor, scan, baseline save, compare, completion
│   ├── scan-actions.ts          # Shared scan/compare CLI wiring (runScan, compare render, path validation)
│   └── completion-scripts.ts    # Static bash/zsh/fish completion scripts (M54)
├── src/
│   ├── git/                     # Git Change Miner (+ function-churn M23)
│   ├── complexity/              # McCabe over ts-morph
│   ├── scoring/                 # HotspotScorer (file + function)
│   ├── diagnostics/             # stderr warnings + progress logging
│   ├── doctor/                  # Pre-flight checks (Node, git, repo, config, scope, tsconfig)
│   ├── compare/                 # Baseline load + compareScanResults
│   ├── report/                  # CLI table + JSON + markdown + CSV reporter
│   ├── config/                  # .hotspot-scanner.json load + merge + init exemplar writer
│   ├── paths/                   # PathScope globs + monorepo git-root remount (resolve-repo)
│   ├── scan-preview.ts          # scan --dry-run scope preview (no mine/AST)
│   ├── scan.ts                  # Pipeline orchestration
│   ├── types/                   # Domain types (no runtime logic)
│   └── index.ts                 # Public library API
├── tests/
│   └── fixtures/                # Git repos + git log samples + TS complexity fixtures
└── .specs/                      # Living project docs
```

## Module map

| Path                     | Status      | Role                                                                                                                                                                                               |
| ------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bin/hotspot-scanner.ts` | implemented | Commander CLI — `init`, `doctor`, `scan [path]`, `baseline save <path>`, `compare <path> --baseline <file>`, `completion <shell>`; `doctor` supports `--config`, `--include-tests`, `-f/--format text\|json`; scan/compare flags include `--since`, `--format`, `--granularity`, `--top`, `--include`, `--exclude`, `--config`, `--concurrency`, `--output`, `--baseline`, `--only`, `--no-triage-hints`, `--no-color`, `--explain`, `--strict`, `--dry-run`, `--include-tests`, `--sequential` / `--no-overlap`, `--quiet`, `--no-progress`, `--verbose` |
| `bin/scan-actions.ts`    | implemented | Shared CLI wiring — `executeScan`, `executeCompareAndRender`, `writeBaselineJson`, `runWithScanCancelSignals`, `createVerboseSpawnArgvHandler`, `validateOutputPath`, `validateBaselinePath`, `DEFAULT_BASELINE_OUTPUT` (`./hotspot-baseline.json`); I/O and flag merge only |
| `bin/completion-scripts.ts` | implemented | `getCompletionScript(shell)` — static bash/zsh/fish scripts for `completion <shell>` (M54); no domain logic |
| `src/git/`               | implemented | GitMiner — `spawn`, `parse`, `rename`, `aggregate`, `canonicalize`; `function-churn/` for M23 patch overlap; `ls-files.ts` (M36) |
| `src/complexity/`        | implemented | ComplexityAnalyzer — McCabe via ts-morph (`discover`, `project`, `mccabe`, `analyze-file`, `pool`, `worker`) |
| `src/scoring/`           | implemented | HotspotScorer, FunctionHotspotScorer — `normalize`, `hotspot-scorer`, `function-hotspot-scorer` |
| `src/diagnostics/`       | implemented | stderr logger — warnings + throttled progress                                                                                                                                                      |
| `src/doctor/`            | implemented | `runDoctor()` — Node engines, git on PATH, `resolveScanPipelineContext` (remount-aware `git-repo`), config discovery/validity, **`scope`** finding via `previewScanScope`, tsconfig/jsconfig info; `format.ts` (`formatDoctorJsonReport`) for `doctor --format json`; `DoctorFindingId` includes `"scope"`; aggregate exit codes |
| `src/report/`            | implemented | Reporter — `only`, `summary`, `glossary`, `triage`, `compare-triage`, `explain`, `explain-compare`, `color` (M41/M42/M53); `slice`, `json`, `table`, `markdown`, `csv-utils`, `csv-bundle`, `csv`, `slice-compare`, `compare-*` + `createReporter()` factory (`render` + `renderCompare`; `ReporterOptions`: `only`, `triageHints`, `color`; CSV returns `CsvBundle`) |
| `src/compare/`           | implemented | Baseline loader, entity keys, `compareScanResults()` engine                                                                                                                                        |
| `src/config/`            | implemented | `.hotspot-scanner.json` loader — parent walk or explicit `configPath` (`loadHotspotScannerConfig`), `mergeScanOptions` (CLI > config > defaults), `exemplar.ts` (`writeInitConfig`, locked exemplar for `init`), `ConfigError`; unknown keys → `UNKNOWN_CONFIG_KEY` |
| `src/paths/`             | implemented | `createPathScope` / `isPathInScope` / `filterGitMinerResult` (M7); `resolveMonorepoScanPath` + `buildAutoIncludePattern` (M43 git-root remount + auto-include) |
| `src/scan-preview.ts`    | implemented | `previewScanScope()` / `formatScanScopePreview()` — `resolveScanPipelineContext` + `createScanPathScope` + `discoverSourceFiles` count for `--dry-run` and doctor `scope` (no mine/AST/scoring)    |
| `src/scan.ts`            | implemented | `resolveScanPipelineContext`, `createScanPathScope`, `runScan()` — shared prelude + PathScope builder + pipeline orchestration with granularity branch                                              |
| `src/types/`             | implemented | FileChangeStats, HotspotScore, ScanOptions, ScanResult, etc.                                                                                                                                       |
| `src/index.ts`           | implemented | Public API — `runScan`, `previewScanScope`, `runDoctor`, `loadBaseline`, `compareScanResults`, `parseScanResult`, doctor/preview types, `PACKAGE_NAME` |

## Test layout

- Co-located `*.test.ts` next to source modules
- `tests/fixtures/git-log/` — raw `git log` output samples
- `tests/fixtures/repos/` — small versioned Git repositories for integration scans
- `tests/fixtures/complexity/` — TS files with known McCabe values
- `tests/fixtures/scoring/` — fixed scoring inputs with documented expected ranking order
- `tests/fixtures/report/` — hand-crafted `ScanResult` for reporter tests
