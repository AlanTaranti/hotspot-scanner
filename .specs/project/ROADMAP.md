# ROADMAP — @vitals/hotspot-scanner

Status: **M7–M72 Done**; **M73–M74 Specs Planned**. Deferred horizon in [STATE.md](STATE.md) (npm publish, CI recipes/SARIF, historical AST do-not-prioritize).

**M12** intentionally absent (CI fail-on-score removed — see STATE).

### Done summary (historical detail below)

| Band | Scope |
| ---- | ----- |
| M1–M6 | v1 scaffold → git miner → complexity → scoring → reporter/CLI → integration |
| M7–M24 | Path scope, harmonic score, rich/export formats, function granularity, compare, coupling, workers, CSV bundle, JSON contract, config, function AST/churn, package DX |
| M25–M36 | Product docs, rename confidence, coupling enrichment, diagnostics, AST+, path/config DX, scan performance (workers, stream aggregate, enrich cache, overlap, function I/O, discovery) |
| M37–M45 | README adoption, CLI polish, init/doctor/dry-run, workflows, interpretation UX, explain, monorepo remount, package exports enrich, adoption docs |
| M46–M55 | Exclude tests by default, git pathspecs, scope extensions, ranking accuracy+, observability, doctor scope parity, perf controls, API trust docs, compare interpretation, CLI adoption extras |
| M56–M65 | Remove coupling; NCLOC metric (retire McCabe/function mode); CLI `--warnings summary|full|json` stderr aggregation; ephemeral TTY scan progress; table path column UX; inline progress bar; feedback/copy UX; CLI surface parity; config/doctor DX; git error UX |
| M66–M72 | DX batch: contract enrich, scope+, warnings bookend, write confirm, table Lines parity; **remove compare/baseline (scan-only)**; complexity trend CLI |

### Open

| Milestone | Slug | Specs |
| --------- | ---- | ----- |
| **M73** | `top-only-rollups` | [Planned](../features/top-only-rollups/tasks.md) — Warnings/Timing rollups only in exec summary; drop stderr teaser + brief timing |
| **M74** | `doctor-color-ux` | [Planned](../features/doctor-color-ux/tasks.md) — ANSI color for doctor text status prefixes (`pass`/`warn`/`fail`); M41 gates |

### Done

M7–M72 historical detail below. M73–M74 Specs Planned under Open. Deferred horizon in [STATE.md](STATE.md).

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

Specs and Execute for M25–M30 are **Done** (2026-07-23). M12 (CI fail-on-score) remains intentionally absent (see STATE.md).

### Milestone 25 — Product docs sync — DONE

→ [`.specs/features/product-docs-sync/spec.md`](../features/product-docs-sync/spec.md)  
**Slug:** `product-docs-sync` | **Priority:** High | **Specs:** Done

Align living product docs with shipped M19–M24 reality.

- [x] Sync [PROJECT.md](PROJECT.md) (shipped through M24; remove stale “M20–M22 planned” backlog)
- [x] Fix remaining rename/`--follow` drift in README / ARCHITECTURE Key constraints if still present
- [x] Confirm ROADMAP header and STATE Active match delivered + backlog stubs

### Milestone 26 — Rename confidence (RT-003) — DONE

→ [`.specs/features/rename-confidence/spec.md`](../features/rename-confidence/spec.md)  
**Slug:** `rename-confidence` | **Priority:** High | **Specs:** Done

Improve trust of file- and function-mode rankings after renames/moves. Ordered scope (avisos only — no historical AST). Tracked gaps: [CONCERNS.md](../codebase/CONCERNS.md) (Git miner rename blind spots + function churn pós-rename).

- [x] **Rename blind spots** — actionable warnings when history may be incomplete (copy-paste, pre-`--since`, no `old => new`); stronger file-miner fixtures
- [x] **Function-mode pós-rename (avisos)** — document + emit warning/confidence when hunk overlap uses current `[line, endLine]` vs historical hunks / mis-attribution after moves (**do not** invent historical AST)

**Boundary:** M26 owns RT-003 / function-rename warnings. M28 keeps generic `--concurrency` / progress / warning-severity consolidation (do not duplicate RT-003 scope here). Paths/`exports` enrichment stays **M27**.

### Milestone 27 — Coupling enrichment — DONE

→ [`.specs/features/coupling-enrichment/spec.md`](../features/coupling-enrichment/spec.md)  
**Slug:** `coupling-enrichment` | **Priority:** High | **Specs:** Done | **Execute:** Done

Richer `hasStaticDependency` signal for monorepos and refactor triage.

- [x] Resolve tsconfig `paths` (and related aliases) when flagging static edges
- [x] Direction of dependency (A→B / B→A / both)
- [x] Distinguish `import type` vs runtime edges; handle re-exports explicitly

### Milestone 28 — Performance & diagnostics UX — DONE

→ [`.specs/features/perf-diagnostics-ux/spec.md`](../features/perf-diagnostics-ux/spec.md)  
**Slug:** `perf-diagnostics-ux` | **Priority:** Medium | **Specs:** Done

Operator control and clearer scan feedback on large repos.

- [x] CLI `--concurrency` (complexity worker pool; document default)
- [x] Progress reporting in function mode (patch-stream phase)
- [x] Consolidate warning UX / `meta.warnings` severity and interpretation docs

### Milestone 29 — Function AST coverage+

→ [`.specs/features/function-ast-coverage-plus/spec.md`](../features/function-ast-coverage-plus/spec.md)  
**Slug:** `function-ast-coverage-plus` | **Priority:** Medium | **Specs:** Done | **Execute:** Done

Extend function collection beyond M22 without changing McCabe decision nodes. Locked constructs: [function-ast-coverage-plus/context.md](../features/function-ast-coverage-plus/context.md).

- [x] Additional constructs (ClassExpression members, object-literal get/set, assignment RHS callables, skip body-less overload stubs — not constructors/namespaces as “new”)
- [x] Naming table + McCabe fixtures per construct; no decision-node drift (RT-005)

### Milestone 30 — Path & config DX

→ [`.specs/features/path-config-dx/spec.md`](../features/path-config-dx/spec.md)  
**Slug:** `path-config-dx` | **Priority:** Medium | **Specs:** Done | **Execute:** Done

Better defaults and config discovery for real monorepos. Locked decisions: [path-config-dx/context.md](../features/path-config-dx/context.md).

- [x] Extra default excludes (`.next`, `out`, `vendor`, `storybook-static`, `__snapshots__`)
- [x] Config parent-directory walk and `--config <path>` (preserve CLI > config > defaults)

### Suggested execution order (M27–M30)

M27 → M28 → M30 → M29

---

## Post-M30 backlog — scan performance

RT-001 follow-ups: high- and medium-impact wall-time / memory wins identified after M15/M28. Specs and Execute **Done** (2026-07-23). Rankings / formulas / JSON contract unchanged except documented `MEGA_COMMIT_SKIPPED` warning. No historical AST. Gate remains `pnpm build && pnpm test`; timing stays manual (`scripts/benchmark-scan.md`).

### Milestone 31 — Persistent AST workers — DONE

→ [`.specs/features/persistent-ast-workers/spec.md`](../features/persistent-ast-workers/spec.md)  
**Slug:** `persistent-ast-workers` | **Priority:** High | **Specs:** Done | **Execute:** Done

Reduce worker spawn and ts-morph cold-start cost on large file trees. IDs: HOTSPOT-300–313.

- [x] Persistent worker pool (N live workers + batch queue) instead of `new Worker()` per batch — `src/complexity/pool.ts`
- [x] Reuse ts-morph `Project` across batches in the worker — `src/complexity/project.ts` / `analyze-batch.ts`
- [x] Cheaper syntactic diagnostics path (`getSyntacticDiagnostics` / `getProgram()` per file) without changing McCabe decision nodes (RT-005)
- [x] Keep `concurrency === 1` / single-batch inline fallback; `--concurrency` semantics unchanged
- [x] After Execute: update `scripts/benchmark-scan.md`, CONCERNS, ARCHITECTURE

### Milestone 32 — Coupling stream aggregation — DONE

→ [`.specs/features/coupling-stream-aggregate/spec.md`](../features/coupling-stream-aggregate/spec.md)  
**Slug:** `coupling-stream-aggregate` | **Priority:** High | **Specs:** Done

Lower memory and avoid a second full pass over co-change events on large histories. IDs: HOTSPOT-320–334.

