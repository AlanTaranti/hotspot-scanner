---
name: vitals-pipeline-domain
description: Pipeline domain knowledge for hotspot-scanner — Git Miner, McCabe complexity, hotspot/coupling scoring, report. Use when implementing or reviewing src/git/, src/complexity/, src/scoring/, src/report/, src/scan.ts, or bin/ wiring. Lighter than vitals-spec-driven for domain context. Do NOT use for planning specs (planner-feature) or full Execute workflow (vitals-spec-driven).
---

# Hotspot Scanner Pipeline Domain

Concise domain reference for `@vitals/hotspot-scanner`. Full design: [`.specs/codebase/ARCHITECTURE.md`](../../../.specs/codebase/ARCHITECTURE.md).

## Pipeline stages

```
git log (stream) → complexity (ts-morph) → scoring → report
```

| Stage | Module | Key components |
| ----- | ------ | -------------- |
| Git | `src/git/` | `GitMiner` — single `git log` pass, streaming parse |
| Complexity | `src/complexity/` | `ComplexityAnalyzer` — McCabe over ts-morph AST |
| Scoring | `src/scoring/` | `HotspotScorer`, `TemporalCouplingScorer` |
| Report | `src/report/` | `Reporter` — CLI table + JSON |
| Orchestration | `src/scan.ts` | `runScan()` |
| CLI | `bin/hotspot-scanner.ts` | commander — flags only, no domain logic |

## Data model (in-memory)

### FileChangeStats

- `filePath`, `commitCount`, `linesChanged`, `authors`, `lastModified`
- Derived from streaming `git log --numstat --name-only`

### ComplexityResult

- `filePath`, `cyclomaticComplexity`, `functionCount`
- Working-tree AST only (not historical versions)

### HotspotScore

- `hotspotScore = 2ch / (c + h)` (harmonic mean of normalized complexity and churn)
- Churn = raw commit count (not relative code churn — closed decision)

### CoChangeEvent / CouplingPair

- `couplingStrength = coChangeCount / min(commitsA, commitsB)`
- Threshold: `--min-cochange` (default TBD)

## McCabe decision nodes (project-owned)

Count as decision nodes:

- `if` / `else if`
- `for`, `while`, `do-while`
- `case` in `switch` (document per-case vs block choice)
- `catch`
- `&&`, `||`, `??` in conditions
- Ternary expressions

Formula: decision nodes + 1 per function/file scope (document exact scope in implementation).

## CLI flags

| Flag | Purpose |
| ---- | ------- |
| `scan <path>` | Target repository |
| `--since <period>` | Git history window (default ~12 months) |
| `--format json` | JSON output |
| `--top <N>` | Limit ranking size |
| `--min-cochange <N>` | Coupling pair threshold |

## Failure modes

| Case | Response |
| ---- | -------- |
| Invalid git repo | Clear error, exit != 0 |
| Invalid TS/JS syntax | Warning, skip file |
| Insufficient history | Warning, proceed with available data |
| File renames | Handle via `--follow`; warn if incomplete |

## Output JSON schema

```json
{ "version": "1.0", "hotspots": [...], "coupling": [...] }
```

## Related docs

- [ARCHITECTURE.md](../../../.specs/codebase/ARCHITECTURE.md)
- [CONCERNS.md](../../../.specs/codebase/CONCERNS.md)
- [INTEGRATIONS.md](../../../.specs/codebase/INTEGRATIONS.md)
