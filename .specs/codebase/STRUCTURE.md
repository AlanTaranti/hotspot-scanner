# STRUCTURE — @vitals/hotspot-scanner

Directory layout and public API map SoT. Pipelines, contracts, and ownership boundaries: [ARCHITECTURE.md](ARCHITECTURE.md). Fixture methodology and Vitest patterns: [TESTING.md](TESTING.md). Runtime/deps inventory: [STACK.md](STACK.md).

## Directory layout

```
hotspot-scanner/
├── bin/
│   ├── hotspot-scanner.ts       # CLI entry (commander) — init, config, doctor, trend, assess, scan, completion
│   ├── scan-actions.ts          # Shared scan CLI wiring (runScan, path validation, render/write)
│   ├── assess-actions.ts        # assess CLI wiring (executeAssess, formats, cancel)
│   ├── trend-actions.ts         # trend CLI wiring (runComplexityTrend, formats, cancel)
│   └── completion-scripts.ts    # Static bash/zsh/fish completion scripts
├── src/
│   ├── git/                     # Git Change Miner (numstat churn) + file-history (trend)
│   ├── complexity/              # NCLOC + indentation metrics (file-level)
│   ├── trend/                   # Complexity trend orchestration + growth pattern classify
│   │   ├── classify.ts          # classifyGrowthPattern — Tornhill growth curves (pure)
│   │   ├── run-trend.ts         # runComplexityTrend — revision sample + meta.growthPattern
│   │   └── types.ts             # ComplexityTrendResult (version 3.0)
│   ├── assess/                  # Hotspot assess — scan → filter → sequential trends
│   │   ├── select-candidates.ts # selectAssessCandidates — minHotspotScore + top cap
│   │   ├── run-assess.ts        # runAssess — batch trend + AssessResult
│   │   └── types.ts             # AssessResult (version 1.0, kind hotspot-assess)
│   ├── scoring/                 # HotspotScorer (file hotspots)
│   ├── diagnostics/             # stderr warnings + progress logging
│   ├── doctor/                  # Pre-flight checks (Node, git, repo, config, scope, tsconfig)
│   ├── scan-result/             # parseScanResult + ScanResultParseError (library)
│   ├── report/                  # CLI table + JSON + markdown + CSV (+ trend/assess reporters)
│   ├── config/                  # .hotspot-scanner.json load + merge + validate/print + init exemplar
│   ├── paths/                   # PathScope globs + monorepo git-root remount (resolve-repo)
│   ├── scan-preview.ts          # scan --dry-run scope preview (no mine/NCLOC)
│   ├── scan.ts                  # Pipeline orchestration
│   ├── package-meta.ts          # Cached package.json version for meta.scannerVersion
│   ├── types/                   # Domain types (no runtime logic)
│   └── index.ts                 # Public library API
├── schemas/                     # scan-result, hotspot-scanner-config, complexity-trend, hotspot-assess
├── docs/                        # User docs (recipes, methodology, warning codes)
├── tests/
│   ├── fixtures/                # Git repos, git-log samples, NCLOC, scoring, report, workers
│   ├── contract/                # JSON schema validation against schemas/
│   ├── trend.integration.test.ts
│   └── compiled-cli.smoke.test.ts
└── .specs/                      # Living project docs
```

## Module map