- [x] Aggregate `pair → coChangeCount` during the numstat stream (avoid retaining full `coChangeEvents[]`) — `src/git/aggregate.ts` + `src/scoring/coupling-scorer.ts`
- [x] Preserve ranking / `couplingStrength` for commits below the mega-commit guard
- [x] Guard commits with too many unique in-scope files (skip + `MEGA_COMMIT_SKIPPED` `ScanWarning` at threshold 100); document in CONCERNS
- [x] Path scope filters before/during aggregation (`isPathInScope` callback into miner)

### Milestone 33 — Static enrich graph cache — DONE

→ [`.specs/features/static-enrich-cache/spec.md`](../features/static-enrich-cache/spec.md)  
**Slug:** `static-enrich-cache` | **Priority:** High | **Specs:** Done

Eliminate repeated source reads/regex when labeling coupling pairs. IDs: HOTSPOT-340–348, 351.

- [x] One read/parse per file in enrich; cache resolved edges; O(1) pair lookup — `src/scoring/enrich-coupling-static.ts`
- [x] No ranking change; same `hasStaticDependency` / direction / kind fields
- [x] `package.json` `exports`/`imports` remain deferred (CONCERNS)

### Milestone 34 — Pipeline stage overlap — DONE

→ [`.specs/features/pipeline-stage-overlap/spec.md`](../features/pipeline-stage-overlap/spec.md)  
**Slug:** `pipeline-stage-overlap` | **Priority:** High | **Specs:** Done

Overlap I/O-bound git mining with CPU-bound complexity analysis. IDs: HOTSPOT-360–379.

- [x] Overlap git miner and complexity in `src/scan.ts` with coherent cancel/error handling
- [x] File mode: coupling/scoring only after both complete; function mode: function-churn after complexity (needs ranges)
- [x] Document peak-memory trade-off; progress phases unchanged or carefully extended
- [x] Boundary: do **not** parallelize function-churn with numstat in this milestone (rename/alias complexity)

### Milestone 35 — Function-mode scan efficiency — DONE

→ [`.specs/features/function-mode-scan-efficiency/spec.md`](../features/function-mode-scan-efficiency/spec.md)  
**Slug:** `function-mode-scan-efficiency` | **Priority:** High | **Specs:** Done

Cut function-mode wall time (patch stream + AST + hunk overlap). IDs: HOTSPOT-380–399.

- [x] Restrict patch stream (pathspec / only paths with churn or functions) — `src/git/function-churn/`
- [x] In function mode, limit AST to relevant files (churn ∩ scope) without worsening expected rankings
- [x] Interval index for function×hunk overlap (sort/sweep) — `src/git/function-churn/aggregate.ts`
- [x] File mode: zero patch spawn (regression test)

### Milestone 36 — Discovery & concurrency defaults

→ [`.specs/features/discovery-concurrency-defaults/spec.md`](../features/discovery-concurrency-defaults/spec.md)  
**Slug:** `discovery-concurrency-defaults` | **Priority:** Medium | **Specs:** Done | **Execute:** Done

Faster source discovery and better out-of-box concurrency on multi-core machines. IDs: HOTSPOT-400–413.

- [x] Prefer `git ls-files` + `PathScope` filter for discovery, with filesystem walk fallback — `src/complexity/discover.ts`
- [x] Revisit `DEFAULT_WORKER_CONCURRENCY` (`min(availableParallelism(), 8)`); document memory vs `--concurrency`
- [x] Update README / M28 docs / benchmark notes

### Suggested execution order (M31–M36)

M31 → M32 → M33 → M35 → M34 → M36

Workers and coupling/enrich first (isolated wins); function-mode I/O next; stage overlap later among the highs (more fragile); discovery/defaults last (polish).

---

## Post-M36 backlog — adoption / distribution

### Milestone 37 — README Adoption DX — DONE

→ [`.specs/features/readme-adoption-dx/spec.md`](../features/readme-adoption-dx/spec.md)  
**Slug:** `readme-adoption-dx` | **Priority:** High | **Specs:** Done | **Execute:** Done  
**IDs:** HOTSPOT-420–440 | **Sister:** [product-docs-sync](../features/product-docs-sync/spec.md) (M25)

Improve GitHub-facing adoption DX without npm publish. Official install remains `git clone` + `pnpm install` + `pnpm build` using the real GitHub URL. **npm / npx / publish install path is future backlog (not M37).**

- [x] Fix duplicate Markdown fence; restore rendering of following sections
- [x] Opening: problem → solution; package vs bin naming; TOC; badges (no npm version)
- [x] Sample CLI table + real `docs/assets/` screenshot from fixture `small-ts` in first ~60 lines
- [x] Short top + Advanced detail; slim How it works; workflows; privacy; Limitations
- [x] Remove user-facing M26/M28/M32/RT-003 jargon and “v1” framing; keep stable warning `code`s
- [x] Real clone URL; CONTRIBUTING pointer/dedupe; expand `package.json` keywords (no publish)

---

## Post-M37 backlog — user DX

CLI ergonomics, interpretation UX, monorepo heuristics, coupling `exports`/`imports`, and adoption docs. **No npm publish.** **M38–M45 Execute complete.**

### Milestone 38 — CLI Surface Polish

→ [`.specs/features/cli-surface-polish/spec.md`](../features/cli-surface-polish/spec.md)  
**Slug:** `cli-surface-polish` | **Priority:** High | **Specs:** Done  
**IDs:** HOTSPOT-450–461 (range 450–469; 462–469 reserved) | **Items:** 5, 6, 8, 9, 10, 11  
**Artifacts:** [spec.md](../features/cli-surface-polish/spec.md), [context.md](../features/cli-surface-polish/context.md), [design.md](../features/cli-surface-polish/design.md), [tasks.md](../features/cli-surface-polish/tasks.md) (`Status: Done`)

Default scan path, `--version`, `--quiet` / `--no-progress`, guided errors, help examples, short aliases. **`--verbose` omitted** (not useful beyond default diagnostics — see context.md).

- [x] Default `scan` path = `.` when argument omitted (still validate `.git`)
- [x] `--version` / `-V` from `package.json`
- [x] `--quiet` (suppress progress + `info`; keep report + warning/error) and `--no-progress`
- [x] Common errors with next-step hints (non-git, csv without `--output`, baseline, missing `--config`)
- [x] Examples in `scan --help`
- [x] Short aliases: `-f` format, `-o` output, `-t` top, `-g` granularity (long flags remain)

### Milestone 39 — CLI Init / Doctor / Dry-run

→ [`.specs/features/cli-init-doctor-dry-run/spec.md`](../features/cli-init-doctor-dry-run/spec.md) — **DONE**  
**Slug:** `cli-init-doctor-dry-run` | **Priority:** High | **Specs:** Done  
**IDs:** HOTSPOT-470–489 | **Items:** 3, 4, 26  
**Depth:** Large | **Sisters:** config-file (M21), path-config-dx (M30), path-scoping (M7)  
**Artifacts:** [context.md](../features/cli-init-doctor-dry-run/context.md) · [spec.md](../features/cli-init-doctor-dry-run/spec.md) · [design.md](../features/cli-init-doctor-dry-run/design.md) · [tasks.md](../features/cli-init-doctor-dry-run/tasks.md) (Status: **Done**)

`init` / `doctor` / `scan --dry-run` for adoption DX. Domain in `src/config/` (exemplar), `src/doctor/`, `src/scan-preview.ts`; bin wires only. **Out of scope:** M38 polish aliases, M40 workflow subcommands, PathScope default changes, npm publish.

**Locked (context.md):** Doctor hard-fail = Node engines / git PATH / non-repo / invalid config (`1` or `2`); soft = missing config + missing tsconfig/jsconfig (exit `0`). Init writes `<cwd|dir>/.hotspot-scanner.json`, no overwrite without `--force`; exemplar omits `concurrency`. Dry-run = text preview (since/include/exclude/count/concurrency); no mine/AST/scoring; reject `--baseline`.

- [x] `hotspot-scanner init [dir]` writes exemplar `.hotspot-scanner.json` (no overwrite without `--force`)
- [x] `hotspot-scanner doctor [path]` — Node engines, git on PATH, git repo, config discovery/validity, tsconfig/jsconfig info (exit policy locked)
- [x] `scan --dry-run` scope preview (effective since/include/exclude, eligible file count, concurrency) without mine/AST/scoring

### Milestone 40 — Workflow Subcommands — DONE

→ [`.specs/features/workflow-subcommands/spec.md`](../features/workflow-subcommands/spec.md) — **DONE**
**Slug:** `workflow-subcommands` | **Priority:** Medium | **Specs:** Done
**IDs:** HOTSPOT-490–509 | **Items:** 7
**Artifacts:** [context.md](../features/workflow-subcommands/context.md) · [design.md](../features/workflow-subcommands/design.md) · [tasks.md](../features/workflow-subcommands/tasks.md) (Status: **Done**)

