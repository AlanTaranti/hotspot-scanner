# ROADMAP — @taranti/hotspot-scanner

## Current

| Field               | Value                                                                        |
| ------------------- | ---------------------------------------------------------------------------- |
| **Status**          | **M79 + M80 Done** — package scope `@taranti`; GitHub identity `AlanTaranti` |
| **Open milestones** | _None_                                                                       |
| **Deferred**        | [STATE.md](STATE.md) § Deferred                                              |

Archive below is historical (feature links stay valid). Prefer this table + Done summary for “what’s next”; deferred ideas live only in STATE. Detail for any milestone: `.specs/features/<slug>/`.

**M12** intentionally absent (CI fail-on-score removed — see STATE).

### Done summary

| Band    | Scope                                                                                                                                                                                        |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1–M6   | v1 scaffold → git miner → complexity → scoring → reporter/CLI → integration                                                                                                                  |
| M7–M24  | Path scope, harmonic score, rich/export formats, function granularity, compare, coupling, workers, CSV bundle, JSON contract, config, function AST/churn, package DX                         |
| M25–M36 | Product docs, rename confidence, coupling enrichment, diagnostics, AST+, path/config DX, scan performance                                                                                    |
| M37–M45 | README adoption, CLI polish, init/doctor/dry-run, workflows, interpretation UX, explain, monorepo remount, package exports enrich, adoption docs                                             |
| M46–M55 | Exclude tests by default, git pathspecs, scope extensions, ranking accuracy+, observability, doctor scope parity, perf controls, API trust docs, compare interpretation, CLI adoption extras |
| M56–M65 | Remove coupling; NCLOC metric (retire McCabe/function mode); warnings UX; TTY progress; table path UX; progress bar; feedback/copy UX; CLI surface parity; config/doctor DX; git error UX    |
| M66–M72 | Contract enrich, scope+, warnings bookend, write confirm, table Lines parity; **remove compare/baseline (scan-only)**; complexity trend CLI                                                  |
| M73–M78 | Top-only rollups; doctor/trend/assess color UX; growth-pattern bridge; hotspot assess                                                                                                        |
| M79–M80 | Package scope rename (`@taranti`); GitHub repo identity (`AlanTaranti`)                                                                                                                      |

---

## Archive

### M1–M6 — v1 foundation

## Milestone 1 — Scaffold — DONE

→ [`.specs/features/scaffold/spec.md`](../features/scaffold/spec.md)

Package scripts, `src/` + CLI stub, domain types, placeholder integration wiring.

- Build/test scripts and Vitest config
- Module layout under `src/` and `bin/`
- Domain types in `src/types/`

## Milestone 2 — Git Change Miner — DONE

→ [`.specs/features/git-change-miner/spec.md`](../features/git-change-miner/spec.md)

Streaming `git log` parse into file churn stats, co-change events, and rename aliases.

- Numstat/`name-only` streaming aggregation
- Rename handling (`old => new` + `PathAliasMap`)
- Fixtures for merges, renames, deletes

## Milestone 3 — Complexity Analyzer — DONE

→ [`.specs/features/complexity-analyzer/spec.md`](../features/complexity-analyzer/spec.md)

File-level McCabe via ts-morph for TS/JS (superseded later by M57 NCLOC).

- ts-morph adapter for eligible extensions
- Invalid syntax: warn and skip
- Verified fixture complexity values

## Milestone 4 — Scoring — DONE

→ [`.specs/features/scoring/spec.md`](../features/scoring/spec.md)

Hotspot and temporal-coupling scorers (coupling later removed in M56).

- Log-scale normalize + product combiner (later harmonic in M8)
- Coupling strength from co-change counts
- Default min-cochange threshold

## Milestone 5 — Reporter + CLI — DONE

→ [`.specs/features/reporter-cli/spec.md`](../features/reporter-cli/spec.md)

Table/JSON CLI surface and scan entry wiring.

- Table + JSON report formats
- Flags: `--since`, `--format`, `--top`, `--min-cochange`
- Commander parsing; `runScan()` hooks

