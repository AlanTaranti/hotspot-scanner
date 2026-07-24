# ROADMAP — @vitals/hotspot-scanner

Status: **M24 Package DX Done** — post-v1 milestones M7–M24 Done. Next backlog: **M25–M30** (stubs; specs Pending until `planner-feature`).

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

→ [`.specs/features/enriched-coupling/spec.md`](../features/enriched-coupling/spec.md)  
**Slug:** `enriched-coupling` | **Priority:** High | **Specs:** Done

- [x] Static import analysis between coupled file pairs
- [x] Output field `hasStaticDependency: boolean` on `CouplingPair`

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

→ [`.specs/features/docs-sync/spec.md`](../features/docs-sync/spec.md)  
**Slug:** `docs-sync` | **Priority:** Medium | **Specs:** Done

- [x] Sync [PROJECT.md](PROJECT.md) with post-v1 reality (no simple-git, commander implemented, features M7–M18)
- [x] Fix stale status in ROADMAP header and `design.md`/`spec.md` for Done milestones (e.g. csv-bundle `Status: Planned`)
- [x] Update [README.md](../../README.md): full JSON (M9/M11), compare JSON, programmatic API, markdown/csv formats
- [x] Fix [INTEGRATIONS.md](../codebase/INTEGRATIONS.md): `child_process.spawn` only (remove `simple-git` mention)

### Milestone 20 — JSON Contract

→ [`.specs/features/json-contract/spec.md`](../features/json-contract/spec.md)  
**Slug:** `json-contract` | **Priority:** High | **Specs:** Done

- [x] Publish JSON Schema for `ScanResult` and `CompareResult` (`schemas/scan-result.json`, `schemas/compare-result.json`)
- [x] Strong validation in `loadBaseline()` (`src/compare/load-baseline.ts`) — reject malformed JSON with clear error
- [x] Contract tests: CLI `--format json` output and compare match schema
- [x] Schemas require M14 `hasStaticDependency` on coupling items

### Milestone 21 — Config File

→ [`.specs/features/config-file/spec.md`](../features/config-file/spec.md)  
**Slug:** `config-file` | **Priority:** High | **Specs:** Done

- [x] Support **only** `.hotspot-scanner.json` (not `.hotspotrc`, not dual lookup) with keys: `since`, `include`, `exclude`, `granularity`, `minCochange`, `top`
- [x] Precedence: CLI flags > config file > defaults
- [x] Document in README and ARCHITECTURE

### Milestone 22 — Function AST Coverage — DONE

→ [`.specs/features/function-ast-coverage/spec.md`](../features/function-ast-coverage/spec.md)  
**Slug:** `function-ast-coverage` | **Priority:** Medium | **Specs:** Done

Extended `collectFunctionsInScope` / `resolveFunctionName` for getters, setters, class field arrows, and object-literal methods; McCabe decision-node definition unchanged; naming and fixtures locked per [function-ast-coverage/context.md](../features/function-ast-coverage/context.md).

- [x] Extend `src/complexity/analyze-file.ts` for getters/setters, class field arrows, object-literal methods
- [x] McCabe fixtures per construct; do not change existing decision-node definition

### Milestone 23 — Per-Function Git Churn — DONE

→ [`.specs/features/per-function-churn/spec.md`](../features/per-function-churn/spec.md)  
**Slug:** `per-function-churn` | **Priority:** Medium | **Specs:** Done

Hunk-overlap attribution on `git log` patch stream (`--unified=0`) in `--granularity function` only; replaces M11 inherited file churn. Locked decisions: [per-function-churn/context.md](../features/per-function-churn/context.md). Out of scope: historical AST per commit. IDs: HOTSPOT-181–193.

- [x] Emit `endLine` on `FunctionComplexityResult`; function-mode hunk-overlap miner under `src/git/function-churn/`
- [x] `scoreFunctionHotspots` uses per-function churn map (stop inheriting `FileChangeStats`); wire in `runScan` function branch only
- [x] Living docs (ARCHITECTURE / CONCERNS / TESTING) + `pnpm build && pnpm test`