Explicit save/compare verbs wrapping existing scan/compare JSON flows. Domain stays in `src/`; bin wires via `bin/scan-actions.ts`. **No** fail-on thresholds, CI action packaging, or CompareResult schema changes.

- [x] `hotspot-scanner baseline save <repoPath>` — `runScan` + ScanResult JSON; `--output` or default `./hotspot-baseline.json`
- [x] `hotspot-scanner compare <repoPath> --baseline <file>` — thin wrapper; same path as `scan --baseline`
- [x] Keep `scan --baseline` working (no removal); JSON files only (no DB)

### Milestone 41 — Output Interpretation UX — DONE

→ [`.specs/features/output-interpretation-ux/spec.md`](../features/output-interpretation-ux/spec.md)  
**Slug:** `output-interpretation-ux` | **Priority:** High | **Specs:** Done  
**IDs:** HOTSPOT-510–539 | **Items:** 13, 14, 15, 16, 17, 19  
**Artifacts:** [context.md](../features/output-interpretation-ux/context.md) · [design.md](../features/output-interpretation-ux/design.md) · [tasks.md](../features/output-interpretation-ux/tasks.md) (Status: Done)

Human interpretation UX for table/markdown (reporter + CLI only). No scoring/formula/schema changes. Locked decisions in context.md.

- [x] Table glossary footer (stdout/file after tables); markdown `## How to read this` (shared SoT)
- [x] Executive summary at top of table + markdown (scan + compare; shown vs total; coupling + static-dep-false counts)
- [x] Conservative triage hints — 3 deterministic rules; default ON for scan table/markdown; `--no-triage-hints`; no compare hints; no ML; rankings/JSON scores unchanged
- [x] Repeatable `--only hotspots|coupling|functions`; invalid → `CliUsageError`; omit excluded sections (JSON keys / CSV files); filtered JSON not a baseline
- [x] TTY-aware table colors only; honor `--no-color`, `NO_COLOR`, non-TTY, `--output`; no new color dependency; no markdown/JSON/CSV color

### Milestone 42 — Explain & Scan Feedback

→ [`.specs/features/explain-and-scan-feedback/spec.md`](../features/explain-and-scan-feedback/spec.md)  
**Slug:** `explain-and-scan-feedback` | **Priority:** High | **Specs:** Done  
**IDs:** HOTSPOT-540–569 | **Items:** 18, 25, 27  
**Artifacts:** [context.md](../features/explain-and-scan-feedback/context.md) · [design.md](../features/explain-and-scan-feedback/design.md) · [tasks.md](../features/explain-and-scan-feedback/tasks.md) (`Status: Done`)  
**Sister:** M38 `--no-progress` (honor via shared `onProgress`; implementable independently — default progress on)

Full scan always, then explain block on **stderr**. Grammar: `<path>` | `<path>:<functionName>` (see context). Lookup uses full `ScanResult` arrays (ignores `--top` truncation). Rename: append next-step text only — **no** new/changed warning `code`s. Progress: `phase: "complexity"` with file/batch counters.

- [x] `--explain <target>` breakdown after full scan (raw + normalized c/h + harmonic score; not-found message; file vs `path:function` grammar)
- [x] Actionable next-steps on rename warnings (stable M26/M28 codes — `RENAME_HISTORY_INCOMPLETE` / `EMPTY_SINCE_WINDOW`)
- [x] Complexity-phase progress via `onProgress` (`phase: "complexity"`; beyond git / function-churn)

### Milestone 43 — Monorepo Path Detect — DONE

→ [`.specs/features/monorepo-path-detect/spec.md`](../features/monorepo-path-detect/spec.md)  
**Slug:** `monorepo-path-detect` | **Priority:** Medium | **Specs:** Done  
**IDs:** HOTSPOT-570–589 | **Items:** 12 | **Sisters:** path-scoping (M7), path-config-dx (M30)  
**Artifacts:** [context.md](../features/monorepo-path-detect/context.md) · [design.md](../features/monorepo-path-detect/design.md) · [tasks.md](../features/monorepo-path-detect/tasks.md) (`Status: Done`)

When scan path is a subdirectory of a git workspace (e.g. `packages/api`): remount pipeline `repoPath` to `git rev-parse --show-toplevel`; auto-apply `--include {prefix}/**` unless CLI `--include` was passed. Config discovery stays on the original request path (M30). Git-root paths unchanged. YAGNI: no workspace-yaml / nx parsers. See [context.md](../features/monorepo-path-detect/context.md).

- [x] Remount nested scan path to git root (`rev-parse --show-toplevel`); validate `.git` on root
- [x] Auto-include `{packagePrefix}/**` unless CLI `--include`; beats config `include`; `MONOREPO_PATH_REMOUNT` info warning
- [x] Config walk / `--config` from original request path; CLI > config > defaults unchanged; git-root scans unchanged
- [x] Document heuristic (README + ARCHITECTURE); no pnpm-workspace / nx special cases

### Milestone 44 — Coupling Package Exports — DONE

→ [`.specs/features/coupling-package-exports/spec.md`](../features/coupling-package-exports/spec.md) — **DONE**  
**Slug:** `coupling-package-exports` | **Priority:** High | **Specs:** Done  
**IDs:** HOTSPOT-590–619 | **Items:** 24 | **Depth:** Complex | **Sister:** coupling-enrichment (M27), static-enrich-cache (M33)  
**Artifacts:** [context.md](../features/coupling-package-exports/context.md) · [design.md](../features/coupling-package-exports/design.md) · [tasks.md](../features/coupling-package-exports/tasks.md) (Status: **Done**)

- [x] Resolve in-repo `package.json` `exports` / `imports` when labeling static coupling edges (close CONCERNS gap)
- [x] Ranking (`couplingStrength`, order) unchanged; existing static fields only — improve true-positive rate
- [x] Keep M33 peer-scoped graph cache; extend resolution caches (no per-pair source re-read)
- [x] Contract regression + fixtures for exports/imports; no JSON version bump / no `node_modules` full resolve
- [x] No PathAliasMap rewrite / no historical AST; Execute removes CONCERNS unmitigated `exports`/`imports` row

### Milestone 45 — Adoption Docs & Package Exports Map

→ [`.specs/features/adoption-docs-package-exports/spec.md`](../features/adoption-docs-package-exports/spec.md)  
**Slug:** `adoption-docs-package-exports` | **Priority:** Medium | **Specs:** Done  
**IDs:** HOTSPOT-620–639 | **Items:** 29, 30, 31, 32 | **Sister:** readme-adoption-dx (M37)  
**Artifacts:** `spec.md`, `context.md`, `design.md` (thin), `tasks.md` (**Status: Done**)

- [x] `docs/recipes.md` — weekly triage, PR markdown, monorepo config, baseline/compare
- [x] Sync README sample tables (Quick start + Output formats → Table) with real `small-ts` CLI output; refresh PNG if stale
- [x] `docs/warning-codes.md` cheatsheet + README link (stable codes only; no new codes)
- [x] `package.json` `"exports"` map for public entry (`./dist/index.js` + types); keep `main`/`types`/`bin` — **no npm publish**

### Suggested execution order (M38–M45)

M38 → M45 → M39 → M41 → M42 → M40 → M43 → M44

---

## Post-M45 backlog — path-scope defaults

### Milestone 46 — Exclude Tests by Default

→ [`.specs/features/exclude-tests-by-default/spec.md`](../features/exclude-tests-by-default/spec.md)  
**Slug:** `exclude-tests-by-default` | **Priority:** High | **Specs:** Done  
**IDs:** HOTSPOT-640–657 (658–659 reserved) | **Depth:** Large  
**Sisters:** path-scoping (M7), path-config-dx (M30), cli-init-doctor-dry-run (M39 dry-run)  
**Artifacts:** [context.md](../features/exclude-tests-by-default/context.md) · [spec.md](../features/exclude-tests-by-default/spec.md) · [design.md](../features/exclude-tests-by-default/design.md) · [tasks.md](../features/exclude-tests-by-default/tasks.md) (`Status: Done`)

Intentional breaking default: test globs / `__tests__/**` excluded from PathScope (git + complexity + eligible counts). Opt-in `--include-tests` (CLI/API only — no config key) lifts **only** built-in test patterns; artifact defaults and user `--exclude` stay. JSON contract unchanged.

