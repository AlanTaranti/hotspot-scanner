# ARCHITECTURE — @vitals/hotspot-scanner

## Container view

```mermaid
flowchart TB
  Dev[Developer]
  CLI[hotspot-scanner CLI]
  Repo[(Local Git repo)]

  Dev -->|"scan path"| CLI
  CLI -->|"git log stream"| Repo
  CLI -->|"ts-morph AST"| Repo
  CLI -->|"stdout / file"| Dev

  subgraph internal [Internal modules]
    GitMiner[Git Change Miner]
    Complexity[Complexity Analyzer]
    Hotspot[Hotspot Scorer]
    Coupling[Temporal Coupling Scorer]
    Reporter[Reporter]
  end

  CLI --> GitMiner
  CLI --> Complexity
  GitMiner --> Hotspot
  GitMiner --> Coupling
  Complexity --> Hotspot
  Hotspot --> Reporter
  Coupling --> Reporter
```

## Data flow (scan)

1. CLI parses flags (`--since`, `--format`, `--granularity`, `--top`, `--min-cochange`, `--include`, `--exclude`, `--config`, `--concurrency`, `--output`, `--baseline`) and calls `runScan()` in `src/scan.ts`
2. **Config resolution (M21 + M30)** — before pipeline stages, `runScan()` / `resolveScanConfig()` loads config via `loadHotspotScannerConfig(repoPath, { configPath? })` (`src/config/`). When `configPath` is set (CLI `--config` or `ScanOptions.configPath`), that file is read only (parent walk skipped); missing explicit path → `ConfigError`. Otherwise walk upward from `repoPath` for `.hotspot-scanner.json` (nearest wins); walk miss → built-in defaults only (not an error). CLI builds explicit overrides separately; `mergeScanOptions()` applies **CLI > config > defaults** for `since`, `include`, `exclude`, `granularity`, `minCochange`, `top`, `concurrency`. `format`, `output`, and `baseline` are CLI-only. Invalid JSON or bad types throw `ConfigError` (non-zero exit). Unknown keys are ignored. Bin pre-merge for `top` uses the same `configPath` / discovery args as `runScan()`.
3. **`runScan()`** validates `repoPath`, checks `.git` exists, builds a shared `PathScope` (`src/paths/`), then runs stages sequentially:
   - **Git Change Miner** — one `git log -M --numstat` stream → `FileChangeStats` + `CoChangeEvent[]`; `PathAliasMap` links renames; rename blind-spot warnings as `ScanWarning[]` with `RENAME_HISTORY_INCOMPLETE` (M26 messages, M28 routing); output filtered by `PathScope` via `filterGitMinerResult()`; forwards warnings and phased `onProgress({ phase: "git", commitsProcessed })`
   - **Complexity Analyzer** — discovers in-scope TS/JS files on the main thread (directory prune + file filter), chunks into batches of 50, dispatches batches to a bounded `worker_threads` pool (`createWorkerPool`, concurrency from merged config — default `min(availableParallelism(), 4)`), each worker runs a fresh ts-morph `Project` per batch → merged `ComplexityResult[]` + `FunctionComplexityResult[]` in discovery order; `PARSE_FAILED` warnings on skip; forwards warnings
   - **Scoring branch** on `granularity` (default `file`):
     - **file** — `createHotspotScorer()` → `ScanResult.hotspots`
     - **function** — `createFunctionChurnMiner()` (patch stream, hunk overlap, phased `onProgress({ phase: "function-churn", commitsProcessed })`) → `createFunctionHotspotScorer()` with per-function churn → `ScanResult.functions`
   - **Temporal Coupling Scorer** — file-pair ranked `coupling` (unchanged in both modes)
   - **Static coupling enricher** — `enrichCouplingStaticDeps()` sets static-dependency fields on each pair by scanning working-tree sources for resolvable static `import`/`export … from`/`require` edges (relative + tsconfig/jsconfig `paths`/`baseUrl`; direction and edge-kind flags; missing/unreadable source → no edge; does not change ranking)
   - **Aggregate diagnostics** — `runScan()` collects stage `ScanWarning[]` into `ScanResult.meta.warnings` (always present, possibly empty); forwards each via `onWarning`