### Milestone 24 — Package DX — DONE

→ [`.specs/features/package-dx/spec.md`](../features/package-dx/spec.md)  
**Slug:** `package-dx` | **Priority:** Medium | **Specs:** Done

Publish-prep + contributor DX only (no `npm publish`, no CI, no `dev` script). Locked decisions: [package-dx/context.md](../features/package-dx/context.md). Scope B: `files` allowlist **includes `schemas/`** (closes M20 json-contract thread). IDs: HOTSPOT-194–202. Project gate remains `pnpm build && pnpm test`.

- [x] Scripts: `typecheck`, `lint`, `format` + `format:check` (Prettier; ESLint flat config)
- [x] `package.json`: `engines.node >= 22`, `repository`, `files` including `dist/`, `schemas/`, LICENSE, README
- [x] Document typecheck/lint/format in CONTRIBUTING alongside gate; keep “no CI in v1”; sync STACK/CONVENTIONS

### Suggested execution order (historical — M14–M24)

M14 → M19 → M20 → M21 → M22 → M23 → M24

---

## Post-M24 backlog

Stubs only — no `.specs/features/<slug>/` until promoted via `planner-feature`. M12 (CI fail-on-score) remains intentionally absent (see STATE.md).

### Milestone 25 — Product docs sync

**Slug:** `product-docs-sync` | **Priority:** High | **Specs:** Pending

Align living product docs with shipped M19–M24 reality.

- [ ] Sync [PROJECT.md](PROJECT.md) (shipped through M24; remove stale “M20–M22 planned” backlog)
- [ ] Fix remaining rename/`--follow` drift in README / ARCHITECTURE Key constraints if still present
- [ ] Confirm ROADMAP header and STATE Active match delivered + backlog stubs

### Milestone 26 — Rename confidence (RT-003)

**Slug:** `rename-confidence` | **Priority:** High | **Specs:** Pending

Improve trust of file- and function-mode rankings after renames/moves.

- [ ] Stronger fixtures and warnings for ambiguous / incomplete rename history (file miner)
- [ ] Document and tighten function-mode post-rename hunk vs current `[line, endLine]` imprecision
- [ ] Surface actionable confidence / warning UX for rename blind spots (copy-paste, pre-`--since`)

### Milestone 27 — Coupling enrichment

**Slug:** `coupling-enrichment` | **Priority:** High | **Specs:** Pending

Richer `hasStaticDependency` signal for monorepos and refactor triage.

- [ ] Resolve tsconfig `paths` (and related aliases) when flagging static edges
- [ ] Direction of dependency (A→B / B→A / both)
- [ ] Distinguish `import type` vs runtime edges; handle re-exports explicitly

### Milestone 28 — Performance & diagnostics UX

**Slug:** `perf-diagnostics-ux` | **Priority:** Medium | **Specs:** Pending

Operator control and clearer scan feedback on large repos.

- [ ] CLI `--concurrency` (complexity worker pool; document default)
- [ ] Progress reporting in function mode (patch-stream phase)
- [ ] Consolidate warning UX / `meta.warnings` severity and interpretation docs

### Milestone 29 — Function AST coverage+

**Slug:** `function-ast-coverage-plus` | **Priority:** Medium | **Specs:** Pending

Extend function collection beyond M22 without changing McCabe decision nodes.

- [ ] Additional constructs (e.g. constructors, overloads — exact set locked in planner)
- [ ] Naming table + McCabe fixtures per construct; no decision-node drift (RT-005)

### Milestone 30 — Path & config DX

**Slug:** `path-config-dx` | **Priority:** Medium | **Specs:** Pending

Better defaults and config discovery for real monorepos.

- [ ] Extra default excludes (e.g. `.next`, `out`, `vendor`, `storybook-static`, `__snapshots__` — exact set locked in planner)
- [ ] Config parent-directory walk and/or `--config <path>` (preserve CLI > config > defaults)

### Suggested execution order (M25–M30)

M25 → M26 → M27 → M28 → M30 → M29
