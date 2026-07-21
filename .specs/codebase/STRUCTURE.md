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
│   ├── report/                  # CLI table + JSON reporter
│   ├── scan.ts                  # Pipeline orchestration
│   ├── types/                   # Domain types (no runtime logic)
│   └── index.ts                 # Public library API (optional)
├── tests/
│   └── fixtures/                # Git repos + git log samples + TS complexity fixtures
├── specifications/
│   └── IMPL-2026-003-hotspot-scanner.md
└── .specs/                      # Living project docs
```

## Module map

| Path | Status | Role |
|------|--------|------|
| `bin/hotspot-scanner.ts` | planned | CLI orchestration (commander) |
| `src/git/` | planned | GitMiner — streaming `git log` parse |
| `src/complexity/` | planned | ComplexityAnalyzer — McCabe via ts-morph |
| `src/scoring/` | planned | HotspotScorer, TemporalCouplingScorer |
| `src/report/` | planned | Reporter — table + JSON |
| `src/scan.ts` | planned | `runScan()` pipeline wiring |
| `src/types/` | planned | FileChangeStats, HotspotScore, etc. |
| `src/index.ts` | scaffold | Package entry stub |

## Test layout

- Co-located `*.test.ts` next to source modules
- `tests/fixtures/git-log/` — raw `git log` output samples
- `tests/fixtures/repos/` — small versioned Git repositories for integration scans
- `tests/fixtures/complexity/` — TS files with known McCabe values