4. CLI passes `ScanResult` to **Reporter** for table, JSON, markdown, or CSV output (`--top` applied at render time for table/markdown only; ignored for JSON and CSV)
5. With `--output <path>`, CLI writes the rendered report to file (UTF-8) instead of stdout; stderr diagnostics unchanged
6. With `--baseline <file>`, CLI loads a prior `ScanResult` JSON, runs `compareScanResults()`, and renders a **CompareResult** delta via `renderCompare()` (same format/output transport as normal scan)

### Config file (M21 + M30)

- **Filename:** `.hotspot-scanner.json` only — not `.hotspotrc`, not dual lookup on discovery walk
- **Discovery (default):** From `repoPath`, walk parents for `.hotspot-scanner.json`; nearest file wins; filesystem root with no file → `null` (defaults only, not an error)
- **Explicit path:** `--config <path>` / `ScanOptions.configPath` loads that file only (skips walk); ENOENT or unreadable explicit path → `ConfigError`; relative path resolves from process cwd
- **Keys:** `since`, `include`, `exclude`, `granularity`, `minCochange`, `top`, `concurrency` — map to the same semantics as CLI flags
- **Precedence:** CLI flag explicitly provided → config key present → built-in default (`DEFAULT_SINCE`, `DEFAULT_TOP`, `DEFAULT_MIN_COCHANGE`, `DEFAULT_WORKER_CONCURRENCY`, granularity `file`). `--config` selects which file is read only — option merge precedence unchanged.
- **CLI-only:** `format`, `output`, `baseline`
- **Module:** `src/config/` (`load-config.ts`, `merge-options.ts`); `ConfigError` on invalid JSON or value types; unknown keys ignored

### Path scoping (M7 + M30)

- **Default excludes** (always active, non-disableable): `node_modules`, `.git`, `dist`, `coverage`, `build`, `.next`, `out`, `vendor`, `storybook-static`, `__snapshots__` (M30 patterns use `**/<name>/**` for nested monorepo artifacts; M7 entries unchanged)
- **`--include <glob>`** (repeatable): narrows scope — path must match at least one include pattern
- **`--exclude <glob>`** (repeatable): additive excludes on top of defaults
- **Semantics**: exclude wins over include; same `PathScope` instance filters both git stats and complexity discovery
- **Module**: `src/paths/` (`createPathScope`, `isPathInScope`, `filterGitMinerResult`); glob matching via `picomatch`

## Key constraints

- Single **numstat** Git log pass for file churn and coupling (ADR-2026-020); function mode adds a **second** patch stream (`git log -p --unified=0`) only for per-function churn attribution
- Both git spawns enable **find-renames** (`-M`) so git can emit `old => new` rename metadata for `PathAliasMap`; **do not** add global `git log --follow` (per-file follow is incompatible with a single numstat pass — see CONCERNS)
- Working-tree AST only (not historical file versions)
- Invalid TS/JS: warn and skip — do not abort scan
- Streaming required for large repos (RT-001)
- Complexity batches processed in parallel via `worker_threads` (M15); file discovery and merge remain on main thread

## Rename confidence (M26, RT-003)

File and function git miners share rename linking via `PathAliasMap` (`src/git/rename.ts`) and actionable warnings via `src/git/rename-warnings.ts`. M28 routes existing M26 message families into structured `ScanWarning` objects (`code: "RENAME_HISTORY_INCOMPLETE"`, `severity: "warning"`) — aggregated in `ScanResult.meta.warnings`, forwarded through `onWarning`, and printed to stderr via `src/diagnostics/` (`info:` / `warning:` / `error:` prefixes). **M28 does not add new rename-confidence message families** beyond M26; deeper rename UX remains RT-003 scope.

### Git argv

| Miner | Spawn builder | find-renames | `--follow` |
| ----- | ------------- | ------------ | ---------- |
| File (numstat) | `buildGitLogArgv` in `src/git/spawn.ts` | `-M` | **forbidden** |
| Function (patch) | `buildGitPatchLogArgv` in `src/git/function-churn/spawn.ts` | `-M` | **forbidden** |

### PathAliasMap

Parse `old => new` lines from the log stream, `link()` chains, `canonicalize*()` stats/events at end of mine. Ambiguous paths (multiple competing rename targets) keep the existing incomplete-history prefix.

### File-miner warning families

Emitted from `createGitMiner().mine()` after the streaming aggregate loop (noise control: families only when their signals apply):

