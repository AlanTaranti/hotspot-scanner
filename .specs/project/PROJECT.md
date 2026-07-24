# @vitals/hotspot-scanner

**Vision:** Standalone local CLI that identifies maintenance hotspots in TypeScript/JavaScript repositories by combining cyclomatic complexity, Git churn, and temporal coupling.

**For:** Developers and tech leads who need to prioritize refactoring targets without commercial tooling.

**Solves:** Which files are hardest to maintain and which file pairs are hidden dependencies (co-change without static imports).

## Goals

- Rank files by `hotspotScore = 2ch / (c + h)` where `c` and `h` are normalized complexity and churn (harmonic mean)
- Surface temporal coupling pairs with `couplingStrength` metric
- Run 100% locally — no network, no CI gate in v1
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

**Shipped (v1 + post-v1 through M18):**

- `hotspot-scanner scan <path>` with `--since`, `--format`, `--top`, `--min-cochange`, `--baseline`, `--output`, `--granularity`, `--include`, `--exclude`
- Git Change Miner (single streaming `git log` pass)
- Complexity Analyzer (McCabe over ts-morph AST; worker-thread batches)
- Hotspot Scorer + Temporal Coupling Scorer
- CLI table, JSON, markdown, and CSV bundle output
- Path scoping: default excludes + `--include`/`--exclude` globs (M7)
- Harmonic hotspot score `2ch/(c+h)` (M8)
- Rich output: raw metrics and `authorCount` in JSON/table (M9)
- Export formats: `--output` file write; `--format markdown` (M10)
- Function granularity: `--granularity file|function` (M11)
- Baseline compare: `--baseline` delta report (M13)
- Enriched coupling: `hasStaticDependency` on coupling pairs (M14)
- Format-scoped `--top`: limits table/markdown only; JSON/CSV export full rankings (M16)
- CSV bundle: multi-file stem + `{stem}.meta.json` sidecar; `--format csv` requires `--output` (M18)

**Excludes / backlog:**

- CI/CD gate, dashboard, persistence between runs
- Languages beyond TS/JS
- Relative code churn (decision closed — raw commit count only)
- JSON schema contract (M20), config file (M21), extended function AST (M22) — planned

## References

- Architecture: [../codebase/ARCHITECTURE.md](../codebase/ARCHITECTURE.md)
- Decisions: [STATE.md](STATE.md)