- [x] Split `DEFAULT_EXCLUDE_PATTERNS` → artifact + test constants; `createPathScope({ includeTests? })`
- [x] Wire `ScanOptions.includeTests` through `runScan`, `previewScanScope` (dry-run line), `scan` / `baseline save` / `compare`
- [x] Docs: ARCHITECTURE, README, `docs/recipes.md` (drop redundant `--exclude "**/*.test.ts"`); STATE decision log
- [x] Unit/CLI tests on scope + preview + flag forward; no new fixture repo; gate `pnpm build && pnpm test`

---

## Post-M46 backlog — scale, accuracy, observability, DX (historical — all Done)

Depth A thematic milestones **M46–M55** — Execute complete; **no open milestones**.

**Rejected (not a milestone):** `format` / `output` in `.hotspot-scanner.json` — M21 CLI-only lock (see STATE).  
**Deferred (no milestone):** Historical AST post-rename — do not prioritize (CONCERNS / STATE).

### Suggested execution order (M46–M55) — completed

M46 → M47 → M52 → M48 → M50 → M51 → M49 → M55 → M53 → M54

### Milestone 47 — Git Scale Pathspecs

→ [`.specs/features/git-scale-pathspecs/spec.md`](../features/git-scale-pathspecs/spec.md)
**Slug:** `git-scale-pathspecs` | **Priority:** High | **Specs:** Done
**IDs:** HOTSPOT-660–689 (687–689 reserved) | **Depth:** Large
**Sisters:** function-mode-scan-efficiency (M35), coupling-stream-aggregate (M32), cli-init-doctor-dry-run (M39 dry-run)
**Artifacts:** [context.md](../features/git-scale-pathspecs/context.md) · [spec.md](../features/git-scale-pathspecs/spec.md) · [design.md](../features/git-scale-pathspecs/design.md) · [tasks.md](../features/git-scale-pathspecs/tasks.md) (`Status: Done`)

Replace M35 count-based unrestricted patch fallback with sequential pathspec batches (patch stream only; numstat unchanged). Configurable mega-commit threshold (default 100, skip+warn unchanged). Dry-run warns when eligible files > 1000.

- [x] Batch git pathspecs when allowlist > `PATCH_PATHSPEC_FALLBACK_THRESHOLD` (1000); avoid unrestricted fallback except documented emergency path
- [x] Configurable mega-commit unique-file threshold (CLI + optional config key; default 100); document over-threshold policy
- [x] Dry-run / `previewScanScope` warns when eligible path count exceeds pathspec threshold

### Milestone 48 — Scope Extensions & Artifact Excludes

→ [`.specs/features/scope-extensions-excludes/spec.md`](../features/scope-extensions-excludes/spec.md)
**Slug:** `scope-extensions-excludes` | **Priority:** Medium | **Specs:** Done
**IDs:** HOTSPOT-690–709 (701–709 reserved) | **Depth:** Small
**Sisters:** path-scoping (M7), path-config-dx (M30), exclude-tests-by-default (M46)
**Artifacts:** [context.md](../features/scope-extensions-excludes/context.md) · [spec.md](../features/scope-extensions-excludes/spec.md) · [design.md](../features/scope-extensions-excludes/design.md) · [tasks.md](../features/scope-extensions-excludes/tasks.md) (`Status: Done`)

Add `.mjs`/`.cjs` to eligible sources; expand artifact default excludes with full M30 YAGNI-cut set. **Do not** change M46 test globs. Prefer Execute after M46.

- [x] Add `.mjs` / `.cjs` to eligible source extensions (discovery, complexity, git intersection, enrich SoT)
- [x] Expand default artifact excludes (`.turbo`, `.vercel`, `.cache`, `.nuxt`, `.output`, `.parcel-cache`, `tmp`)

### Milestone 49 — Pipeline Perf Controls — DONE

→ [`.specs/features/pipeline-perf-controls/spec.md`](../features/pipeline-perf-controls/spec.md)  
**Slug:** `pipeline-perf-controls` | **Priority:** Medium | **Specs:** Done  
**IDs:** HOTSPOT-710–729 | **Depth:** Medium  
**Sisters:** pipeline-stage-overlap (M34), ast-parallelization (M15), scripts/benchmark-scan.md; note M51 excludes bench harness  

**Artifacts:** [context.md](../features/pipeline-perf-controls/context.md) · [spec.md](../features/pipeline-perf-controls/spec.md) · [design.md](../features/pipeline-perf-controls/design.md) · [tasks.md](../features/pipeline-perf-controls/tasks.md) (`Status: Done`)

- [x] `--sequential` (primary) / `--no-overlap` (alias) disables M34 file-mode git∥complexity overlap; CLI-only `ScanOptions.sequential`
- [x] Automated benchmark harness (`pnpm bench`); wall-clock + counts; optional A/B vs sequential; **not** part of `pnpm test` gate / no CI timing thresholds

### Milestone 50 — Ranking Accuracy Plus — DONE

→ [`.specs/features/ranking-accuracy-plus/spec.md`](../features/ranking-accuracy-plus/spec.md)  
**Slug:** `ranking-accuracy-plus` | **Priority:** High | **Specs:** Done  
**IDs:** HOTSPOT-730–769 | **Depth:** Large  
**Sisters:** rename-confidence (M26), coupling-enrichment (M27), function-ast-coverage-plus (M29), function-mode-scan-efficiency (M35)

**Artifacts:** [context.md](../features/ranking-accuracy-plus/context.md) · [spec.md](../features/ranking-accuracy-plus/spec.md) · [design.md](../features/ranking-accuracy-plus/design.md) · [tasks.md](../features/ranking-accuracy-plus/tasks.md) (`Status: Done`)

- [x] Stronger unlinked-rename linking in git miner (RT-003; prefer stable warning `code`s)
- [x] Apply `PathAliasMap` in static coupling enrich (rename-aware peer paths)
- [x] Include `PARSE_FAILED` files in hotspot ranking (flagged; score 0)
- [x] Function AST: collect callbacks / IIFEs / related callables (extends M29; McCabe decision nodes unchanged — RT-005)
- [x] Function-mode: include zero-churn-file functions (intentional revisit of M35 D6)

### Milestone 51 — Scan Observability — DONE

→ [`.specs/features/scan-observability/spec.md`](../features/scan-observability/spec.md)  
**Slug:** `scan-observability` | **Priority:** High | **Specs:** Done  
**IDs:** HOTSPOT-770–799 | **Depth:** Large (schema + CLI + SIGINT + function-churn abort)  
**Sisters:** perf-diagnostics-ux (M28), pipeline-stage-overlap (M34 — SIGINT was out of scope), cli-surface-polish (M38 — general `--verbose` omitted), output-interpretation-ux (M41)  
**Artifacts:** [context.md](../features/scan-observability/context.md) · [spec.md](../features/scan-observability/spec.md) · [design.md](../features/scan-observability/design.md) · [tasks.md](../features/scan-observability/tasks.md) (`Status: Done`)

- [x] SIGINT/SIGTERM → shared `AbortController`; clean cancel; no zombie git children/workers (exit 130/143)
- [x] Additive `meta.timings` per pipeline stage under JSON `version: "1.0"`
- [x] Warning count/code summary in table + markdown executive summary (scan + compare)
- [x] `doctor --format json` (structured findings; text default)
- [x] `--verbose` scoped to git spawn argv trace only (narrow reopen of M38 omit; `--quiet` wins)

### Milestone 52 — Doctor Scope Parity — DONE

→ [`.specs/features/doctor-scope-parity/spec.md`](../features/doctor-scope-parity/spec.md)  
**Slug:** `doctor-scope-parity` | **Priority:** Medium | **Specs:** Done  
**IDs:** HOTSPOT-800–819 | **Depth:** Medium  
**Sisters:** cli-init-doctor-dry-run (M39), monorepo-path-detect (M43), exclude-tests-by-default (M46); note M51 `doctor --format json` (additive `scope` finding)

**Artifacts:** [context.md](../features/doctor-scope-parity/context.md) · [spec.md](../features/doctor-scope-parity/spec.md) · [design.md](../features/doctor-scope-parity/design.md) · [tasks.md](../features/doctor-scope-parity/tasks.md) (Status: **Done**)

Doctor remount + PathScope / eligible-count parity with dry-run and `runScan`. Shared `createScanPathScope` + `previewScanScope` for inventory. Forward-compat with M46 `includeTests`. **Out of scope:** doctor JSON (M51), PathScope default changes (M46), workspace yaml.

- [x] `runDoctor` uses `resolveScanPipelineContext` (M43 remount, M46 test-exclude defaults when applicable)
- [x] Doctor, dry-run, and `runScan` share one prelude chain (config merge, path scope, eligible-count semantics)
- [x] Doctor `scope` finding — eligible count matches `previewScanScope`
- [x] Optional doctor `--include-tests` when M46 Done

