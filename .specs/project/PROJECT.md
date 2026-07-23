# @vitals/hotspot-scanner

**Vision:** Standalone local CLI that identifies maintenance hotspots in TypeScript/JavaScript repositories by combining cyclomatic complexity, Git churn, and temporal coupling.

**For:** Developers and tech leads who need to prioritize refactoring targets without commercial tooling.

**Solves:** Which files are hardest to maintain and which file pairs are hidden dependencies (co-change without static imports).

## Goals

- Rank files by `hotspotScore = 2ch / (c + h)` where `c` and `h` are normalized complexity and churn
- Surface temporal coupling pairs with `couplingStrength` metric
- Run 100% locally — no network, no CI gate in v1
- Scale from small repos (~500 files, ~5k commits) to large repos via streaming Git parse

## Tech Stack

**Core:**

- Runtime: Node.js 22+
- Language: TypeScript 6 (ESM)
- Test: Vitest (see STATE.md)
- AST: ts-morph (McCabe implementation is project-owned)
- Git: subprocess or simple-git
- CLI: commander (TBD at implementation)

## Scope

**v1 includes:**

- `hotspot-scanner scan <path>` with `--since`, `--format json`, `--top`, `--min-cochange`
- Git Change Miner (single `git log` pass)
- Complexity Analyzer (McCabe over ts-morph AST)
- Hotspot Scorer + Temporal Coupling Scorer
- CLI table + JSON output

**v1 excludes:**

- CI/CD gate, dashboard, persistence between runs
- Languages beyond TS/JS
- Relative code churn (decision closed — raw commit count only)

## References

- Architecture: [../codebase/ARCHITECTURE.md](../codebase/ARCHITECTURE.md)
- Decisions: [STATE.md](STATE.md)