| Family | Trigger | Stable prefix / pattern |
| ------ | ------- | ----------------------- |
| Ambiguous rename | `PathAliasMap.getAmbiguousPaths()` | `Rename history may be incomplete for: …` |
| Unlinked suspected rename | Same-commit delete+add with basename relatedness, no `renameFrom` / `=>` | `Suspected unlinked rename (no git rename metadata): …` (capped, max 5 pairs + summary) |
| `--since` truncation | `since` set **and** at least one in-window rename link recorded | `Rename history before the --since window (…) may be missing under canonical paths` |

### Function-mode pós-rename overlap warning

When function-churn mining observes at least one rename link **or** ambiguous path, append **once**: overlap uses current working-tree `[line, endLine]` vs historical hunk lines; confidence may be reduced after renames/moves. File mode does **not** emit this warning. No historical AST or blame-based attribution. Emitted as `RENAME_HISTORY_INCOMPLETE` in `meta.warnings`.

## Diagnostics (M28)

Operator-facing concurrency, progress, and warning UX. Module: `src/diagnostics/` (`logger.ts`).

### Concurrency override

| Surface | Detail |
| ------- | ------ |
| CLI | `--concurrency <n>` — positive integer ≥ 1; invalid → `CliUsageError` |
| Config | `concurrency` in `.hotspot-scanner.json`; invalid → `ConfigError` |
| Default | `DEFAULT_WORKER_CONCURRENCY` = `min(availableParallelism(), 4)` in `src/complexity/pool.ts` |
| Precedence | CLI > config > default |
| Wiring | `mergeScanOptions()` → `runScan()` → `createComplexityAnalyzer({ concurrency })` |

Batch size (`DEFAULT_BATCH_SIZE` = 50) stays internal (M15); not exposed in M28.

### Progress phases

| `phase` | Emitter | Counter |
| ------- | ------- | ------- |
| `git` | `GitMiner` numstat stream | commits in numstat pass |
| `function-churn` | `FunctionChurnMiner` patch stream | commits in patch pass |

Stderr (throttled every 1,000 commits per phase): `Processing <phase> commit <N>...`. Complexity stage has no progress callback in M28.

### Structured warnings (`ScanWarning`)

```ts
type DiagnosticSeverity = "info" | "warning" | "error";

interface ScanWarning {
  severity: DiagnosticSeverity;
  message: string;
  code?: string;
}
```

- `ScanResult.meta.warnings: ScanWarning[]` — required, may be empty; `version` stays `"1.0"`
- `CompareResult.meta.warnings: ScanWarning[]` — same shape (compare consumers must read objects, not bare strings)
- `onWarning?: (warning: ScanWarning) => void` — programmatic callback
- **Severity vs exit code:** severity is diagnostic only; successful scans exit `0` with warnings present

### M28 warning code catalog