## Milestone 6 — Integration — DONE

→ [`.specs/features/integration/spec.md`](../features/integration/spec.md)

End-to-end scan on versioned fixture repo with coverage gate.

- Full pipeline: git → complexity → scoring
- Integration + CLI tests on `small-ts`
- Coverage thresholds in Vitest config

### M7–M24 — post-v1 core

## Milestone 7 — Path Scoping — DONE

→ [`.specs/features/path-scoping/spec.md`](../features/path-scoping/spec.md)

Default excludes, git-repo validation, and include/exclude globs.

- Default artifact excludes (`node_modules`, `.git`, `dist`, …)
- Validate `repoPath` is a Git repository
- Repeatable `--include` / `--exclude`

## Milestone 8 — Harmonic Hotspot Score — DONE

→ [`.specs/features/harmonic-hotspot-score/spec.md`](../features/harmonic-hotspot-score/spec.md)

Replaced product combiner with harmonic mean of normalized complexity and churn.

- `hotspotScore = 2ch / (c + h)` with zero guard
- Ranking fixtures updated for new order

## Milestone 9 — Rich Output — DONE

→ [`.specs/features/rich-output/spec.md`](../features/rich-output/spec.md)

Raw metrics and bus factor in JSON/table hotspot rows.

- Raw complexity/churn/function counts in output
- `authorCount` from author set size

## Milestone 10 — Export Formats — DONE

→ [`.specs/features/export-formats/spec.md`](../features/export-formats/spec.md)

File output transport and markdown report format.

- `--output <path>` for table/json/markdown
- `--format markdown`

## Milestone 11 — Function Granularity — DONE

→ [`.specs/features/function-granularity/spec.md`](../features/function-granularity/spec.md)

Per-function McCabe ranking mode (removed end-to-end in M57).

- Function rows with name/line/complexity
- `--granularity file|function`

## Milestone 13 — Scan Compare — DONE

→ [`.specs/features/scan-compare/spec.md`](../features/scan-compare/spec.md)

Baseline delta reports (removed in M71).

- `scan --baseline <file>`
- New/removed/rank-changed deltas

## Milestone 14 — Enriched Coupling — DONE

→ [`.specs/features/enriched-coupling/spec.md`](../features/enriched-coupling/spec.md)

Static import flag on coupling pairs (coupling removed in M56).

- Relative import analysis between pairs
- `hasStaticDependency` on coupling items

## Milestone 15 — AST Parallelization — DONE

→ [`.specs/features/ast-parallelization/spec.md`](../features/ast-parallelization/spec.md)

Worker-thread batch complexity analysis.

- Worker pool in complexity module
- Batch processing for large trees

## Milestone 16 — Format-Scoped Top Limit — DONE

→ [`.specs/features/format-scoped-top/spec.md`](../features/format-scoped-top/spec.md)

`--top` applies only to human table/markdown; JSON/CSV stay full rankings.

- Table/markdown slicing only
- Machine formats ignore `--top`

## Milestone 17 — CSV Export — DONE

→ [`.specs/features/csv-export/spec.md`](../features/csv-export/spec.md)

Single-file multi-block CSV (superseded by M18 bundle).

- `--format csv` with RFC 4180 escaping
- Historical layout only — do not reopen

## Milestone 18 — CSV Bundle Export — DONE

→ [`.specs/features/csv-bundle/spec.md`](../features/csv-bundle/spec.md)

Multi-file CSV stem bundle + meta sidecar; requires `--output`.

- Pure reporter `CsvBundle`; CLI multi-write
- Meta + ranking CSVs; no legacy multi-block

## Milestone 19 — Documentation Sync — DONE

→ [`.specs/features/docs-sync/spec.md`](../features/docs-sync/spec.md)

Living docs and README aligned with post-v1 shipped surface.

- PROJECT / README / INTEGRATIONS sync
- Stale milestone status cleanup

## Milestone 20 — JSON Contract — DONE

→ [`.specs/features/json-contract/spec.md`](../features/json-contract/spec.md)

Published schemas and baseline validation for scan/compare JSON.