### Milestone 53 — Compare Interpretation

→ [`.specs/features/compare-interpretation/spec.md`](../features/compare-interpretation/spec.md)  
**Slug:** `compare-interpretation` | **Priority:** Medium | **Specs:** Done  
**IDs:** HOTSPOT-820–839 | **Depth:** Medium  
**Sisters:** output-interpretation-ux (M41), explain-and-scan-feedback (M42), scan-compare (M13)  
**Artifacts:** [context.md](../features/compare-interpretation/context.md) · [spec.md](../features/compare-interpretation/spec.md) · [design.md](../features/compare-interpretation/design.md) · [tasks.md](../features/compare-interpretation/tasks.md) (`Status: Done`)

- [x] Compare table/markdown triage hints (delta-aware; **intentional override** of M41 “no compare triage”)
- [x] `--explain` for compare targets (rank delta / new-removed on stderr)
- [x] `--strict` treats `COMPARE_SINCE_MISMATCH` as hard error (exit ≠ 0)

### Milestone 54 — CLI Adoption Extras — DONE

→ [`.specs/features/cli-adoption-extras/spec.md`](../features/cli-adoption-extras/spec.md)
**Slug:** `cli-adoption-extras` | **Priority:** Low | **Specs:** Done
**IDs:** HOTSPOT-840–859 | **Depth:** Small
**Sisters:** cli-surface-polish (M38), path-config-dx (M30)

**Artifacts:** [context.md](../features/cli-adoption-extras/context.md) · [spec.md](../features/cli-adoption-extras/spec.md) · [design.md](../features/cli-adoption-extras/design.md) · [tasks.md](../features/cli-adoption-extras/tasks.md) (`Status: Done`)

- [x] Shell completion (bash/zsh/fish) via static scripts + `completion <shell>` (no new deps)
- [x] Prefer recipes / config `exclude` over `.hotspotignore` — **Rejected** (documented; not implemented)

### Milestone 55 — API Trust Docs — DONE

→ [`.specs/features/api-trust-docs/spec.md`](../features/api-trust-docs/spec.md)  
**Slug:** `api-trust-docs` | **Priority:** Medium | **Specs:** Done  
**IDs:** HOTSPOT-860–882 (883–889 reserved) | **Depth:** Small  
**Sisters:** adoption-docs-package-exports (M45), config-file (M21), package-dx (M24); cross-link output-interpretation-ux (M41)  
**Artifacts:** [context.md](../features/api-trust-docs/context.md) · [spec.md](../features/api-trust-docs/spec.md) · [design.md](../features/api-trust-docs/design.md) · [tasks.md](../features/api-trust-docs/tasks.md) (`Status: Done`)

Export preview/doctor from package entry; warn-only unknown config keys; wire `merge-heavy` integration; trust docs (zero-network, `SECURITY.md`, baseline-in-artifacts, `--only` JSON ≠ baseline).

- [x] Export `previewScanScope`, `runDoctor` (+ types) from package entry
- [x] Warn on unknown config keys (warn-only; keep forward-compat)
- [x] Wire `tests/fixtures/repos/merge-heavy` into integration suite
- [x] Docs: README “zero network” callout; `SECURITY.md`; baseline-in-artifacts; `--only` filtered JSON ≠ baseline

---

## Milestone 56 — Remove coupling analysis — Done

→ [`.specs/features/remove-coupling-analysis/spec.md`](../features/remove-coupling-analysis/spec.md)  
**Slug:** `remove-coupling-analysis` | **Priority:** High | **Specs:** Done  
**IDs:** HOTSPOT-890+ (913–919 reserved) | **Depth:** Complex  
**Sisters / inverse:** enriched-coupling (M14), coupling-enrichment (M27), coupling-stream-aggregate (M32), static-enrich-cache (M33), coupling-package-exports (M44), csv-bundle (M18), json-contract (M20), scan-compare (M13), output-interpretation-ux (M41)

**Artifacts:** [context.md](../features/remove-coupling-analysis/context.md) · [spec.md](../features/remove-coupling-analysis/spec.md) · [design.md](../features/remove-coupling-analysis/design.md) · [tasks.md](../features/remove-coupling-analysis/tasks.md) (Status: **Done**)

Hard cut — completely removed temporal coupling analysis (co-change pairs, coupling scoring, static enrich) from pipeline, CLI/config, JSON (`version` → `"2.0"`, no `coupling` array), CSV (omit coupling files), tests, fixtures, and living docs. Historical Done coupling specs stay historical; M56 documents supersession. **Kept:** churn, hotspot scoring, PathAliasMap, complexity, compare for hotspots/functions, `--only hotspots|functions`.

- [x] JSON schemas + types `"2.0"` without top-level `coupling`; baseline reject `1.0` / leftover `coupling`
- [x] Pipeline / compare / reporters / CLI / config stop emitting or configuring coupling
- [x] Git miner: remove `pairCounts`, mega-commit coupling skip, `MEGA_COMMIT_SKIPPED`
- [x] Delete coupling-only modules, tests, and fixtures
- [x] Living docs / skills / PROJECT vision (hotspots = complexity + churn); revisit ADR-2026-020
- [x] Final gate `pnpm build && pnpm test`

**Out of scope:** McCabe nodes, harmonic formula, function churn, npm publish, CI/SARIF.

---

## Milestone 57 — NCLOC metric — Done

→ [`.specs/features/ncloc-metric/spec.md`](../features/ncloc-metric/spec.md)  
**Slug:** `ncloc-metric` | **Priority:** High | **Specs:** Done  
**IDs:** HOTSPOT-920+ (913–919 reserved from M56) | **Depth:** Complex  
**Sisters / inverse:** remove-coupling-analysis (M56 hard-cut exemplar), complexity-analyzer (M3), harmonic-hotspot-score (M8), rich-output (M9), function-granularity (M11), per-function-churn (M23), function-mode-scan-efficiency (M35), explain-and-scan-feedback (M42), ranking-accuracy-plus (M50), json-contract (M20), csv-bundle (M18)

**Artifacts:** [context.md](../features/ncloc-metric/context.md) · [spec.md](../features/ncloc-metric/spec.md) · [design.md](../features/ncloc-metric/design.md) · [tasks.md](../features/ncloc-metric/tasks.md) (Status: **Done**)

Product hard cut: replace McCabe cyclomatic complexity with **NCLOC** as axis `c` in `hotspotScore = 2ch/(c+h)` (log1p + min-max + harmonic unchanged); remove **function mode** end-to-end; bump JSON to **`"3.0"`** (`cyclomaticComplexity` → `ncloc`; no `functions` array); reject baselines `2.0` / legacy fields with re-scan `BaselineError`; revisit **ADR-2026-019**. Historical Done McCabe/function specs stay historical; M57 documents supersession.

- [x] NCLOC file analyzer (lighter scanner; drop ts-morph) + scoring feeds `ncloc` as `c`
- [x] JSON schemas + types `"3.0"` with `ncloc`; baseline reject `2.0` / `cyclomaticComplexity` / `functions`
- [x] Remove function mode (CLI/config `granularity`, function-churn miner, function scorers, CSV/compare/explain)
- [x] Reporters: NLOC columns; glossary / triage / `--explain` file-only
- [x] Living docs / skills / CONCERNS RT-005 / INTEGRATIONS; ADR-2026-019 supersession
- [x] Final gate `pnpm build && pnpm test`

**Out of scope:** npm publish, CI/SARIF, historical AST, reintroducing coupling, metrics beyond NCLOC.

---

## Milestone 58 — CLI Warnings Mode — Done

→ [`.specs/features/cli-warnings-mode/spec.md`](../features/cli-warnings-mode/spec.md)  
**Slug:** `cli-warnings-mode` | **Priority:** High | **Specs:** Done  
**IDs:** HOTSPOT-950–969 (963–969 reserved) | **Depth:** Large  
**Sisters:** cli-surface-polish (M38 quiet), scan-observability (M51 `--verbose` git-argv lock + exec warning summary), explain-and-scan-feedback (M42 next-step copy), rename-confidence (M26), adoption-docs (M45 warning-codes), cli-adoption-extras (M54 completion)  
**Artifacts:** [context.md](../features/cli-warnings-mode/context.md) · [spec.md](../features/cli-warnings-mode/spec.md) · [design.md](../features/cli-warnings-mode/design.md) · [tasks.md](../features/cli-warnings-mode/tasks.md) (Status: **Done**)

