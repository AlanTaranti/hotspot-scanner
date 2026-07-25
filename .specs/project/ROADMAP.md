# ROADMAP — @vitals/hotspot-scanner

Status: **M7–M45 Done** — Post-M37 user DX backlog **complete** (M38–M45 Execute done).

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

Specs Planned via `planner-feature` (2026-07-23). Checkboxes remain open until Execute. M12 (CI fail-on-score) remains intentionally absent (see STATE.md).

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
