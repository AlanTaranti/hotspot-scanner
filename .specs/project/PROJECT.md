# @vitals/hotspot-scanner

**Vision:** Standalone local CLI that identifies maintenance hotspots in TypeScript/JavaScript repositories by combining **NCLOC** (non-commented lines of code) and Git churn at **file** granularity.

**For:** Developers and tech leads who need to prioritize refactoring targets without commercial tooling.

**Solves:** Which files are hardest to maintain — large, actively changed source files.

## Goals

- Rank files by `hotspotScore = 2ch / (c + h)` where `c` is normalized NCLOC and `h` is normalized churn (harmonic mean)
- Run 100% locally — no network, no CI gate in product scope (see STATE Deferred for future CI recipes)
- Scale from small repos (~500 files, ~5k commits) to large repos via streaming Git parse

## Tech Stack

**Core:**

- Runtime: Node.js 22+
- Language: TypeScript 6 (ESM)
- Test: Vitest (see STATE.md)
- Size metric: project-owned NCLOC scanner (`src/complexity/ncloc.ts`) — no AST dependency
- Git: `child_process.spawn` in `src/git/` (see STATE.md)
- CLI: `commander` (`bin/hotspot-scanner.ts`)

## Scope

**Shipped (v1 + post-v1 through M78):**

- `hotspot-scanner` multi-command CLI: `init`, `config validate`, `config print`, `doctor`, `scan`, `trend`, `assess`, `completion`
- `scan` with `--since`, `--format`, `--top`, `--output`, `--include` / `--exclude`, `--include-tests`, `--config`, `--concurrency`, `--sequential` / `--no-overlap`, `--only`, `--explain`, `--fail-on-explain-miss`, `--quiet` / `--no-progress` / `--verbose`, `--dry-run`, `--warnings`, `--csv-single-file`
- `trend <file>` — per-file indentation + NCLOC history, growth pattern (`meta.growthPattern`), table/json/csv
- `assess [path]` — scan → filter by `--min-hotspot-score` (default `0.7`) → sequential trends; deteriorating-focused report
- Git Change Miner: streaming numstat pass for file churn
- Size analyzer: NCLOC over eligible TS/JS sources (worker-thread pool optional)
- Hotspot Scorer (file hotspots only)
- CLI table, JSON, markdown, and CSV bundle output; interpretation UX; TTY color on scan/doctor/trend/assess tables
- Path scoping, monorepo remount, config file, observability (`meta.warnings`, `meta.timings`, cancel, doctor JSON)
- Package entry exports `runScan`, `runComplexityTrend`, `runAssess`, `previewScanScope`, `runDoctor`, `parseScanResult`, `ScanResultParseError` (+ related types)
- Milestone checklist: [ROADMAP.md](ROADMAP.md) (M1–M78)

### JSON contracts

| Contract | `version` | Schema |
| -------- | --------- | ------ |
| Scan result | `"3.0"` | `schemas/scan-result.json` |
| Complexity trend | `"3.0"` | `schemas/complexity-trend.json` (`kind: "complexity-trend"`) |
| Hotspot assess | `"1.0"` | `schemas/hotspot-assess.json` (`kind: "hotspot-assess"`) |

**Removed (M57):**

- McCabe cyclomatic complexity, `ts-morph`, function granularity (`--granularity`), function-churn patch mining, `functions` array in JSON, `cyclomaticComplexity` / `parseFailed` hotspot fields

**Removed (M71):**

- Compare/baseline CLI (`compare`, `baseline save`, `scan --baseline`, `--strict`), `compareScanResults` / `loadBaseline`, compare report modules, `schemas/compare-result.json`
- `COMPARE_SINCE_MISMATCH` warning code

**Excludes / Next (Deferred — see [STATE.md](STATE.md)):**

- CI/CD gate, dashboard, persistence between runs; CI recipes / fail-on stable deltas / SARIF; fail-on-warning; `--fail-on-deteriorating` for assess
- Languages beyond TS/JS
- Relative code churn (decision closed — raw commit count only)
- Temporal coupling analysis (removed M56)
- npm / npx / `pnpm dlx` publish install path
- Historical AST post-rename (**do not prioritize**)
- Item C — full warning lines in scan report body

## References

- Architecture: [../codebase/ARCHITECTURE.md](../codebase/ARCHITECTURE.md)
- Decisions: [STATE.md](STATE.md)
- Roadmap: [ROADMAP.md](ROADMAP.md)
- Recipes: [../../docs/recipes.md](../../docs/recipes.md)
- Warning codes: [../../docs/warning-codes.md](../../docs/warning-codes.md)
- Security: [../../SECURITY.md](../../SECURITY.md)