Intentional breaking **stderr** default: `--warnings summary|full` (default **`summary`**) collapses repeated same-code / rename sub-kind lines. **M68 bookend:** short rollup teaser immediately before report write, then full aggregated lines after write (see [warnings-bookend-dx](../features/warnings-bookend-dx/)). **`meta.warnings` and programmatic `onWarning` stay full** (no JSON contract change). Do **not** overload `--verbose` (M51). CLI-only — no config key (M38 quiet parity). File-mode git miner SoT post-M57; do not revive function-mode claims.

- [x] `--warnings summary|full` on `scan` / `compare` / `baseline save`; default `summary`; invalid → `CliUsageError` exit 2
- [x] CLI diagnostic sink aggregates stderr (`RENAME_HISTORY_INCOMPLETE` sub-kinds + other multi-code spam); `full` restores per-path/per-pair detail (unlinked may keep 5 + remainder)
- [x] `flushWarnings()` after scan/compare warning emission; quiet/verbose interaction documented
- [x] Help, completion, README, `docs/warning-codes.md`, recipes, ARCHITECTURE
- [x] Final gate `pnpm build && pnpm test`

**Out of scope:** config key; schema bump; expanding unlinked pairs in JSON beyond today’s formatter; executive-summary redesign; function-churn revival; fail-on-warning CI.

---

## Milestone 59 — Ephemeral TTY Scan Progress — Done

→ [`.specs/features/tty-ephemeral-progress/spec.md`](../features/tty-ephemeral-progress/spec.md)  
**Slug:** `tty-ephemeral-progress` | **Priority:** High | **Specs:** Done  
**IDs:** HOTSPOT-970–989 (981–989 reserved) | **Depth:** Large  
**Sisters:** perf-diagnostics-ux (M28), cli-surface-polish (M38 quiet/no-progress), explain-and-scan-feedback (M42 complexity progress format), cli-warnings-mode (M58)  
**Artifacts:** [context.md](../features/tty-ephemeral-progress/context.md) · [spec.md](../features/tty-ephemeral-progress/spec.md) · [design.md](../features/tty-ephemeral-progress/design.md) · [tasks.md](../features/tty-ephemeral-progress/tasks.md) (Status: **Done**)

While a scan runs on a TTY, stderr progress for `git` and `complexity` updates **one live line** (`\r` + clear-to-EOL; no bars/ETA/spinners) and **clears** on teardown, before diagnostic stderr lines, and on phase switch. Non-TTY/CI keeps `\n` lines. `--quiet` / `--no-progress` unchanged. Compose with M58: clear at `flushWarnings()` (summary) and before each `logWarning` (full). No new flags, config, or JSON/schema changes.

- [x] TTY live overwrite for `git` + `complexity`; non-TTY `\n` unchanged; injectable `stderrIsTTY` for tests
- [x] Clear on flush/teardown, before warning/error/info stderr, and on phase switch; quiet/no-progress unchanged
- [x] M58 compose (`warnings=summary` / `full`); throttle intervals and message wording unchanged
- [x] README + ARCHITECTURE (recipes if progress UX mentioned)
- [x] Final gate `pnpm build && pnpm test`

**Out of scope:** bars/ETA/spinners; new flags/config; schema bump; throttle changes; function-churn progress revival; wrapping `--verbose` argv writers.

---

## Milestone 60 — Table Path Column UX — Done

→ [`.specs/features/table-path-column-ux/spec.md`](../features/table-path-column-ux/spec.md)  
**Slug:** `table-path-column-ux` | **Priority:** Medium | **Specs:** Done  
**IDs:** HOTSPOT-990–1009 (1001–1009 reserved) | **Depth:** Medium  
**Sisters:** rich-output (M9), export-formats (M10), output-interpretation-ux (M41), compare-interpretation (M53), tty-ephemeral-progress (M59)  
**Artifacts:** [context.md](../features/table-path-column-ux/context.md) · [spec.md](../features/table-path-column-ux/spec.md) · [design.md](../features/table-path-column-ux/design.md) · [tasks.md](../features/table-path-column-ux/tasks.md) (Status: **Done**)

Default table/compare-table File column: replace hard-coded width **24** + left `slice(0, width)` with **middle-ellipsis** (prefix + basename, Unicode `…`) and File width derived from `process.stdout.columns` (injectable for tests), min/max clamp, fallback **24** when columns missing, capped so scan numeric columns still fit on ~80-col terminals. Shared helper for scan + compare parity. **No** new flags, config keys, or JSON schema bumps.

- [x] Shared `src/report/` helper: `resolveFileColumnWidth` + `formatFileColumn` (middle-ellipsis) + unit tests
- [x] Wire `table.ts` + `compare-table.ts` (dynamic File header width; injectable `stdoutColumns`)
- [x] Update truncation tests (replace left-slice assertions); compare parity
- [x] Living docs (ARCHITECTURE / README if table layout mentioned)
- [x] Final gate `pnpm build && pnpm test` (Execute session)

**Out of scope:** markdown/JSON/CSV paths; `--full-paths`; end-ellipsis/basename-only; triage/explain changes.

---

## Milestone 61 — Inline Progress Bar — DONE

→ [`.specs/features/inline-progress-bar/spec.md`](../features/inline-progress-bar/spec.md)  
**Slug:** `inline-progress-bar` | **Priority:** Medium | **Specs:** Done  
**IDs:** HOTSPOT-1010–1029 (1026–1029 reserved) | **Depth:** Large  
**Sisters:** tty-ephemeral-progress (M59), cli-warnings-mode (M58), explain-and-scan-feedback (M42), cli-surface-polish (M38 quiet/no-progress)  
**Artifacts:** [context.md](../features/inline-progress-bar/context.md) · [spec.md](../features/inline-progress-bar/spec.md) · [design.md](../features/inline-progress-bar/design.md) · [tasks.md](../features/inline-progress-bar/tasks.md) (Status: **Done**)

Homegrown complexity fill bar (TTY `█░` / non-TTY `#-`) with honest `filesProcessed/totalFiles` (+ batch when known); git indeterminate counter only; post-barrier `Finalizing…` live line through score/compare/render/write; defer `flushWarnings` until after write. **No** new flags, config, schema, or progress libraries.

- [x] Domain `"finalize"` phase + diagnostics formatters/handlers + unit tests
- [x] Emit finalize once at post-barrier in `src/scan.ts`
- [x] Defer `flushWarnings` after write (scan / compare / baseline)
- [x] Living docs (README + ARCHITECTURE)
- [x] Final gate `pnpm build && pnpm test` (Execute session)

**Out of scope:** ora/cli-progress; ETA/spinners; fake overall % / 99% freeze; doctor/init/dry-run/completion progress; schema/ranking changes; multi-bar; throttle interval changes (except finalize always emits once).

---

## Post-M61 backlog — DX batch (M62–M67)

Specs **Planned** (2026-07-26). Locked decisions in each feature `context.md`. Execute order: M62 → M63 → M64 → M65 → M66 → M67 (M61 may run in parallel; coordinate M62 `since=` progress prefix with M61 finalize if both open).

### Milestone 62 — Feedback and copy UX — DONE

→ [`.specs/features/feedback-copy-ux/spec.md`](../features/feedback-copy-ux/spec.md)  
**Slug:** `feedback-copy-ux` | **Priority:** High | **Specs:** Done  
**IDs:** HOTSPOT-1030–1059 (1046–1059 reserved) | **Depth:** Large  
**Sisters:** csv-bundle (M18), cli-surface-polish (M38), workflow-subcommands (M40), scan-observability (M51), compare-interpretation (M53), cli-warnings-mode (M58), tty-ephemeral-progress (M59), inline-progress-bar (M61)  
**Artifacts:** [context.md](../features/feedback-copy-ux/context.md) · [spec.md](../features/feedback-copy-ux/spec.md) · [design.md](../features/feedback-copy-ux/design.md) · [tasks.md](../features/feedback-copy-ux/tasks.md) (Status: **Done**)

CSV write confirmation on stderr; timings in summary + stderr; help/README without milestone jargon; `since=` on first progress line; compare empty-state copy; `BaselineError` → exit 2; baseline hint mentions `baseline save`.

- [x] Report + diagnostics (CSV confirm, timings, since= prefix, empty compare copy)
- [x] Bin exit mapping + baseline hint + help de-jargon
- [x] README user-facing milestone ID cleanup
- [x] Final gate `pnpm build && pnpm test` (Execute session)

### Milestone 63 — CLI surface parity — DONE

