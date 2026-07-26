# STRUCTURE — @vitals/hotspot-scanner

## Directory layout

```
hotspot-scanner/
├── bin/
│   ├── hotspot-scanner.ts       # CLI entry (commander) — init, doctor, scan, baseline save, compare, completion
│   ├── scan-actions.ts          # Shared scan/compare CLI wiring (runScan, compare render, path validation)
│   └── completion-scripts.ts    # Static bash/zsh/fish completion scripts (M54)
├── src/
│   ├── git/                     # Git Change Miner (numstat churn only)
│   ├── complexity/              # NCLOC size analyzer (file-level)
│   ├── scoring/                 # HotspotScorer (file hotspots)
│   ├── diagnostics/             # stderr warnings + progress logging
│   ├── doctor/                  # Pre-flight checks (Node, git, repo, config, scope, tsconfig)
│   ├── compare/                 # Baseline load + compareScanResults
│   ├── report/                  # CLI table + JSON + markdown + CSV reporter
│   ├── config/                  # .hotspot-scanner.json load + merge + init exemplar writer
│   ├── paths/                   # PathScope globs + monorepo git-root remount (resolve-repo)
│   ├── scan-preview.ts          # scan --dry-run scope preview (no mine/NCLOC)
│   ├── scan.ts                  # Pipeline orchestration
│   ├── types/                   # Domain types (no runtime logic)
│   └── index.ts                 # Public library API
├── schemas/                     # JSON Schema scan/compare contracts (version 3.0)
├── tests/
│   └── fixtures/                # Git repos + git log samples + NCLOC fixtures
└── .specs/                      # Living project docs
```

## Module map

| Path                     | Status      | Role                                                                                                                                                                                               |
| ------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bin/hotspot-scanner.ts` | implemented | Commander CLI — `init`, `doctor`, `scan [path]`, `baseline save <path>`, `compare <path> --baseline <file>`, `completion <shell>`; scan/compare flags include `--since`, `--format`, `--top`, `--include`, `--exclude`, `--config`, `--concurrency`, `--output`, `--baseline`, `--only`, `--no-triage-hints`, `--no-color`, `--explain`, `--strict`, `--dry-run`, `--include-tests`, `--sequential` / `--no-overlap`, `--quiet`, `--no-progress`, `--verbose`, `--warnings` |
| `bin/scan-actions.ts`    | implemented | Shared CLI wiring — `executeScan`, `executeCompareAndRender`, `writeBaselineJson`, `runWithScanCancelSignals`, `createVerboseSpawnArgvHandler`, path validators |
| `bin/completion-scripts.ts` | implemented | `getCompletionScript(shell)` — static bash/zsh/fish scripts (M54) |
| `src/git/`               | implemented | GitMiner — `spawn`, `parse`, `rename`, `aggregate`, `canonicalize`; `ls-files.ts` (M36) |
| `src/complexity/`        | implemented | Size analyzer — NCLOC (`ncloc.ts`, `analyze-file`, `analyze-batch`, `discover`, `pool`, `worker`) |
| `src/scoring/`           | implemented | `HotspotScorer` — `normalize`, `hotspot-scorer` |
| `src/diagnostics/`       | implemented | stderr logger — warnings + throttled progress |
| `src/doctor/`            | implemented | `runDoctor()` — Node, git, remount-aware repo, config, scope via `previewScanScope`, tsconfig |
| `src/report/`            | implemented | Reporter — `only`, `summary`, `glossary`, `triage`, `compare-triage`, `explain`, `explain-compare`, `color`; table/json/markdown/csv + compare variants |
| `src/compare/`           | implemented | Baseline loader (`loadBaseline` rejects pre-3.0), `compareScanResults` |
| `src/config/`            | implemented | `.hotspot-scanner.json` loader, `mergeScanOptions`, `exemplar.ts`, `UNKNOWN_CONFIG_KEY` for legacy keys |
| `src/paths/`             | implemented | `createPathScope`, `resolveMonorepoScanPath`, `filterGitMinerResult` |
| `src/scan-preview.ts`    | implemented | `previewScanScope()` — prelude + eligible file count (no mine/NCLOC) |
| `src/scan.ts`            | implemented | `resolveScanPipelineContext`, `createScanPathScope`, `runScan()` — file-only pipeline |
| `src/types/`             | implemented | `FileChangeStats`, `HotspotScore`, `ScanResult` (`version: "3.0"`), etc. |
| `src/index.ts`           | implemented | Public API — `runScan`, `previewScanScope`, `runDoctor`, compare helpers |

## Test layout

- Co-located `*.test.ts` next to source modules
- `tests/fixtures/git-log/` — raw `git log` output samples
- `tests/fixtures/repos/` — small versioned Git repositories for integration scans
- `tests/fixtures/complexity/` — NCLOC-verified source snippets (M57)
- `tests/fixtures/scoring/` — fixed scoring inputs with documented expected ranking order
- `tests/fixtures/report/` — hand-crafted `ScanResult` for reporter tests
- `tests/contract/` — JSON schema validation against `schemas/`