| Path                        | Role                                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------- |
| `bin/hotspot-scanner.ts`    | Commander CLI — `init`, `config validate`/`print`, `doctor`, `trend`, `assess`, `scan`, `completion`     |
| `bin/assess-actions.ts`     | Assess CLI wiring — `executeAssess`, formats, cancel signals, per-file progress                           |
| `bin/trend-actions.ts`      | Trend CLI wiring — `runComplexityTrend`, formats, cancel signals                                          |
| `bin/scan-actions.ts`       | Shared scan CLI wiring — `executeScan`, cancel signals, verbose spawn argv, path validators               |
| `bin/completion-scripts.ts` | `getCompletionScript(shell)` — static bash/zsh/fish scripts                                               |
| `src/git/`                  | GitMiner (numstat churn) + file-history for trend; doctor since-probe helpers                              |
| `src/complexity/`           | Size analyzer — NCLOC batch/discover/pool/worker; indentation metrics for trend                           |
| `src/trend/`                | `classifyGrowthPattern`, `runComplexityTrend` — per-file revision trend + `meta.growthPattern`            |
| `src/assess/`               | `runAssess`, `selectAssessCandidates` — scan → filter → sequential trends → `AssessResult`                |
| `src/scoring/`              | `HotspotScorer` — normalize + hotspot score                                                               |
| `src/diagnostics/`          | stderr logger — warnings + throttled progress                                                             |
| `src/doctor/`               | `runDoctor()` — Node, git, remount-aware repo, config, since preflight, scope, tsconfig                   |
| `src/report/`               | table / json / markdown / csv + trend and assess reporters                                                |
| `src/package-meta.ts`       | `getPackageVersion()` — cached `package.json` version for `meta.scannerVersion`                           |
| `src/scan-result/`          | `parseScanResult`, `ScanResultParseError` — programmatic scan JSON validation                             |
| `src/config/`               | `.hotspot-scanner.json` load, merge, validate, print, schema-linked init exemplar                         |
| `src/paths/`                | `createPathScope`, `resolveMonorepoScanPath`, `filterGitMinerResult`                                       |
| `src/scan-preview.ts`       | `previewScanScope()` — dry-run scope preview (no mine/NCLOC)                                              |
| `src/scan.ts`               | `resolveScanPipelineContext`, `createScanPathScope`, `runScan()` — file-only pipeline                     |
| `src/types/`                | Domain types — `FileChangeStats`, `HotspotScore`, `ScanResult` (`version: "3.0"`), etc.                    |
| `src/index.ts`              | Public library entry — see [Public API](#public-api)                                                      |

## Public API

Exports from `src/index.ts`:

**Values:** `PACKAGE_NAME`, `runScan`, `runComplexityTrend`, `runAssess`, `previewScanScope`, `runDoctor`, `parseScanResult`, `ScanResultParseError`, `formatTruncationNote`, `TrendNotTrackedError`, `TrendUsageError`

**Types:**

- Doctor: `DoctorFinding`, `DoctorFindingId`, `DoctorFindingStatus`, `DoctorResult`, `RunDoctorOptions`
- Trend: `ComplexityTrendOptions`, `ComplexityTrendPoint`, `ComplexityTrendResult`, `ComplexityTrendWarning`
- Assess: `AssessCandidate`, `AssessCandidateStatus`, `AssessOptions`, `AssessPatternCounts`, `AssessResult`
- Scan: `ScanScopePreview`, `FileChangeStats`, `HotspotScore`, `ScanMeta`, `ScanOptions`, `ScanResult`

## Where things live

- **CLI entry / wiring:** `bin/`
- **Scan pipeline:** `src/scan.ts` + `src/git/`, `src/complexity/`, `src/scoring/`, `src/report/`
- **Trend / assess:** `src/trend/`, `src/assess/`
- **Config:** `src/config/`
- **Contracts:** `schemas/`
- **Library entry:** `src/index.ts`

## Test layout

- Co-located `*.test.ts` next to source modules (including `bin/`)
- Top-level: `tests/trend.integration.test.ts`, `tests/compiled-cli.smoke.test.ts`, `tests/contract/`
- `tests/fixtures/git-log/` — raw `git log` output samples
- `tests/fixtures/repos/` — `small-ts`, `with-renames`, `merge-heavy`, `trend-indent`
- `tests/fixtures/complexity/` — NCLOC source snippets (indentation cases co-located in `indentation.test.ts`)
- `tests/fixtures/scoring/` — fixed scoring inputs with documented expected ranking order
- `tests/fixtures/report/` — hand-crafted scan / trend / assess results for reporter tests
- `tests/fixtures/workers/` — worker-thread edge-case scripts for pool tests
