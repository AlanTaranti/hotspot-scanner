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
| `bin/hotspot-scanner.ts` | scaffold | CLI stub — `scan <path>` delegates to `runScan` |
| `src/git/` | stub | GitMiner — streaming `git log` parse |
| `src/complexity/` | stub | ComplexityAnalyzer — McCabe via ts-morph |
| `src/scoring/` | stub | HotspotScorer, TemporalCouplingScorer |
| `src/report/` | stub | Reporter — table + JSON |
| `src/scan.ts` | scaffold | `runScan()` pipeline stub (empty result) |
| `src/types/` | scaffold | FileChangeStats, HotspotScore, etc. |
| `src/index.ts` | scaffold | Public API — `runScan`, types, `PACKAGE_NAME` |

## Test layout

- Co-located `*.test.ts` next to source modules
- `tests/fixtures/git-log/` — raw `git log` output samples
- `tests/fixtures/repos/` — small versioned Git repositories for integration scans
- `tests/fixtures/complexity/` — TS files with known McCabe values
