# STRUCTURE — @vitals/hotspot-scanner

## Directory layout

```
hotspot-scanner/
├── bin/
│   └── hotspot-scanner.ts       # CLI entry (commander) — flags only
├── src/
│   ├── git/                     # Git Change Miner
│   ├── complexity/              # McCabe over ts-morph
│   ├── scoring/                 # HotspotScorer + TemporalCouplingScorer
│   ├── diagnostics/             # stderr warnings + progress logging
│   ├── report/                  # CLI table + JSON + markdown + CSV reporter
│   ├── scan.ts                  # Pipeline orchestration
│   ├── types/                   # Domain types (no runtime logic)
│   └── index.ts                 # Public library API (optional)
├── tests/
│   └── fixtures/                # Git repos + git log samples + TS complexity fixtures
└── .specs/                      # Living project docs
```

## Module map

| Path | Status | Role |
|------|--------|------|
| `bin/hotspot-scanner.ts` | implemented | Commander CLI — `scan <path>` with `--since`, `--format`, `--granularity`, `--top`, `--min-cochange`, `--output`, `--baseline` |
| `src/git/` | implemented | GitMiner — `spawn`, `parse`, `rename`, `aggregate`, `canonicalize` (+ `onProgress` hook) |
| `src/complexity/` | implemented | ComplexityAnalyzer — McCabe via ts-morph (`discover`, `project`, `mccabe`, `analyze-file`) |
| `src/scoring/` | implemented | HotspotScorer, FunctionHotspotScorer, TemporalCouplingScorer — `normalize`, `hotspot-scorer`, `function-hotspot-scorer`, `coupling-scorer` |
| `src/diagnostics/` | implemented | stderr logger — warnings + throttled progress |
| `src/report/` | implemented | Reporter — `slice`, `json`, `table`, `markdown`, `csv-utils`, `csv`, `slice-compare`, `compare-*` + `createReporter()` factory (`render` + `renderCompare`) |
| `src/compare/` | implemented | Baseline loader, entity keys, `compareScanResults()` engine |
| `src/scan.ts` | implemented | `runScan()` — pipeline orchestration with granularity branch |
| `src/types/` | implemented | FileChangeStats, HotspotScore, ScanOptions, ScanResult, etc. |
| `src/index.ts` | implemented | Public API — `runScan`, `loadBaseline`, `compareScanResults`, types, `PACKAGE_NAME` |

## Test layout

- Co-located `*.test.ts` next to source modules
- `tests/fixtures/git-log/` — raw `git log` output samples
- `tests/fixtures/repos/` — small versioned Git repositories for integration scans
- `tests/fixtures/complexity/` — TS files with known McCabe values
- `tests/fixtures/scoring/` — fixed scoring inputs with documented expected ranking order
- `tests/fixtures/report/` — hand-crafted `ScanResult` for reporter tests
