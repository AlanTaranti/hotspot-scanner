# @vitals/hotspot-scanner

**Vision:** Standalone local CLI that identifies maintenance hotspots in TypeScript/JavaScript repositories by combining cyclomatic complexity, Git churn, and temporal coupling.

**For:** Developers and tech leads who need to prioritize refactoring targets without commercial tooling.

**Solves:** Which files are hardest to maintain and which file pairs are hidden dependencies (co-change without static imports).

## Goals

- Rank files by `hotspotScore = 2ch / (c + h)` where `c` and `h` are normalized complexity and churn (harmonic mean)
- Surface temporal coupling pairs with `couplingStrength` metric
- Run 100% locally — no network, no CI gate in product scope (see STATE Deferred for future CI recipes)
- Scale from small repos (~500 files, ~5k commits) to large repos via streaming Git parse

## Tech Stack

**Core:**

- Runtime: Node.js 22+
- Language: TypeScript 6 (ESM)
- Test: Vitest (see STATE.md)
- AST: ts-morph (McCabe implementation is project-owned)
- Git: `child_process.spawn` in `src/git/` (see STATE.md)
- CLI: `commander` (`bin/hotspot-scanner.ts`)

## Scope

**Shipped (v1 + post-v1 through M55):**

- `hotspot-scanner` multi-command CLI: `init`, `doctor`, `scan`, `baseline save`, `compare`, `completion`
- `scan` with `--since`, `--format`, `--top`, `--min-cochange`, `--baseline`, `--output`, `--granularity`, `--include` / `--exclude`, `--include-tests`, `--config`, `--concurrency`, `--sequential` / `--no-overlap`, `--mega-commit-threshold`, `--only`, `--explain`, `--strict`, `--quiet` / `--no-progress` / `--verbose`, `--dry-run`
- Git Change Miner: streaming numstat pass for file churn and coupling; function mode adds sequential pathspec-batched patch streams for per-function hunk-overlap churn
- Complexity Analyzer (McCabe over ts-morph AST; persistent worker-thread pool; `.ts`/`.tsx`/`.js`/`.jsx`/`.mjs`/`.cjs`)
- Hotspot Scorer + Temporal Coupling Scorer + static coupling enrich (relative, tsconfig paths, in-repo `exports`/`imports`)
- CLI table, JSON, markdown, and CSV bundle output; interpretation UX (summary, glossary, triage); compare deltas
- Path scoping: artifact + test default excludes; `--include-tests` opt-in; monorepo package-cwd remount + auto-include
- Config: `.hotspot-scanner.json` (parent walk / `--config`); CLI > config > defaults; unknown keys → warn-only `UNKNOWN_CONFIG_KEY`
- Observability: structured `meta.warnings`, `meta.timings`, SIGINT/SIGTERM cancel, `doctor --format json`
- Package entry exports `runScan`, `previewScanScope`, `runDoctor`, compare helpers; `SECURITY.md` + zero-network policy
- Milestone checklist: [ROADMAP.md](ROADMAP.md) (M1–M55 Done)

**Excludes / Next:**

- CI/CD gate, dashboard, persistence between runs (CI recipes / SARIF deferred — see [STATE.md](STATE.md) Deferred)
- Languages beyond TS/JS
- Relative code churn (decision closed — raw commit count only)
- npm / npx publish install path (Deferred)
- Historical AST post-rename (Deferred — do not prioritize)
- Residual co-located `*.test.mjs` / `*.spec.cjs` not in default test excludes (accepted; user `--exclude` or future follow-up)

## References

- Architecture: [../codebase/ARCHITECTURE.md](../codebase/ARCHITECTURE.md)
- Decisions: [STATE.md](STATE.md)
