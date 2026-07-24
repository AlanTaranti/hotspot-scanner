# ROADMAP — @vitals/hotspot-scanner

Status: **M18 CSV Bundle complete** — backlog: M14, M19–M24.

## Milestone 1 — Scaffold

→ [`.specs/features/scaffold/spec.md`](../features/scaffold/spec.md)

- [x] Package scripts (`build`, `test`), `vitest.config.ts`
- [x] Module layout under `src/` and `bin/hotspot-scanner.ts` stub
- [x] Domain types in `src/types/`
- [x] Placeholder integration test wiring

## Milestone 2 — Git Change Miner

→ [`.specs/features/git-change-miner/spec.md`](../features/git-change-miner/spec.md)

- [x] Streaming parse of `git log --numstat --name-only`
- [x] `FileChangeStats` aggregation
- [x] `CoChangeEvent[]` extraction per commit
- [x] Rename handling (`old => new` + `PathAliasMap`)
- [x] Fixtures: real `git log` samples (merges, renames, deletes)

## Milestone 3 — Complexity Analyzer

→ [`.specs/features/complexity-analyzer/spec.md`](../features/complexity-analyzer/spec.md)

- [x] ts-morph adapter for `.ts`/`.tsx`/`.js`/`.jsx`
- [x] McCabe cyclomatic complexity (project-owned decision nodes)
- [x] Invalid syntax: warn and skip file
- [x] Fixture TS files with manually verified complexity values

## Milestone 4 — Scoring

→ [`.specs/features/scoring/spec.md`](../features/scoring/spec.md)

- [x] HotspotScorer: log-scale normalize complexity + churn, compute `hotspotScore`
- [x] TemporalCouplingScorer: `couplingStrength = coChangeCount / min(commitsA, commitsB)`
- [x] `DEFAULT_MIN_COCHANGE = 3` + minCochange threshold in scorer

## Milestone 5 — Reporter + CLI

→ [`.specs/features/reporter-cli/spec.md`](../features/reporter-cli/spec.md)

- [x] CLI table output (top hotspots + top coupling pairs)
- [x] JSON output (`version`, `hotspots`, `coupling`, `meta`)
- [x] Flags: `--since`, `--format`, `--top`, `--min-cochange`
- [x] Progress/warning logs for large repos (`src/diagnostics/`)
- [x] `commander` CLI parsing; `runScan()` defaults + hooks (no full pipeline — M6)

## Milestone 6 — Integration

→ [`.specs/features/integration/spec.md`](../features/integration/spec.md)

- [x] Full scan on versioned Git fixture repo (`tests/fixtures/repos/small-ts/`)
- [x] `runScan()` pipeline wiring (git → complexity → scoring)
- [x] Integration + CLI tests on fixture repo
- [x] Manual performance benchmark on large synthetic repo (`scripts/benchmark-scan.md`)
- [x] Coverage gate (`vitest.config.ts` per-file thresholds)

---

## Post-v1 backlog

Próximos milestones priorizados para adoção real. Specs em `.specs/features/<slug>/` serão criadas via `planner-feature` antes do Execute.

### Milestone 7 — Path Scoping

→ [`.specs/features/path-scoping/spec.md`](../features/path-scoping/spec.md)  
**Slug:** `path-scoping` | **Priority:** Critical + High | **Specs:** Done

- [x] Default exclude: `node_modules`, `.git`, `dist`, `coverage`, `build` (complexity discovery + git stats intersection)
- [x] Validate `repoPath` is a Git repository (`.git` exists) before scan
- [x] CLI flags `--include <glob>` and `--exclude <glob>` (repeatable)

### Milestone 8 — Harmonic Hotspot Score

→ [`.specs/features/harmonic-hotspot-score/spec.md`](../features/harmonic-hotspot-score/spec.md)  
**Slug:** `harmonic-hotspot-score` | **Priority:** High | **Specs:** Done

Prefer balanced dual-signal files (actively complex + churned) over spiky one-axis outliers. Same normalization; only combiner changes.

- [x] Replace `hotspotScore = c × h` with `hotspotScore = 2ch / (c + h)` (harmonic mean of normalized complexity and churn)
- [x] Zero guard: when `c + h === 0`, score is `0` (covers zero churn, missing stats, degenerate normalization)
- [x] Update scoring fixtures and unit tests with new expected rankings (order may change vs product)
- [x] Record decision in STATE.md; sync CONCERNS.md, README, fragile-areas rule, pipeline-domain skill

### Milestone 9 — Rich Output

→ [`.specs/features/rich-output/spec.md`](../features/rich-output/spec.md)  
**Slug:** `rich-output` | **Priority:** Critical + High | **Specs:** Done

- [x] JSON hotspots include raw `cyclomaticComplexity`, `commitCount`, `linesChanged`, `functionCount`
- [x] Table output shows raw metrics alongside normalized scores
- [x] Expose bus factor: `authorCount` (from existing `authors` Set in `FileChangeStats`)

### Milestone 10 — Export Formats

→ [`.specs/features/export-formats/spec.md`](../features/export-formats/spec.md)  
**Slug:** `export-formats` | **Priority:** High | **Specs:** Done

- [x] `--output <path>` writes report to file (table/json/markdown)
- [x] `--format markdown` for PR-friendly report

### Milestone 11 — Function Granularity

→ [`.specs/features/function-granularity/spec.md`](../features/function-granularity/spec.md)  
**Slug:** `function-granularity` | **Priority:** High | **Specs:** Done

- [x] Per-function McCabe in output (`functionName`, `line`, `complexity`)
- [x] `--granularity file|function` (default `file`; function mode ranks top functions)

### Milestone 13 — Scan Compare

