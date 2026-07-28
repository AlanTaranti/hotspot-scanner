---
name: vitals-pipeline-domain
description: Pipeline domain knowledge for hotspot-scanner — Git Miner, NCLOC size analysis, hotspot scoring, scan-result parse, config, report. Use when implementing or reviewing src/git/, src/complexity/, src/scoring/, src/scan-result/, src/config/, src/report/, src/scan.ts, schemas/, or bin/ wiring. Lighter than vitals-spec-driven for domain context. Do NOT use for planning specs (planner-feature) or full Execute workflow (vitals-spec-driven).
---

# Hotspot Scanner Pipeline Domain

Concise domain reference for `@vitals/hotspot-scanner`. Full design: [`.specs/codebase/ARCHITECTURE.md`](../../../.specs/codebase/ARCHITECTURE.md). Formulas / fragile risks SoT: [CONCERNS.md](../../../.specs/codebase/CONCERNS.md).

## Pipeline stages

```
git log (stream) → NCLOC size analysis → hotspot scoring → report
```

| Stage         | Module                   | Key components                                                                                 |
| ------------- | ------------------------ | ---------------------------------------------------------------------------------------------- |
| Git           | `src/git/`               | `GitMiner` — single `git log` numstat pass, streaming parse for file churn                      |
| Size          | `src/complexity/`        | `ComplexityAnalyzer` — `countNcloc()` over file text (no AST)                                  |
| Scoring       | `src/scoring/`           | `HotspotScorer` — file hotspots only                                                           |
| Config        | `src/config/`            | `.hotspot-scanner.json` + `mergeScanOptions` (CLI > config > defaults)                         |
| Scan-result   | `src/scan-result/`       | `parseScanResult`, `ScanResultParseError` — programmatic JSON validation (library only)        |
| Report        | `src/report/`            | table, JSON, markdown, CSV bundle; trend table (`trend-table.ts`); explain + `formatTrendNextStep` |
| Trend         | `src/trend/`             | `runComplexityTrend` — per-file revision history; `classifyGrowthPattern` → `meta.growthPattern` (always-on; table `Pattern:` line) |
| Assess        | `src/assess/`            | `runAssess` — scan → `selectAssessCandidates` → sequential `runComplexityTrend`; `AssessResult` (`version: "1.0"`, `kind: "hotspot-assess"`) |
| Orchestration | `src/scan.ts`            | `runScan()` — file-only pipeline                                                               |
| CLI           | `bin/hotspot-scanner.ts` | commander — flags only, no domain logic                                                        |
| Schemas       | `schemas/`               | `scan-result.json`, `hotspot-scanner-config.json`, `complexity-trend.json` (`version: "3.0"`), `hotspot-assess.json` (`version: "1.0"`) |

**Superseded (M71):** `src/compare/`, compare report modules, `schemas/compare-result.json`, CLI compare/baseline — see Done spec `.specs/features/remove-compare-baseline/`.

## Data model (in-memory)

### FileChangeStats

- `filePath`, `commitCount`, `linesChanged`, `authors`, `lastModified`
- Derived from streaming `git log --numstat`

### ComplexityResult (NCLOC)

- `filePath`, `ncloc`
- Working-tree source read only (not historical versions)

### HotspotScore

- Formulas SoT: [CONCERNS.md](../../../.specs/codebase/CONCERNS.md) — `hotspotScore = 2ch / (c + h)` where `c` = normalized NCLOC
- Churn = raw commit count (not relative code churn)
- Fields: `ncloc`, `complexityNormalized`, `churnNormalized`, `hotspotScore`, churn raw metrics

## NCLOC definition (RT-005)

SoT: [CONCERNS.md](../../../.specs/codebase/CONCERNS.md) / `src/complexity/ncloc.ts`. Single-pass state machine: blank and comment-only lines excluded; code + trailing `//` counts; strings/templates handled without full JS lexer.

## CLI flags

| Flag                      | Purpose                                                          |
| ------------------------- | ---------------------------------------------------------------- |
| `scan <path>`             | Target repository                                                |
| `--since <period>`        | Git history window (default ~12 months)                          |
| `--format <fmt>`          | `table` \| `json` \| `markdown` \| `csv`                         |
| `--top <N>`               | Slice rankings for **table/markdown only**; ignored for json/csv |
| `--include` / `--exclude` | Path scoping (repeatable)                                        |
| `--output <path>`         | Write report to file; **required** for `--format csv`            |
| `--only hotspots`         | Section filter (only valid value post-M57)                       |
| `--explain <path>`        | File-path score breakdown on stderr after report; hit appends `next: hotspot-scanner trend <path>` |
| `--fail-on-explain-miss`  | Exit `1` when `--explain` target missing (requires `--explain`)  |
| `trend <file>`            | Per-file indentation/NCLOC history; always-on `Pattern:` / `meta.growthPattern` (`deteriorating` \| `refactored` \| `stable` \| `inconclusive`) |
| `assess [path]`           | Scan + sequential trends on filtered candidates; `--min-hotspot-score` (CLI-only, default `0.7`); `--top` caps after filter (all formats) |

Config file: `.hotspot-scanner.json` (`since`, `include`, `exclude`, `top`, `concurrency`). CLI-only: `format`, `output`, assess `--min-hotspot-score`. Legacy `granularity` → `UNKNOWN_CONFIG_KEY`.

## Failure modes

| Case                      | Response                                  |
| ------------------------- | ----------------------------------------- |
| Invalid git repo          | Clear error, exit != 0                    |
| Unreadable source file    | `READ_FAILED` warning, omit from hotspots |
| Insufficient history      | Warning, proceed with available data      |
| File renames              | `old => new` + `PathAliasMap` (not `--follow`); warn if incomplete |
| Invalid scan JSON (lib)   | `ScanResultParseError` — library throw     |
| Invalid config JSON/types | `ConfigError`, exit != 0                  |

## Output JSON contract

SoT: [`schemas/scan-result.json`](../../../schemas/scan-result.json).

- `version: "3.0"` — `hotspots` + `meta` only
- Each hotspot includes `ncloc` (not `cyclomaticComplexity`)
- `parseScanResult` rejects `1.0`/`2.0`, `coupling`, `functions`, `cyclomaticComplexity` on hotspot items

## Related docs

- [ARCHITECTURE.md](../../../.specs/codebase/ARCHITECTURE.md)
- [CONCERNS.md](../../../.specs/codebase/CONCERNS.md)
- [INTEGRATIONS.md](../../../.specs/codebase/INTEGRATIONS.md)
- [STRUCTURE.md](../../../.specs/codebase/STRUCTURE.md)
