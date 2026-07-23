# ROADMAP — @vitals/hotspot-scanner

Status: **M6 Integration complete** — Post-v1 backlog planned (M7–M15).

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

- [ ] Replace `hotspotScore = c × h` with `hotspotScore = 2ch / (c + h)` (harmonic mean of normalized complexity and churn)
- [ ] Zero guard: when `c + h === 0`, score is `0` (covers zero churn, missing stats, degenerate normalization)
- [ ] Update scoring fixtures and unit tests with new expected rankings (order may change vs product)
- [ ] Record decision in STATE.md; sync CONCERNS.md, README, fragile-areas rule, pipeline-domain skill

### Milestone 9 — Rich Output

**Slug (planned):** `rich-output` | **Priority:** Critical + High

- [ ] JSON hotspots include raw `cyclomaticComplexity`, `commitCount`, `linesChanged`, `functionCount`
- [ ] Table output shows raw metrics alongside normalized scores
- [ ] Expose bus factor: `authorCount` (from existing `authors` Set in `FileChangeStats`)

### Milestone 10 — Export Formats

**Slug (planned):** `export-formats` | **Priority:** High

- [ ] `--output <path>` writes report to file (table/json/markdown)
- [ ] `--format markdown` for PR-friendly report

### Milestone 11 — Function Granularity

**Slug (planned):** `function-granularity` | **Priority:** High

- [ ] Per-function McCabe in output (`functionName`, `line`, `complexity`)
- [ ] `--granularity file|function` (default `file`; function mode ranks top functions)

### Milestone 12 — CI Gate

**Slug (planned):** `ci-gate` | **Priority:** Critical

- [ ] `--fail-on-hotspot-score <n>` and/or `--fail-on-coupling-strength <n>`
- [ ] Exit code `1` when threshold exceeded (success scan with gate failure)
- [ ] Document reversal of v1 CI-gate non-goal in STATE.md when planned

### Milestone 13 — Scan Compare

**Slug (planned):** `scan-compare` | **Priority:** High

- [ ] `hotspot-scanner compare <baseline.json> <path>` or `scan --baseline <file>`
- [ ] Delta report: new/removed/ranked-changed hotspots and coupling pairs

### Milestone 14 — Enriched Coupling

**Slug (planned):** `enriched-coupling` | **Priority:** High

- [ ] Static import analysis between coupled file pairs
- [ ] Output field `hasStaticDependency: boolean` on `CouplingPair`

### Milestone 15 — AST Parallelization

**Slug (planned):** `ast-parallelization` | **Priority:** High

- [ ] Worker-thread batch processing in `src/complexity/` (RT-001)
- [ ] Remove entry from STATE.md §Deferred when Done

### Suggested execution order

M7 → M8 → M9 → M12 → M10 → M11 → M13 → M14 → M15