- `schemas/scan-result.json` (+ compare, later removed)
- Contract tests against CLI JSON

## Milestone 21 — Config File — DONE

→ [`.specs/features/config-file/spec.md`](../features/config-file/spec.md)

`.hotspot-scanner.json` only; CLI > config > defaults.

- Scan parameter keys in config
- Documented precedence

## Milestone 22 — Function AST Coverage — DONE

→ [`.specs/features/function-ast-coverage/spec.md`](../features/function-ast-coverage/spec.md)

Broader function collection (getters/setters, field arrows, object methods).

- Extended collect/resolve naming
- McCabe decision nodes unchanged

## Milestone 23 — Per-Function Git Churn — DONE

→ [`.specs/features/per-function-churn/spec.md`](../features/per-function-churn/spec.md)

Hunk-overlap function churn (removed with function mode in M57).

- Patch-stream attribution in function mode
- Stop inheriting file churn for function scores

## Milestone 24 — Package DX — DONE

→ [`.specs/features/package-dx/spec.md`](../features/package-dx/spec.md)

Publish-prep scripts and package metadata (no npm publish).

- `typecheck` / `lint` / `format` scripts
- `engines`, `repository`, `files` allowlist incl. `schemas/`

### M25–M36 — docs, accuracy, performance

## Milestone 25 — Product docs sync — DONE

→ [`.specs/features/product-docs-sync/spec.md`](../features/product-docs-sync/spec.md)

Product docs aligned through M24 shipping reality.

- PROJECT / README / ARCHITECTURE sync
- ROADMAP/STATE status parity

## Milestone 26 — Rename confidence — DONE

→ [`.specs/features/rename-confidence/spec.md`](../features/rename-confidence/spec.md)

Actionable rename-history warnings (no historical AST).

- Blind-spot warnings for incomplete rename history
- Function-mode pós-rename confidence avisos (pre-M57)

## Milestone 27 — Coupling enrichment — DONE

→ [`.specs/features/coupling-enrichment/spec.md`](../features/coupling-enrichment/spec.md)

Richer static coupling labels (paths, direction, type vs runtime).

- tsconfig `paths` resolution
- Direction and import-kind flags

## Milestone 28 — Performance & diagnostics UX — DONE

→ [`.specs/features/perf-diagnostics-ux/spec.md`](../features/perf-diagnostics-ux/spec.md)

Operator concurrency control and clearer scan warnings/progress.

- CLI `--concurrency`
- Structured warning severity / progress phases

## Milestone 29 — Function AST coverage+ — DONE

→ [`.specs/features/function-ast-coverage-plus/spec.md`](../features/function-ast-coverage-plus/spec.md)

Additional callable constructs without McCabe node drift.

- ClassExpression / object get-set / assignment RHS callables
- Overload stub skip; naming fixtures

## Milestone 30 — Path & config DX — DONE

→ [`.specs/features/path-config-dx/spec.md`](../features/path-config-dx/spec.md)

Broader default excludes and config discovery walk.

- Extra artifact excludes (`.next`, `out`, …)
- Parent-directory config walk + `--config`

## Milestone 31 — Persistent AST workers — DONE

→ [`.specs/features/persistent-ast-workers/spec.md`](../features/persistent-ast-workers/spec.md)

Persistent worker pool and Project reuse across batches.

- Live workers + batch queue
- Cheaper syntactic diagnostics path

## Milestone 32 — Coupling stream aggregation — DONE

→ [`.specs/features/coupling-stream-aggregate/spec.md`](../features/coupling-stream-aggregate/spec.md)

Stream-time pair aggregation and mega-commit guard (pre-M56).

- Aggregate pair counts during numstat stream
- Mega-commit skip + warning

## Milestone 33 — Static enrich graph cache — DONE

→ [`.specs/features/static-enrich-cache/spec.md`](../features/static-enrich-cache/spec.md)

One-read peer graph cache for static coupling labels.

- Cached resolved edges; O(1) pair lookup
- No ranking change

## Milestone 34 — Pipeline stage overlap — DONE

