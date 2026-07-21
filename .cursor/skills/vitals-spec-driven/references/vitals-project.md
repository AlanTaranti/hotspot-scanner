# @vitals/hotspot-scanner — Project Context

**Canonical project detail** for agents and skills. Index and policies: [AGENTS.md](../../../../AGENTS.md).

---

## Identity

- **Package:** `@vitals/hotspot-scanner` (npm)
- **CLI bin:** `hotspot-scanner` (unscoped)
- **Purpose:** Local CLI that ranks TS/JS maintenance hotspots from cyclomatic complexity, Git churn, and temporal coupling
- **Pipeline:** `git → complexity → scoring → report`
- **Design SoT:** [specifications/IMPL-2026-003-hotspot-scanner.md](../../../../specifications/IMPL-2026-003-hotspot-scanner.md)

## Module map

| Path | Status | Role |
|------|--------|------|
| `bin/hotspot-scanner.ts` | scaffold | CLI orchestration (commander) — flags only |
| `src/git/` | planned | GitMiner — streaming `git log` parse |
| `src/complexity/` | planned | ComplexityAnalyzer — McCabe via ts-morph |
| `src/scoring/` | planned | HotspotScorer, TemporalCouplingScorer |
| `src/report/` | planned | Reporter — CLI table + JSON |
| `src/scan.ts` | planned | `runScan()` — pipeline orchestration |
| `src/types/` | scaffold | Domain types |
| `src/index.ts` | scaffold | Package entry |

## Gate check

**Full gate (required before finishing any implementation):**

```bash
pnpm build && pnpm test
```

- `pnpm build` — `tsc` + `tsc -p tsconfig.bin.json`
- `pnpm test` — Vitest

SoT: [.specs/codebase/TESTING.md](../../../../.specs/codebase/TESTING.md)

## Domain concepts

- **FileChangeStats** — per-file churn: `commitCount`, `linesChanged`, `authors`, `lastModified`
- **ComplexityResult** — `cyclomaticComplexity`, `functionCount` per file
- **hotspotScore** — `normalize(complexity) × normalize(churn)`
- **CoChangeEvent** — files changed together in one commit
- **couplingStrength** — `coChangeCount / min(commitsA, commitsB)`
- **HotspotScore** / **CouplingPair** — ranked output entities

## Requirement IDs

Prefix **`HOTSPOT-`** (e.g., `HOTSPOT-01`).

## Commit policy

Do not commit unless the user explicitly asks. Propose Conventional Commit message after verification; commit only on request.

## YAGNI (mandatory)

- Implement only what was asked
- No extra features, flags, or config knobs
- No abstractions for single-use code
- No CI/test-framework wiring unless explicitly requested
- Surgical diffs only; mention pre-existing issues without fixing unless asked

## Validation (CLI)

No interactive UI UAT.

1. `pnpm exec hotspot-scanner scan tests/fixtures/repos/<slug>`
2. Exit codes: `0` successful scan, `!= 0` invalid repo/git/args
3. Test `--since`, `--format json`, `--top`, `--min-cochange` when relevant
4. Co-located `*.test.ts` for unit coverage

## Fragile areas

See [CONCERNS.md](../../../../.specs/codebase/CONCERNS.md) and [fragile-areas.mdc](../../../../.cursor/rules/fragile-areas.mdc).

Includes Git streaming parse, McCabe decision nodes, scoring normalization formulas.

## Knowledge sources

1. IMPL-2026-003 + `.specs/codebase/`
2. `vitals-pipeline-domain` skill for scan pipeline context
3. Context7 MCP → ts-morph, commander, vitest (optional)
4. Web search for official docs when needed