| Code | Emitter | Operator interpretation |
| ---- | ------- | ----------------------- |
| `EMPTY_SINCE_WINDOW` | git / function-churn | No commits in `--since`; widen window |
| `RENAME_HISTORY_INCOMPLETE` | git / function-churn | Rename tracking incomplete — see [Rename confidence (M26)](#rename-confidence-m26-rt-003) |
| `PARSE_FAILED` | complexity | File skipped on parse failure |
| `COMPARE_SINCE_MISMATCH` | compare | Baseline/current `since` differ |

## Complexity stage parallelism (M15)

```mermaid
flowchart LR
  Discover[discoverSourceFiles] --> Chunk[chunk 50 files]
  Chunk --> Pool[createWorkerPool]
  Pool --> W1[worker batch A]
  Pool --> W2[worker batch B]
  W1 --> Merge[merge by discovery index]
  W2 --> Merge
```

- **Unit of work:** batch (≤50 files), not individual files — each worker instantiates a fresh ts-morph `Project` (M3 D7)
- **Modules:** `analyze-batch.ts` (shared logic), `worker.ts` (thread entry), `pool.ts` (bounded dispatch)
- **Inline fallback:** `concurrency === 1` or single batch — no worker spawn
- **Injectable:** `ComplexityAnalyzerDependencies.createWorkerPool` and `concurrency` for tests; production value from merged scan config (M28 CLI/config override)

## Orchestration

`src/scan.ts` is the pipeline orchestrator: `createGitMiner` → `createComplexityAnalyzer` → (`createHotspotScorer` | `createFunctionHotspotScorer`) + `createTemporalCouplingScorer` → `enrichCouplingStaticDeps`. It returns a typed `ScanResult` with full ranked lists. `bin/hotspot-scanner.ts` is a thin CLI wrapper (flags only, no domain logic).

Integration validation: `tests/fixtures/repos/small-ts/` (see [TESTING.md](./TESTING.md) § Integration).

## Hotspot output schema (M9)

Each `HotspotScore` entry in `ScanResult.hotspots` carries normalized scores plus raw metrics:

| Field                  | Source                          | JSON | Table         |
| ---------------------- | ------------------------------- | ---- | ------------- |
| `filePath`             | complexity entry                | yes  | yes           |
| `hotspotScore`         | harmonic mean of normalized c/h | yes  | yes           |
| `complexityNormalized` | log1p+min-max                   | yes  | yes (CpxN)    |
| `churnNormalized`      | log1p+min-max                   | yes  | yes (ChurnN)  |
| `cyclomaticComplexity` | `ComplexityResult`              | yes  | yes (Cpx)     |
| `functionCount`        | `ComplexityResult`              | yes  | yes (Funcs)   |
| `commitCount`          | `FileChangeStats`               | yes  | yes (Churn)   |
| `linesChanged`         | `FileChangeStats`               | yes  | no            |
| `authorCount`          | `FileChangeStats.authors.size`  | yes  | yes (Authors) |

JSON `version` remains `"1.0"` (additive fields).

## Enriched coupling (M14, M27)

After temporal coupling scoring, `enrichCouplingStaticDeps()` (`src/scoring/enrich-coupling-static.ts`) inspects working-tree sources under `repoPath` and sets static-dependency fields on each `CouplingPair`. Ranking (`couplingStrength`, `coChangeCount`, order) is unchanged — enrichment is post-score only. Path-alias resolution uses `TsconfigPathMap` (`src/scoring/tsconfig-path-map.ts`); display helpers live in `src/report/coupling-format.ts`.

| Field                               | Source                                  | JSON            | Table / markdown                | CSV                  |
| ----------------------------------- | --------------------------------------- | --------------- | ------------------------------- | -------------------- |
| `fileA`, `fileB`                    | coupling scorer                         | yes             | yes                             | yes                  |
| `coChangeCount`, `couplingStrength` | coupling scorer                         | yes             | yes                             | yes                  |
| `hasStaticDependency`               | static import/export/require resolution | yes (`boolean`) | yes (`yes`/`no` as `StaticDep`) | yes (`true`/`false`) |
| `staticDependencyDirection`         | edge direction (`fileA`/`fileB` identity) | yes (enum)    | yes (`none` / `a→b` / `b→a` / `both`) | yes          |
| `hasRuntimeStaticDependency`        | value import / `require` / value re-export | yes (`boolean`) | yes (in `Kinds` list)      | yes (`true`/`false`) |
| `hasTypeOnlyStaticDependency`       | `import type` / `export type … from`    | yes (`boolean`) | yes (in `Kinds` list)         | yes (`true`/`false`) |
| `hasReExportStaticDependency`       | `export … from` / `export * from`       | yes (`boolean`) | yes (in `Kinds` list)         | yes (`true`/`false`) |

**Invariants (every pair):** `hasStaticDependency === (hasRuntimeStaticDependency || hasTypeOnlyStaticDependency)`; `staticDependencyDirection === "none"` ⇔ all static flags are `false`; direction uses pair field names (`"a-to-b"` = `fileA` references `fileB`, not lexicographic path order).

- **Detection:** resolvable static `import`/`export … from`/`require` string literals from either file to the other; dynamic non-literal `import(expr)` / `require` unchanged (ignored); bare npm package specifiers without a matching alias do not set the flag
- **Resolution (relative, M14):** `./` / `../` specifiers → extensionless + common TS/JS extensions / `index`
- **Resolution (aliases, M27):** non-relative specifiers → nearest `tsconfig.json` / `jsconfig.json` walking up from the importer to `repoPath`; shallow `extends` merge for `compilerOptions.baseUrl` / `paths` (JSONC comments stripped); single-`*` path patterns; first existing candidate matching the peer path wins; no config / parse failure / unresolved alias → treat as miss (scan continues)
- **Edge kinds:** runtime vs type-only vs re-export classified from import/export form; mixed pairs set both runtime and type-only flags when applicable
- **Out of scope:** `package.json` `exports` / `imports`; PathAliasMap / rename graph (M26 boundary — renamed-but-unlinked paths may still report `false`)
- **Errors:** missing or unreadable source → no edge from that side; scan continues (optional `onWarning`)
- **Downstream:** JSON Schema requires all five static fields on coupling items — see [JSON Contract (M20)](#json-contract-m20)

## Function granularity (M11, M23)

`--granularity file|function` (default `file`) selects the active ranking array in `ScanResult`:

| Mode       | Active array                        | Inactive array  | `meta.granularity` |
| ---------- | ----------------------------------- | --------------- | ------------------ |
| `file`     | `hotspots: HotspotScore[]`          | `functions: []` | `"file"`           |
| `function` | `functions: FunctionHotspotScore[]` | `hotspots: []`  | `"function"`       |

Each `FunctionHotspotScore` entry carries per-function McCabe plus **per-function churn** (M23 hunk overlap):

| Field                                                     | Source                                                                                                          |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `filePath`, `functionName`, `line`, `complexity`          | `FunctionComplexityResult` from complexity analyzer (`endLine` is pipeline-internal for overlap)                |
| `hotspotScore`, `complexityNormalized`, `churnNormalized` | harmonic combiner over all functions (same formula as file mode)                                                |
| `commitCount`, `linesChanged`, `authorCount`              | `FunctionChangeStats` from hunk-overlap miner (`src/git/function-churn/`) — **not** inherited parent file stats |

**Function-mode git:** after complexity, `createFunctionChurnMiner()` streams `git log -M -p --unified=0`, attributes commits whose hunks intersect each function's current `[line, endLine]`, then `scoreFunctionHotspots()` consumes the per-function map. When renames or ambiguous paths were observed, the miner adds the pós-rename overlap confidence warning (see [Rename confidence (M26)](#rename-confidence-m26-rt-003)). File mode does **not** spawn the patch stream.

`coupling` remains file-pair ranked in both modes. `--top` slices the active ranking array at render time via `sliceScanResult` for **table and markdown only**; JSON and CSV receive full arrays.

### Function AST collection (M22, M29)

`collectFunctionsInScope` in `analyze-file.ts` enumerates callable bodies for per-function McCabe and file-level sums. M22 and M29 extended collection beyond M11 without changing the McCabe decision-node definition in `mccabe.ts` (RT-005) — only **which** nodes are collected.

| Construct                                             | Collected | `functionName`                                                   |
| ----------------------------------------------------- | --------- | ---------------------------------------------------------------- |
| `function foo()`                                      | yes (M11) | `foo`                                                            |
| `class Foo { bar() {} }`                              | yes (M11) | `bar`                                                            |
| `constructor() {}`                                    | yes (M11) | `constructor`                                                    |
| `const foo = () => {}`                                | yes (M11) | `foo`                                                            |
| Anonymous arrow / function expression                 | yes (M11) | `<anonymous>:L{line}`                                            |
| Class `get foo()` / `set foo()`                       | yes (M22) | `foo` (bare accessor name; disambiguate getter/setter by `line`) |
| `class C { foo = () => {} }` or `foo = function() {}` | yes (M22) | `foo`                                                            |
| `const o = { bar() {} }`                              | yes (M22) | `bar`                                                            |
| `const o = { baz: () => {} }`                         | yes (M22) | `baz`                                                            |
| Object property anonymous function                    | yes (M22) | `<anonymous>:L{line}`                                            |
| `const C = class { bar() {} }` (ClassExpression)      | yes (M29) | same as `ClassDeclaration` members (`bar`, `constructor`, accessor/field names) |
| `const o = { get foo() {}, set foo(v) {} }`           | yes (M29) | `foo` (bare accessor name; disambiguate getter/setter by `line`) |
| `handler = function named() {}`                       | yes (M29) | `handler` (LHS Identifier; inner `FunctionExpression` name ignored) |
| `obj.fn = () => {}` / `exports.foo = function() {}`   | yes (M29) | PropertyAccess rightmost name (`fn`, `foo`)                      |
| `obj[expr] = () => {}`                                | yes (M29) | `<anonymous>:L{line}`                                            |
| Body-less non-abstract overload / ambient stubs       | no (M29)  | — (signature-only `function foo();` / body-less methods skipped; implementations and abstract empty-body accessors remain) |

Assignment RHS collection uses plain `=` only (`||=`, `&&=`, `??=` out of scope). Nested object literals and class expressions recurse with the same policy as nested functions. Non-callable property initializers are skipped. Fixtures with manually verified complexities: M22 — `getters-setters.ts`, `class-field-arrows.ts`, `object-literal-methods.ts`; M29 — `class-expressions.ts`, `object-literal-accessors.ts`, `assignment-callables.ts`, `overloads.ts`, `namespace-module.ts`. Naming SoT: [function-granularity/context.md](../features/function-granularity/context.md) (M11 base) + [function-ast-coverage/context.md](../features/function-ast-coverage/context.md) (M22) + [function-ast-coverage-plus/context.md](../features/function-ast-coverage-plus/context.md) (M29).

## Export formats (M10, M17, M18)

- **`--format markdown`** — GFM report with hotspot and coupling tables (includes `linesChanged` column)
- **`--format csv`** — multi-file CSV bundle (M18): `renderCsv()` / `renderCompareCsv()` return a `CsvBundle` (`Record<suffix, content>`); CLI derives stem from `--output` and writes `{stem}.meta.json` plus ranking/coupling CSVs; **requires `--output`**; `--top` ignored (full export); no section title rows
- **Scan bundle** (`--output out/report.csv`): `out/report.meta.json`, `out/report.hotspots.csv` or `out/report.functions.csv`, `out/report.coupling.csv`
- **Compare bundle** (`--output out/compare.csv`): `out/compare.meta.json` plus six data CSVs (`hotspots.*` or `functions.*`, plus `coupling.*`); empty sections are header-only files
- **`--output <path>`** — write report to file (`table`, `json`, `markdown`, `csv`); stdout silent for report content; csv is the only format that **requires** `--output`
- **Reporter module**: `CsvBundle` type in `src/report/csv-bundle.ts`; `renderCsv()` / `renderCompareCsv()` in `csv.ts` / `compare-csv.ts`; `createReporter()` returns `string | CsvBundle` (JSON and CSV bypass slice helpers; table/markdown slice via `sliceScanResult` / `sliceCompareResult`)
- **Path validation**: parent directory must exist; directory targets rejected; overwrite is default

## JSON Contract (M20)

Published JSON Schema files under `schemas/` define the CLI JSON contract:

| File                          | Root type       |
| ----------------------------- | --------------- |
| `schemas/scan-result.json`    | `ScanResult`    |
| `schemas/compare-result.json` | `CompareResult` |

- **Coupling items** require `hasStaticDependency` plus M27 enrichment fields (`staticDependencyDirection`, `hasRuntimeStaticDependency`, `hasTypeOnlyStaticDependency`, `hasReExportStaticDependency`) in both schemas
- **`additionalProperties: true`** on objects for forward compatibility; `required` lists enforce the minimum contract
- **`ScanMeta.warnings`** — required `ScanWarning[]` on scan results (M28); compare meta uses the same `$defs.ScanWarning`
- **Contract tests** (`tests/contract/`) validate scan and compare JSON against these schemas in CI
- **Baseline loading** (`loadBaseline()` / `parseScanResult()` in `src/compare/load-baseline.ts`): strong structural validation on nested hotspot, function, and coupling items — not only top-level keys. Wrong types or missing required fields (including all coupling static fields) throw `BaselineError` with a path-specific message; coupling items missing any required static field instruct the user to re-scan with a current scanner version. Pre-M14 / pre-M27 baselines are not auto-migrated.

## Scan compare (M13)

- **`--baseline <path>`** — compare current scan against a saved `ScanResult` JSON (from a prior `--format json --output` run)
- **Compare module** (`src/compare/`): `loadBaseline()` validates and parses baseline JSON (see [JSON Contract (M20)](#json-contract-m20)); `compareScanResults()` classifies entities as `new`, `removed`, or `rankChanged`
- **CompareResult** schema (`version: "1.0"`): separate from `ScanResult`; sections for hotspots/functions (mode-dependent) and coupling pairs
- **Entity keys**: file path for hotspots; `filePath + functionName + line` for functions; canonical `(fileA, fileB)` for coupling
- **Guards**: granularity mismatch → hard error; `since` mismatch → `ScanWarning` with `COMPARE_SINCE_MISMATCH` in `meta.warnings` (stderr + report)
- **`--top`** on compare output slices delta arrays at render time via `sliceCompareResult()` for **table and markdown only** — classification uses full rankings; JSON and CSV receive unsliced deltas
- **Reporter**: `createReporter().renderCompare()` dispatches to `compare-table`, `compare-json`, `compare-markdown`, `compare-csv` (JSON and CSV bypass slice helpers; `--top` ignored)