→ [`.specs/features/pipeline-stage-overlap/spec.md`](../features/pipeline-stage-overlap/spec.md)

Overlap git mining with complexity analysis in file mode.

- Concurrent mine ∥ analyze with shared cancel
- Scoring after both complete

## Milestone 35 — Function-mode scan efficiency — DONE

→ [`.specs/features/function-mode-scan-efficiency/spec.md`](../features/function-mode-scan-efficiency/spec.md)

Faster function-mode patch/AST/overlap path (pre-M57).

- Pathspec-restricted patch stream
- Interval index for hunk overlap

## Milestone 36 — Discovery & concurrency defaults — DONE

→ [`.specs/features/discovery-concurrency-defaults/spec.md`](../features/discovery-concurrency-defaults/spec.md)

`git ls-files` discovery preference and higher default concurrency cap.

- Prefer tracked-file listing with walk fallback
- Revisit default worker concurrency

### M37–M45 — adoption / user DX

## Milestone 37 — README Adoption DX — DONE

→ [`.specs/features/readme-adoption-dx/spec.md`](../features/readme-adoption-dx/spec.md)

GitHub-facing README adoption without npm publish.

- Problem→solution opening, TOC, sample output
- Real clone URL; jargon cleanup

## Milestone 38 — CLI Surface Polish — DONE

→ [`.specs/features/cli-surface-polish/spec.md`](../features/cli-surface-polish/spec.md)

Default scan path, version, quiet/progress, hints, aliases.

- Default `scan` path `.`; `--version`
- `--quiet` / `--no-progress`; short aliases

## Milestone 39 — CLI Init / Doctor / Dry-run — DONE

→ [`.specs/features/cli-init-doctor-dry-run/spec.md`](../features/cli-init-doctor-dry-run/spec.md)

Adoption commands: init, doctor, scan dry-run preview.

- `init` exemplar config (no overwrite without `--force`)
- `doctor` hard/soft checks; `scan --dry-run` scope preview

## Milestone 40 — Workflow Subcommands — DONE

→ [`.specs/features/workflow-subcommands/spec.md`](../features/workflow-subcommands/spec.md)

`baseline save` / `compare` verbs (removed in M71).

- Explicit save/compare wrappers over scan JSON
- `scan --baseline` retained until M71

## Milestone 41 — Output Interpretation UX — DONE

→ [`.specs/features/output-interpretation-ux/spec.md`](../features/output-interpretation-ux/spec.md)

Human table/markdown glossary, summary, triage, filters, TTY colors.

- Glossary + executive summary
- Triage hints; `--only`; TTY table colors

## Milestone 42 — Explain & Scan Feedback — DONE

→ [`.specs/features/explain-and-scan-feedback/spec.md`](../features/explain-and-scan-feedback/spec.md)

`--explain` breakdown on stderr plus richer complexity progress.

- File (and historical function) explain targets
- Rename next-step copy; complexity-phase progress

## Milestone 43 — Monorepo Path Detect — DONE

→ [`.specs/features/monorepo-path-detect/spec.md`](../features/monorepo-path-detect/spec.md)

Nested package path remounts to git root with auto-include prefix.

- `rev-parse --show-toplevel` remount
- Auto `--include {prefix}/**` unless CLI include set

## Milestone 44 — Coupling Package Exports — DONE

→ [`.specs/features/coupling-package-exports/spec.md`](../features/coupling-package-exports/spec.md)

In-repo `exports`/`imports` resolution for static coupling (pre-M56).

- Package map in enrich path
- Ranking unchanged; better true positives

## Milestone 45 — Adoption Docs & Package Exports Map — DONE

→ [`.specs/features/adoption-docs-package-exports/spec.md`](../features/adoption-docs-package-exports/spec.md)

Recipes, warning-codes cheatsheet, and package `exports` map.

- `docs/recipes.md` + `docs/warning-codes.md`
- Public entry `exports` (no npm publish)

### M46–M55 — scale, accuracy, observability

## Milestone 46 — Exclude Tests by Default — DONE