→ [`.specs/features/scan-compare/spec.md`](../features/scan-compare/spec.md)  
**Slug:** `scan-compare` | **Priority:** High | **Specs:** Done

- [x] `hotspot-scanner scan <path> --baseline <file>`
- [x] Delta report: new/removed/rank-changed hotspots, functions, and coupling pairs

### Milestone 14 — Enriched Coupling

**Slug (planned):** `enriched-coupling` | **Priority:** High

- [ ] Static import analysis between coupled file pairs
- [ ] Output field `hasStaticDependency: boolean` on `CouplingPair`

### Milestone 15 — AST Parallelization

→ [`.specs/features/ast-parallelization/spec.md`](../features/ast-parallelization/spec.md)  
**Slug:** `ast-parallelization` | **Priority:** High | **Specs:** Done

- [x] Worker-thread batch processing in `src/complexity/` (RT-001)
- [x] Remove entry from STATE.md §Deferred when Done

### Milestone 16 — Format-Scoped Top Limit

→ [`.specs/features/format-scoped-top/spec.md`](../features/format-scoped-top/spec.md)  
**Slug:** `format-scoped-top` | **Priority:** Medium | **Specs:** Done

- [x] `--top` limits output only for `--format table`, `--format markdown`
- [x] `--format json` (scan and compare) outputs full ranked arrays; `--top` is ignored
- [x] Compare: classification still uses full rankings; slicing applies only to table/markdown delta display

### Milestone 17 — CSV Export

→ [`.specs/features/csv-export/spec.md`](../features/csv-export/spec.md)  
**Slug:** `csv-export` | **Priority:** Medium | **Specs:** Done

> **Note:** Multi-block single-file CSV layout is **superseded by Milestone 18** (`csv-bundle`). Leave M17 historical; do not reopen.

- [x] `--format csv` CLI option (scan + compare)
- [x] `renderCsv()` / `renderCompareCsv()` in `src/report/` — tabular hotspots, functions (`--granularity function`), and coupling sections
- [x] RFC 4180 escaping (commas, quotes, newlines in file paths)
- [x] Works with `--output <path>` (same transport rules as M10)
- [x] `--top` ignored for CSV (full rankings, parity with JSON; M16 scopes `--top` to table/markdown only)

### Milestone 18 — CSV Bundle Export

→ [`.specs/features/csv-bundle/spec.md`](../features/csv-bundle/spec.md)  
**Slug:** `csv-bundle` | **Priority:** Medium | **Specs:** Done

Breaking redesign of `--format csv`: multi-file stem bundle + `{stem}.meta.json` sidecar (replaces M17 multi-block single file).

- [x] `CsvBundle` return type from `renderCsv()` / `renderCompareCsv()`; reporter stays pure (no `fs`)
- [x] Scan bundle: `{stem}.meta.json` + `{stem}.hotspots.csv`|`{stem}.functions.csv` + `{stem}.coupling.csv`
- [x] Compare bundle: always 6 data CSVs + meta (empty = header-only); hierarchical names
- [x] `--format csv` requires `--output` (`CliUsageError` otherwise); CLI stem expansion + multi-write
- [x] No title rows; reuse M17 column sets + `csv-utils`; `--top` ignored; no legacy multi-block flag

### Milestone 19 — Documentation Sync

**Slug (planned):** `docs-sync` | **Priority:** Medium

- [ ] Sync [PROJECT.md](PROJECT.md) with post-v1 reality (no simple-git, commander implemented, features M7–M18)
- [ ] Fix stale status in ROADMAP header and `design.md`/`spec.md` for Done milestones (e.g. csv-bundle `Status: Planned`)
- [ ] Update [README.md](../../README.md): full JSON (M9/M11), compare JSON, programmatic API, markdown/csv formats
- [ ] Fix [INTEGRATIONS.md](../codebase/INTEGRATIONS.md): `child_process.spawn` only (remove `simple-git` mention)

### Milestone 20 — JSON Contract

**Slug (planned):** `json-contract` | **Priority:** High

- [ ] Publish JSON Schema for `ScanResult` and `CompareResult` (e.g. `schemas/scan-result.json`)
- [ ] Strong validation in `loadBaseline()` (`src/compare/load-baseline.ts`) — reject malformed JSON with clear error
- [ ] Contract tests: CLI `--format json` output and compare match schema

### Milestone 21 — Config File

**Slug (planned):** `config-file` | **Priority:** High

- [ ] Support `.hotspot-scanner.json` (or `.hotspotrc`) with defaults: `since`, `include`, `exclude`, `granularity`, `minCochange`, `top`
- [ ] Precedence: CLI flags > config file > defaults
- [ ] Document in README and ARCHITECTURE

### Milestone 22 — Function AST Coverage

**Slug (planned):** `function-ast-coverage` | **Priority:** Medium

- [ ] Extend `src/complexity/analyze-file.ts` for getters/setters, class field arrows, object-literal methods
- [ ] McCabe fixtures per construct; do not change existing decision-node definition

### Milestone 23 — Per-Function Git Churn

**Slug (planned):** `per-function-churn` | **Priority:** Medium

- [ ] Per-function churn in `--granularity function` mode (replace inherited file churn — M11 decision)
- [ ] Approach TBD in spec (e.g. blame-lite by function line range); out of scope: historical AST per commit

### Milestone 24 — Package DX

**Slug (planned):** `package-dx` | **Priority:** Medium

- [ ] Scripts: `typecheck`, `lint` (optionally `format`, `dev`)
- [ ] `package.json`: `engines.node >= 22`, `files`, `repository` (publish prep)
- [ ] Document in CONTRIBUTING

### Suggested execution order

M14 → M19 → M20 → M21 → M22 → M23 → M24