→ [`.specs/features/cli-surface-parity/spec.md`](../features/cli-surface-parity/spec.md)
**Slug:** `cli-surface-parity` | **Priority:** High | **Specs:** Done
**IDs:** HOTSPOT-1060–1099 (1096–1099 reserved) | **Depth:** Large
**Sisters:** csv-bundle (M18), cli-surface-polish (M38), workflow-subcommands (M40), explain-and-scan-feedback (M42), cli-adoption-extras (M54), cli-warnings-mode (M58)
**Artifacts:** [context.md](../features/cli-surface-parity/context.md) · [spec.md](../features/cli-surface-parity/spec.md) · [design.md](../features/cli-surface-parity/design.md) · [tasks.md](../features/cli-surface-parity/tasks.md) (Status: **Done**)

`baseline save` quiet/progress/verbose parity; zsh/fish completions ↔ bash; path-looking argv → `scan`; `--fail-on-explain-miss`; `--warnings=json`; `--csv-single-file` opt-in (default bundle intact).

- [x] Baseline save flag parity + path→scan rewrite
- [x] `--fail-on-explain-miss` + `--warnings=json` + `--csv-single-file`
- [x] Completions + docs
- [x] Final gate `pnpm build && pnpm test` (Execute session)

### Milestone 64 — Config and doctor DX — DONE

→ [`.specs/features/config-doctor-dx/spec.md`](../features/config-doctor-dx/spec.md)  
**Slug:** `config-doctor-dx` | **Priority:** High | **Status:** DONE  
**IDs:** HOTSPOT-1100–1139 (1136–1139 reserved) | **Depth:** Large  
**Sisters:** config-file (M21), path-config-dx (M30), cli-init-doctor-dry-run (M39), doctor-scope-parity (M52), api-trust-docs (M55)  
**Artifacts:** [context.md](../features/config-doctor-dx/context.md) · [spec.md](../features/config-doctor-dx/spec.md) · [design.md](../features/config-doctor-dx/design.md) · [tasks.md](../features/config-doctor-dx/tasks.md) (Status: **Done**)

Richer init (`$schema`, `$comments`, realistic globs); `schemas/hotspot-scanner-config.json` + package `exports`; `config validate` / `config print`; dry-run prelude context; doctor `--since` preflight.

- [x] Config schema + reserved meta keys + rich exemplar
- [x] `config validate` / `config print` subcommands
- [x] Dry-run + doctor since preflight
- [x] Final gate `pnpm build && pnpm test` (Execute session)

### Milestone 65 — Git error UX — DONE

→ [`.specs/features/git-error-ux/spec.md`](../features/git-error-ux/spec.md)  
**Slug:** `git-error-ux` | **Priority:** Medium | **Specs:** Done  
**IDs:** HOTSPOT-1140–1159 (1151–1159 reserved) | **Depth:** Medium  
**Sisters:** cli-surface-polish (M38 hints), config-doctor-dx (M64 since preflight — do not duplicate)  
**Artifacts:** [context.md](../features/git-error-ux/context.md) · [spec.md](../features/git-error-ux/spec.md) · [design.md](../features/git-error-ux/design.md) · [tasks.md](../features/git-error-ux/tasks.md) (Status: **Done**)

Runtime `GitLogError` / related hints for invalid `--since`, shallow clone, corrupt repo stderr patterns.

- [x] Hint helper + wire constructors
- [x] Living docs
- [x] Final gate `pnpm build && pnpm test` (Execute session)

### Milestone 66 — Contract enrich (additive 3.0) — DONE

→ [`.specs/features/contract-enrich-additive/spec.md`](../features/contract-enrich-additive/spec.md)  
**Slug:** `contract-enrich-additive` | **Priority:** High | **Specs:** Done  
**IDs:** HOTSPOT-1160–1199 (1185–1199 reserved) | **Depth:** Large  
**Sisters:** scan-compare (M13), json-contract (M20), compare-interpretation (M53), ncloc-metric (M57)  
**Artifacts:** [context.md](../features/contract-enrich-additive/context.md) · [spec.md](../features/contract-enrich-additive/spec.md) · [design.md](../features/contract-enrich-additive/design.md) · [tasks.md](../features/contract-enrich-additive/tasks.md) (Status: **Done**)

Additive under `version: "3.0"` (no bump): `meta.scannerVersion`; JSON `$schema`; compare `rankChanged` deltas (`scoreDelta`, `nclocDelta`, `commitCountDelta`). Old baselines remain valid.

- [x] Types/schemas + emit scannerVersion / `$schema`
- [x] Compare deltas + reporters (table/md/json/csv) + explain
- [x] Contract tests + living docs
- [x] Final gate `pnpm build && pnpm test` (Execute session)

### Milestone 67 — Scope extensions plus — DONE

→ [`.specs/features/scope-extensions-plus/spec.md`](../features/scope-extensions-plus/spec.md)  
**Slug:** `scope-extensions-plus` | **Priority:** Medium | **Specs:** Done  
**IDs:** HOTSPOT-1200–1229 (1213–1229 reserved) | **Depth:** Medium  
**Sisters:** exclude-tests-by-default (M46), scope-extensions-excludes (M48)  
**Artifacts:** [context.md](../features/scope-extensions-plus/context.md) · [spec.md](../features/scope-extensions-plus/spec.md) · [design.md](../features/scope-extensions-plus/design.md) · [tasks.md](../features/scope-extensions-plus/tasks.md) (Status: **Done**)

Close residual test-glob gap (`*.test/spec` × mjs/cjs/mts/cts); add `.mts` / `.cts` to `ELIGIBLE_EXTENSIONS`.

- [x] Test exclude patterns + eligible extensions
- [x] Living docs / clear CONCERNS residual
- [x] Final gate `pnpm build && pnpm test` (Execute session)

---

## Post-M67 backlog — Warnings & report DX (M68–M70) — DONE

Execute complete (2026-07-27). Locked decisions B/K in [warnings-bookend-dx/context.md](../features/warnings-bookend-dx/context.md); D/J in M69/M70 specs. Execute order: **M68 → M69 → M70**.

### Milestone 68 — Warnings presentation DX — DONE

→ [`.specs/features/warnings-bookend-dx/spec.md`](../features/warnings-bookend-dx/spec.md)  
**Slug:** `warnings-bookend-dx` | **Priority:** High | **Specs:** Done  
**IDs:** HOTSPOT-1230–1259 (1255–1259 reserved) | **Depth:** Large  
**Sisters:** cli-warnings-mode (M58), tty-ephemeral-progress (M59), inline-progress-bar (M61), feedback-copy-ux (M62), cli-surface-parity (M63)  
**Artifacts:** [context.md](../features/warnings-bookend-dx/context.md) · [spec.md](../features/warnings-bookend-dx/spec.md) · [design.md](../features/warnings-bookend-dx/design.md) · [tasks.md](../features/warnings-bookend-dx/tasks.md) (Status: **Done**)

Stderr bookend (B): short teaser before write + full flush after; keep `Finalizing…` until teaser; `json` one emission at end; `full` streams during scan (no teaser / no re-emit on flush). Compare dedup (K): remove body `formatScanWarning` loops; keep exec-summary rollup. Docs: warning-codes timing + `json` (A+G); ROADMAP M58 “before Hotspots” notes (L); AGENTS exit codes (E).

- [x] Diagnostics teaser API + mode matrix tests
- [x] Compare table/markdown warning-body removal
- [x] Bin lifecycle (scan / compare / baseline save) + order tests
- [x] Docs sync (warning-codes, M58 notes, AGENTS exits, living notes)
- [x] Final gate `pnpm build && pnpm test` (Execute session)

**Out of scope:** Item C; fail-on-warning; npm/SARIF; timing on `baseline save`; new flags; schema bump; M69/M70.

### Milestone 69 — Write confirmation UX — DONE

→ [`.specs/features/write-confirm-ux/spec.md`](../features/write-confirm-ux/spec.md)  
**Slug:** `write-confirm-ux` | **Priority:** Medium | **Specs:** Done  
**IDs:** HOTSPOT-1260–1279 (1275–1279 reserved) | **Depth:** Medium  
**Sisters:** feedback-copy-ux (M62 CSV confirm), csv-bundle (M18), cli-surface-parity (M63), warnings-bookend-dx (M68)  
**Artifacts:** [spec.md](../features/write-confirm-ux/spec.md) · [tasks.md](../features/write-confirm-ux/tasks.md) (Status: **Done**)

Stderr confirm after successful `--output` (table/md/json) and `--csv-single-file` writes; `--quiet` suppresses; CSV bundle confirm unchanged; no new flags.