→ [`.specs/features/exclude-tests-by-default/spec.md`](../features/exclude-tests-by-default/spec.md)

Breaking default: test globs excluded; opt-in `--include-tests`.

- Split artifact vs test exclude constants
- CLI/API `includeTests` through scan/preview

## Milestone 47 — Git Scale Pathspecs — DONE

→ [`.specs/features/git-scale-pathspecs/spec.md`](../features/git-scale-pathspecs/spec.md)

Batched pathspecs for large patch streams; configurable mega-commit threshold.

- Sequential pathspec batches above threshold
- Dry-run scale warning when eligible files large

## Milestone 48 — Scope Extensions & Artifact Excludes — DONE

→ [`.specs/features/scope-extensions-excludes/spec.md`](../features/scope-extensions-excludes/spec.md)

`.mjs`/`.cjs` eligibility and expanded artifact excludes.

- Eligible extensions += `.mjs` / `.cjs`
- Extra default artifact dirs (`.turbo`, `.vercel`, …)

## Milestone 49 — Pipeline Perf Controls — DONE

→ [`.specs/features/pipeline-perf-controls/spec.md`](../features/pipeline-perf-controls/spec.md)

Opt-out of stage overlap and automated bench harness.

- `--sequential` / `--no-overlap`
- `pnpm bench` outside test gate

## Milestone 50 — Ranking Accuracy Plus — DONE

→ [`.specs/features/ranking-accuracy-plus/spec.md`](../features/ranking-accuracy-plus/spec.md)

Stronger rename linking, enrich alias use, PARSE_FAILED stubs, broader AST callables.

- Unlinked-rename heuristics; PathAliasMap in enrich
- PARSE_FAILED flagged score-0 hotspots

## Milestone 51 — Scan Observability — DONE

→ [`.specs/features/scan-observability/spec.md`](../features/scan-observability/spec.md)

Cancel signals, timings, warning rollups, doctor JSON, narrow `--verbose`.

- SIGINT/SIGTERM → clean cancel (130/143)
- Additive `meta.timings`; `doctor --format json`

## Milestone 52 — Doctor Scope Parity — DONE

→ [`.specs/features/doctor-scope-parity/spec.md`](../features/doctor-scope-parity/spec.md)

Doctor shares remount/PathScope/eligible-count prelude with scan and dry-run.

- Shared pipeline context + scope finding
- Optional doctor `--include-tests`

## Milestone 53 — Compare Interpretation — DONE

→ [`.specs/features/compare-interpretation/spec.md`](../features/compare-interpretation/spec.md)

Compare triage, explain, and `--strict` (removed with compare in M71).

- Delta-aware triage hints
- Compare `--explain`; `--strict` on since mismatch

## Milestone 54 — CLI Adoption Extras — DONE

→ [`.specs/features/cli-adoption-extras/spec.md`](../features/cli-adoption-extras/spec.md)

Shell completion subcommand; reject `.hotspotignore`.

- `completion <shell>` static scripts
- Prefer config/`--exclude` over ignore file

## Milestone 55 — API Trust Docs — DONE

→ [`.specs/features/api-trust-docs/spec.md`](../features/api-trust-docs/spec.md)

Public preview/doctor exports, unknown-key warn, trust docs.

- Export `previewScanScope` / `runDoctor`
- Warn-only unknown config keys; SECURITY.md

### M56–M65 — hard cuts and CLI UX

## Milestone 56 — Remove coupling analysis — DONE

→ [`.specs/features/remove-coupling-analysis/spec.md`](../features/remove-coupling-analysis/spec.md)

Hard cut: temporal coupling removed; scan JSON `"2.0"` without `coupling`.

- Pipeline/CLI/config/reporters stop emitting coupling
- Historical coupling specs stay Done; M56 supersedes

## Milestone 57 — NCLOC metric — DONE

→ [`.specs/features/ncloc-metric/spec.md`](../features/ncloc-metric/spec.md)

Hard cut: NCLOC replaces McCabe; function mode removed; JSON `"3.0"`.

