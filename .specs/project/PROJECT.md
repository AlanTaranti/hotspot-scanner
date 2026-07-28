# @vitals/hotspot-scanner

**Package:** `@vitals/hotspot-scanner` · **CLI bin:** `hotspot-scanner`

**Vision:** Standalone local CLI that identifies maintenance hotspots in TypeScript/JavaScript repositories by combining **NCLOC** (non-commented lines of code) and Git churn at **file** granularity.

**For:** Developers and tech leads who need to prioritize refactoring targets without commercial tooling.

**Solves:** Which files are hardest to maintain — large, actively changed source files.

## Goals

- Rank files by `hotspotScore = 2ch / (c + h)` where `c` is normalized NCLOC and `h` is normalized churn (harmonic mean)
- Run 100% locally — no network in product scope
- Scale from small repos (~500 files, ~5k commits) to large repos via streaming Git parse

## Tech Stack

- Runtime: Node.js 22+
- Language: TypeScript 6 (ESM)
- Test: Vitest
- Size metric: project-owned NCLOC scanner (no AST dependency)
- Git: `child_process.spawn`
- CLI: `commander`

Inventory detail: [../codebase/STACK.md](../codebase/STACK.md). Adapters: [../codebase/INTEGRATIONS.md](../codebase/INTEGRATIONS.md).

## Constraints

- Local-only CLI — no network, no SaaS dependency
- TS/JS sources only; hotspots at **file** granularity
- No CI fail gate in product scope
- Config file: `.hotspot-scanner.json`; precedence CLI > config > defaults
- Churn axis: raw commit count (relative code churn closed)

## Scope

**Includes:**

- Multi-command CLI: `init`, `config validate`, `config print`, `doctor`, `scan`, `trend`, `assess`, `completion`
- Scan pipeline: streaming Git churn + NCLOC size analysis + hotspot scoring; path scoping, monorepo remount, config, observability (`meta.warnings`, `meta.timings`, cancel)
- Reports: table, JSON, markdown, CSV bundle; interpretation UX; TTY color on scan/doctor/trend/assess tables
- `trend <file>` — per-file indentation + NCLOC history and growth pattern
- `assess [path]` — scan → score filter → sequential trends; deteriorating-focused report
- Library entry: `runScan`, `runComplexityTrend`, `runAssess`, `previewScanScope`, `runDoctor`, `parseScanResult`, `ScanResultParseError` (+ related types)
- Milestone history: [ROADMAP.md](ROADMAP.md)

### JSON contracts

| Contract         | `version` | Schema                                                       |
| ---------------- | --------- | ------------------------------------------------------------ |
| Scan result      | `"3.0"`   | `schemas/scan-result.json`                                   |
| Complexity trend | `"3.0"`   | `schemas/complexity-trend.json` (`kind: "complexity-trend"`) |
| Hotspot assess   | `"1.0"`   | `schemas/hotspot-assess.json` (`kind: "hotspot-assess"`)     |

**Not in product:**

- McCabe cyclomatic complexity, `ts-morph`, function granularity, function-churn patch mining
- Compare/baseline CLI and compare schemas/APIs
- Temporal coupling analysis
- Languages beyond TS/JS; dashboard; persistence between runs; relative code churn

**Future / deferred:** see [STATE.md](STATE.md) § Deferred.

## References

- Architecture: [../codebase/ARCHITECTURE.md](../codebase/ARCHITECTURE.md)
- Stack: [../codebase/STACK.md](../codebase/STACK.md)
- Decisions: [STATE.md](STATE.md)
- Roadmap: [ROADMAP.md](ROADMAP.md)
- Recipes: [../../docs/recipes.md](../../docs/recipes.md)
- Warning codes: [../../docs/warning-codes.md](../../docs/warning-codes.md)
- Security: [../../SECURITY.md](../../SECURITY.md)
