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

**Shipped (v1 + post-v1 through M57):**

- `hotspot-scanner` multi-command CLI: `init`, `doctor`, `scan`, `baseline save`, `compare`, `completion`
- `scan` with `--since`, `--format`, `--top`, `--baseline`, `--output`, `--include` / `--exclude`, `--include-tests`, `--config`, `--concurrency`, `--sequential` / `--no-overlap`, `--only`, `--explain`, `--strict`, `--quiet` / `--no-progress` / `--verbose`, `--dry-run`
- Git Change Miner: streaming numstat pass for file churn
- Size analyzer: NCLOC over eligible TS/JS sources (worker-thread pool optional)
- Hotspot Scorer (file hotspots only)
- CLI table, JSON (`version: "3.0"`), markdown, and CSV bundle output; interpretation UX; compare deltas for hotspots
- Path scoping, monorepo remount, config file, observability (`meta.warnings`, `meta.timings`, cancel, doctor JSON)
- Package entry exports `runScan`, `previewScanScope`, `runDoctor`, compare helpers
- Milestone checklist: [ROADMAP.md](ROADMAP.md) (M1–M57)

**Removed (M57):**

- McCabe cyclomatic complexity, `ts-morph`, function granularity (`--granularity`), function-churn patch mining, `functions` array in JSON, `cyclomaticComplexity` / `parseFailed` hotspot fields

**Excludes / Next:**

- CI/CD gate, dashboard, persistence between runs
- Languages beyond TS/JS
- Relative code churn (decision closed — raw commit count only)
- Temporal coupling analysis (removed M56)
- npm / npx publish install path (Deferred)
- Residual co-located `*.test.mjs` / `*.spec.cjs` not in default test excludes

## References

- Architecture: [../codebase/ARCHITECTURE.md](../codebase/ARCHITECTURE.md)
- Decisions: [STATE.md](STATE.md)