- File NCLOC as axis `c`; drop ts-morph/function mode
- Baselines reject legacy complexity/functions fields

## Milestone 58 — CLI Warnings Mode — DONE

→ [`.specs/features/cli-warnings-mode/spec.md`](../features/cli-warnings-mode/spec.md)

Stderr `--warnings summary|full` (default summary); meta stays full.

- Aggregate repeated same-code stderr lines
- CLI-only; no config key; no schema bump

## Milestone 59 — Ephemeral TTY Scan Progress — DONE

→ [`.specs/features/tty-ephemeral-progress/spec.md`](../features/tty-ephemeral-progress/spec.md)

TTY live overwrite progress line for git/complexity; clears cleanly.

- `\r` + clear-to-EOL on TTY; `\n` off-TTY
- Compose with warnings flush; quiet/no-progress unchanged

## Milestone 60 — Table Path Column UX — DONE

→ [`.specs/features/table-path-column-ux/spec.md`](../features/table-path-column-ux/spec.md)

Middle-ellipsis File column with dynamic terminal width.

- Shared path-column helper for scan tables
- Fallback width 24 when columns unknown

## Milestone 61 — Inline Progress Bar — DONE

→ [`.specs/features/inline-progress-bar/spec.md`](../features/inline-progress-bar/spec.md)

Honesty-oriented complexity fill bar + finalize phase; defer warning flush until after write.

- TTY/non-TTY fill glyphs; git indeterminate counter
- `Finalizing…` after mine+analyze barrier

## Milestone 62 — Feedback and copy UX — DONE

→ [`.specs/features/feedback-copy-ux/spec.md`](../features/feedback-copy-ux/spec.md)

CSV write confirm, timings in summary, de-jargon help/README, clearer errors.

- Timings + write confirm on stderr where useful
- Help/README without milestone jargon

## Milestone 63 — CLI surface parity — DONE

→ [`.specs/features/cli-surface-parity/spec.md`](../features/cli-surface-parity/spec.md)

Flag/completion parity and opt-in explain-miss / warnings-json / csv-single-file.

- Path-looking argv → `scan`
- `--fail-on-explain-miss`; `--warnings=json`; `--csv-single-file`

## Milestone 64 — Config and doctor DX — DONE

→ [`.specs/features/config-doctor-dx/spec.md`](../features/config-doctor-dx/spec.md)

Richer init, config schema, `config validate`/`print`, doctor since preflight.

- Config JSON Schema + package exports
- Dry-run prelude enrichment

## Milestone 65 — Git error UX — DONE

→ [`.specs/features/git-error-ux/spec.md`](../features/git-error-ux/spec.md)

Actionable hints for invalid since, shallow clone, corrupt repo patterns.

- Shared git-stderr hint helper
- Wired into git error constructors

### M66–M72 — contract, report DX, scan-only, trend

## Milestone 66 — Contract enrich (additive 3.0) — DONE

→ [`.specs/features/contract-enrich-additive/spec.md`](../features/contract-enrich-additive/spec.md)

Additive scan/compare fields under `"3.0"` (compare later removed in M71).

- `meta.scannerVersion`; JSON `$schema`
- Compare rank deltas while compare existed

## Milestone 67 — Scope extensions plus — DONE

→ [`.specs/features/scope-extensions-plus/spec.md`](../features/scope-extensions-plus/spec.md)

Close residual test-glob gaps; add `.mts`/`.cts`.

- Broader test exclude patterns
- Eligible extensions += `.mts` / `.cts`

## Milestone 68 — Warnings presentation DX — DONE

→ [`.specs/features/warnings-bookend-dx/spec.md`](../features/warnings-bookend-dx/spec.md)

Stderr warnings bookend + compare warning-body dedup (teaser later removed in M73).

- Teaser before write + flush after (era M68)
- Compare table/markdown warning-body cleanup

## Milestone 69 — Write confirmation UX — DONE

→ [`.specs/features/write-confirm-ux/spec.md`](../features/write-confirm-ux/spec.md)

Stderr confirm after successful `--output` writes (table/md/json/single-file CSV).

