---
name: vitals-pipeline-domain
description: Pipeline domain knowledge for hotspot-scanner — Git Miner, McCabe complexity, hotspot/coupling scoring, compare, config, report. Use when implementing or reviewing src/git/, src/complexity/, src/scoring/, src/compare/, src/config/, src/report/, src/scan.ts, schemas/, or bin/ wiring. Lighter than vitals-spec-driven for domain context. Do NOT use for planning specs (planner-feature) or full Execute workflow (vitals-spec-driven).
---

# Hotspot Scanner Pipeline Domain

Concise domain reference for `@vitals/hotspot-scanner`. Full design: [`.specs/codebase/ARCHITECTURE.md`](../../../.specs/codebase/ARCHITECTURE.md). Formulas / fragile risks SoT: [CONCERNS.md](../../../.specs/codebase/CONCERNS.md).

## Pipeline stages

```
git log (stream) → complexity (ts-morph) → scoring (+ static coupling enrich) → report
optional: loadBaseline → compareScanResults → compare report
```

| Stage         | Module                   | Key components                                                                                 |
| ------------- | ------------------------ | ---------------------------------------------------------------------------------------------- |
| Git           | `src/git/`               | `GitMiner` — single `git log` pass, streaming parse                                            |
| Complexity    | `src/complexity/`        | `ComplexityAnalyzer` — McCabe over ts-morph AST                                                |
| Scoring       | `src/scoring/`           | `HotspotScorer`, `FunctionHotspotScorer`, `TemporalCouplingScorer`, `enrichCouplingStaticDeps` |
| Config        | `src/config/`            | `.hotspot-scanner.json` + `mergeScanOptions` (CLI > config > defaults)                         |
| Compare       | `src/compare/`           | `loadBaseline`, `compareScanResults`                                                           |
| Report        | `src/report/`            | table, JSON, markdown, CSV bundle (+ compare variants)                                         |
| Orchestration | `src/scan.ts`            | `runScan()`                                                                                    |
| CLI           | `bin/hotspot-scanner.ts` | commander — flags only, no domain logic                                                        |
| Schemas       | `schemas/`               | `scan-result.json`, `compare-result.json`                                                      |

## Data model (in-memory)

### FileChangeStats

- `filePath`, `commitCount`, `linesChanged`, `authors`, `lastModified`
- Derived from streaming `git log --numstat --name-only`

### ComplexityResult / FunctionComplexityResult

- File: `filePath`, `cyclomaticComplexity`, `functionCount`
- Function: `filePath`, `functionName`, `line`, `complexity`
- Working-tree AST only (not historical versions)

### HotspotScore / FunctionHotspotScore / CouplingPair

- Formulas SoT: [CONCERNS.md](../../../.specs/codebase/CONCERNS.md) — `hotspotScore = 2ch / (c + h)`; `couplingStrength = coChangeCount / min(commitsA, commitsB)`
- Churn = raw commit count (not relative code churn)
- Function mode: complexity normalized across functions; churn from per-function hunk overlap (`FunctionChurnMiner`, M23)
- `CouplingPair.hasStaticDependency` set post-score (ranking unchanged)
- Threshold: `--min-cochange` / `DEFAULT_MIN_COCHANGE = 3`

## McCabe decision nodes (project-owned)

List and definition SoT: [CONCERNS.md](../../../.specs/codebase/CONCERNS.md) / [ARCHITECTURE.md](../../../.specs/codebase/ARCHITECTURE.md). Count: `if`/`else if`, loops, `case`, `catch`, `&&`/`||`/`??`, ternaries; formula = decision nodes + 1 per scope.

## CLI flags

| Flag                      | Purpose                                                          |
| ------------------------- | ---------------------------------------------------------------- |
| `scan <path>`             | Target repository                                                |
| `--since <period>`        | Git history window (default ~12 months)                          |
| `--format <fmt>`          | `table` \| `json` \| `markdown` \| `csv`                         |
| `--granularity <mode>`    | `file` (default) or `function`                                   |
| `--top <N>`               | Slice rankings for **table/markdown only**; ignored for json/csv |
| `--min-cochange <N>`      | Coupling pair threshold (default 3)                              |
| `--include` / `--exclude` | Path scoping (repeatable)                                        |
| `--output <path>`         | Write report to file; **required** for `--format csv`            |
| `--baseline <file>`       | Compare against prior `ScanResult` JSON                          |

Config file: `<repoPath>/.hotspot-scanner.json` only (`since`, `include`, `exclude`, `granularity`, `minCochange`, `top`). CLI-only: `format`, `output`, `baseline`.

## Failure modes

| Case                      | Response                                  |
| ------------------------- | ----------------------------------------- |
| Invalid git repo          | Clear error, exit != 0                    |
| Invalid TS/JS syntax      | Warning, skip file                        |
| Insufficient history      | Warning, proceed with available data      |
| File renames              | `old => new` + `PathAliasMap` (not `--follow`); warn if incomplete |
| Bad baseline / schema     | `BaselineError`, exit != 0                |
| Invalid config JSON/types | `ConfigError`, exit != 0                  |

## Output JSON contract

SoT: [`schemas/scan-result.json`](../../../schemas/scan-result.json), [`schemas/compare-result.json`](../../../schemas/compare-result.json).

- `granularity: "file"` — `hotspots` populated, `functions` empty
- `granularity: "function"` — `functions` populated, `hotspots` empty
- Coupling items require `hasStaticDependency`

## Related docs

- [ARCHITECTURE.md](../../../.specs/codebase/ARCHITECTURE.md)
- [CONCERNS.md](../../../.specs/codebase/CONCERNS.md)
- [INTEGRATIONS.md](../../../.specs/codebase/INTEGRATIONS.md)
- [STRUCTURE.md](../../../.specs/codebase/STRUCTURE.md)