- [x] `writeRenderedOutput` confirm + quiet/stdout/bundle matrix tests
- [x] Final gate `pnpm build && pnpm test` (Execute session)

**Out of scope:** New flags; stdout-only confirm; baseline-save timing; M68/M70 implementation.

### Milestone 70 — Report table Lines parity — DONE

→ [`.specs/features/table-lines-parity/spec.md`](../features/table-lines-parity/spec.md)  
**Slug:** `table-lines-parity` | **Priority:** Medium | **Specs:** Done  
**IDs:** HOTSPOT-1280–1299 (1295–1299 reserved) | **Depth:** Medium-light  
**Sisters:** reporter-cli (M5), output-interpretation-ux (M41), table-path-column-ux (M60)  
**Artifacts:** [spec.md](../features/table-lines-parity/spec.md) · [tasks.md](../features/table-lines-parity/tasks.md) (Status: **Done**)

Add `Lines` (`linesChanged`) column to scan `table.ts` mirroring markdown; glossary/how-to-read wording; table tests. No schema bump.

- [x] Table Lines column + glossary + unit tests
- [x] Final gate `pnpm build && pnpm test` (Execute session)

**Out of scope:** Compare table layout expansion; git miner / `linesChanged` semantics; new flags.

---

## Milestone 71 — Remove compare & baseline — DONE

→ [`.specs/features/remove-compare-baseline/spec.md`](../features/remove-compare-baseline/spec.md)  
**Slug:** `remove-compare-baseline` | **Priority:** High | **Specs:** Done  
**IDs:** HOTSPOT-1300–1329 (1316–1329 reserved) | **Depth:** Complex  
**Precedent:** [remove-coupling-analysis](../features/remove-coupling-analysis/) (M56)  
**Sisters (historical Done — superseded, not reopened):** scan-compare (M13), workflow-subcommands (M40), compare-interpretation (M53), csv-bundle (M18), json-contract (M20), contract-enrich-additive (M66)  
**Artifacts:** [context.md](../features/remove-compare-baseline/context.md) · [spec.md](../features/remove-compare-baseline/spec.md) · [design.md](../features/remove-compare-baseline/design.md) · [tasks.md](../features/remove-compare-baseline/tasks.md) (Status: **Done**)

Hard cut to **scan-only**: deleted `compare`, `baseline save`, `scan --baseline`, `--strict`, compare reporters, `schemas/compare-result.json`, public `compareScanResults` / `loadBaseline` / `Compare*` types, and `COMPARE_SINCE_MISMATCH`. Kept `parseScanResult` under `src/scan-result/` with renamed `ScanResultParseError`. Scan JSON stays `version: "3.0"`.

- [x] Relocate `parseScanResult` + `ScanResultParseError` (`src/scan-result/`)
- [x] Strip CLI / completions / scan-actions compare wiring
- [x] Delete compare domain + report modules + types + `#compare`
- [x] Delete compare schema + purge fixtures; negative CLI tests
- [x] Sync living docs / skills / AGENTS (exit table)
- [x] Final gate `pnpm build && pnpm test` (880 tests)

**Out of scope:** Soft deprecation; npm/SARIF; fail-on-warning; Item C; score formula; rewriting historical Done sister specs.

---

## Milestone 72 — Complexity trend — DONE

→ [`.specs/features/complexity-trend/spec.md`](../features/complexity-trend/spec.md)  
**Slug:** `complexity-trend` | **Priority:** High | **Specs:** Done  
**IDs:** HOTSPOT-1400–1499 (1470–1499 reserved; active 1400–1425) | **Depth:** Complex  
**Sisters:** ncloc-metric (M57), explain-and-scan-feedback (M42), cli-surface-polish (M38), remove-compare-baseline (M71 — do not reopen compare)  
**Artifacts:** [context.md](../features/complexity-trend/context.md) · [spec.md](../features/complexity-trend/spec.md) · [design.md](../features/complexity-trend/design.md) · [tasks.md](../features/complexity-trend/tasks.md) (`Status: Done`)

Dedicated `hotspot-scanner trend <file>` command: path-scoped Git history (`--follow` default), indentation complexity `{ n, total, mean, sd, max }` + `ncloc` per revision, uniform `--max-revisions` 100 (or `--all`), formats table/json/csv, ASCII sparklines for `mean`/`ncloc` in table+JSON meta. Separate JSON contract `version: "1.0"` / `kind: "complexity-trend"`. Library export `runComplexityTrend`. Does **not** change scan pipeline or scan JSON `3.0`.

- [x] Indentation analyzer + sparkline + uniform sample
- [x] Git file-history helpers + `runComplexityTrend` + schema
- [x] Reporters + CLI `trend` + completions
- [x] Fixture + living docs + public export
- [x] Final gate `pnpm build && pnpm test`

**Out of scope:** `--classify`; `git cat-file --batch`; explain auto-hint; config inheritance; markdown/charts; McCabe; compare/baseline; scan contract changes.

---

## Milestone 73 — Top-only summary rollups — Specs Planned

→ [`.specs/features/top-only-rollups/spec.md`](../features/top-only-rollups/spec.md)  
**Slug:** `top-only-rollups` | **Priority:** Medium | **Specs:** Planned  
**IDs:** HOTSPOT-1500–1519 (1515–1519 reserved) | **Depth:** Medium  
**Sisters:** warnings-bookend-dx (M68), feedback-copy-ux (M62), inline-progress-bar (M61), cli-warnings-mode (M58)  
**Artifacts:** [context.md](../features/top-only-rollups/context.md) · [spec.md](../features/top-only-rollups/spec.md) · [design.md](../features/top-only-rollups/design.md) · [tasks.md](../features/top-only-rollups/tasks.md) (`Status: Planned`)

Remove duplicate human rollups on default scan output: keep `Warnings:` + `Timing:` only in the table/markdown executive summary; drop M68 pre-write stderr teaser and M62 brief `timing: total Nms` stderr echo. Keep post-write aggregated `warning:` detail via `flushWarnings`. No new flags, schema, or ranking changes.

- [ ] Remove `emitWarningTeaser` from scan lifecycle / diagnostics API
- [ ] Remove `emitBriefTimingStderr` and call sites
- [ ] Update bin/diagnostics lifecycle tests (write → flush → explain)
- [ ] Sync `docs/warning-codes.md`, README, ARCHITECTURE
- [ ] Final gate `pnpm build && pnpm test`

**Out of scope:** Bottom-only; item C (scan body full warnings); changing `--warnings=full`/`json` semantics beyond teaser absence; compare/baseline.

---

## Milestone 74 — Doctor Color UX — Specs Planned

→ [`.specs/features/doctor-color-ux/spec.md`](../features/doctor-color-ux/spec.md)  
**Slug:** `doctor-color-ux` | **Priority:** Medium | **Specs:** Planned  
**IDs:** HOTSPOT-1520–1539 (1535–1539 reserved; active 1520–1530) | **Depth:** Medium  
**Sisters:** output-interpretation-ux (M41), cli-init-doctor-dry-run (M39), scan-observability (M51), doctor-scope-parity (M52), config-doctor-dx (M64)  
**Artifacts:** [context.md](../features/doctor-color-ux/context.md) · [spec.md](../features/doctor-color-ux/spec.md) · [design.md](../features/doctor-color-ux/design.md) · [tasks.md](../features/doctor-color-ux/tasks.md) (`Status: Planned`)

ANSI-color `pass:` / `warn:` / `fail:` prefixes on `doctor` **text** output when stdout is a TTY; disable via `--no-color`, non-empty `NO_COLOR`, non-TTY, or `--format json`. Reuse raw ANSI helpers (no new color dependency). JSON envelope and finding messages unchanged.

- [ ] `paintDoctorStatus` + `formatDoctorTextReport({ color })`
- [ ] `resolveDoctorColor` + doctor `--no-color` + CLI tests
- [ ] README / ARCHITECTURE / CONVENTIONS notes
- [ ] Final gate `pnpm build && pnpm test`

**Out of scope:** Message-body/path coloring; `FORCE_COLOR`; JSON color; chalk; scan/trend color changes; changing exit codes or finding copy; M73 top-only-rollups.

---

## Further horizon

Remains in [STATE.md](STATE.md) **Deferred**:

- npm / npx / `pnpm dlx` publish install path
- CI recipes / fail-on stable deltas / SARIF
- Historical AST post-rename (**do not prioritize**)
- ~~Residual co-located `*.test.mjs` / `*.spec.cjs`~~ → **M67 Done** (gap closed)
- Item C (full warning lines in scan report body) — deferred past M68 bookend/dedup
- Fail-on-warning CI gates — deferred