- Quiet suppresses confirm
- Bundle confirm path unchanged

## Milestone 70 — Report table Lines parity — DONE

→ [`.specs/features/table-lines-parity/spec.md`](../features/table-lines-parity/spec.md)

`Lines` (`linesChanged`) column on scan table to match markdown.

- Table column + glossary wording
- No schema bump

## Milestone 71 — Remove compare & baseline — DONE

→ [`.specs/features/remove-compare-baseline/spec.md`](../features/remove-compare-baseline/spec.md)

Hard cut to scan-only: deleted compare/baseline CLI, schemas, and APIs; kept `parseScanResult`.

- Relocate parse under `src/scan-result/`
- Scan JSON stays `"3.0"`; historical compare specs stay Done

## Milestone 72 — Complexity trend — DONE

→ [`.specs/features/complexity-trend/spec.md`](../features/complexity-trend/spec.md)

Dedicated `trend <file>` command with indentation + NCLOC history and own JSON contract.

- Path-scoped history; table/json/csv; sparklines
- Library export `runComplexityTrend`

### M73–M78 — rollups, color, assess

## Milestone 73 — Top-only summary rollups — DONE

→ [`.specs/features/top-only-rollups/spec.md`](../features/top-only-rollups/spec.md)

Keep Warnings/Timing only in executive summary; drop pre-write stderr teaser and brief timing echo.

- Remove warning teaser + brief timing stderr
- Post-write `flushWarnings` detail retained

## Milestone 74 — Doctor Color UX — DONE

→ [`.specs/features/doctor-color-ux/spec.md`](../features/doctor-color-ux/spec.md)

TTY ANSI on doctor text `pass:`/`warn:`/`fail:` prefixes.

- Color when TTY; honor `--no-color` / `NO_COLOR` / JSON
- No new color dependency

## Milestone 75 — Growth pattern + trend bridge — DONE

→ [`.specs/features/growth-pattern-trend-bridge/spec.md`](../features/growth-pattern-trend-bridge/spec.md)

Always-on growth-pattern classification on trend; explain hints to `trend`.

- `meta.growthPattern` + table Pattern line
- Complexity-trend JSON bump; explain next-step

## Milestone 76 — Trend Color UX — DONE

→ [`.specs/features/trend-color-ux/spec.md`](../features/trend-color-ux/spec.md)

TTY color on trend table Pattern kind token.

- Reuse raw ANSI helpers
- Disable via `--no-color` / non-TTY / `--output` / non-table

## Milestone 77 — Hotspot assess — DONE

→ [`.specs/features/hotspot-assess/spec.md`](../features/hotspot-assess/spec.md)

`assess [path]`: scan → score filter → sequential trends; deteriorating-focused report.

- Own JSON contract `kind: "hotspot-assess"` / `"1.0"`
- Library export `runAssess`

## Milestone 78 — Assess Color UX — DONE

→ [`.specs/features/assess-color-ux/spec.md`](../features/assess-color-ux/spec.md)

TTY ANSI on assess table title, Pattern kinds, and detail scores.

- Bold sections + shared growth-pattern paints
- Honor `--no-color` / non-TTY / `--output` / non-table

## Milestone 79 — Package scope rename — DONE

→ [`.specs/features/package-scope-rename/spec.md`](../features/package-scope-rename/spec.md)

Rename npm package identity from `@vitals/hotspot-scanner` to `@taranti/hotspot-scanner` across code and docs.

- package.json + PACKAGE_NAME
- Adoption and living docs identity sweep
- Cursor agents/skills prose (not skill folder renames)

## Milestone 80 — GitHub repo identity — DONE

→ [`.specs/features/github-repo-identity/spec.md`](../features/github-repo-identity/spec.md)

Point live GitHub citations at the real remote `AlanTaranti/hotspot-scanner`.

- README badge + clone; CONTRIBUTING clone/Issues; SECURITY advisories
- package.json `repository.url` + `homepage` + `bugs`
- npm scope remains M79 (`@taranti`); intentionally distinct from GitHub owner
