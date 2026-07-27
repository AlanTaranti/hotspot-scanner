# ARCHITECTURE — @vitals/hotspot-scanner

## Container view

```mermaid
flowchart TB
  Dev[Developer]
  CLI[hotspot-scanner CLI]
  Repo[(Local Git repo)]

  Dev -->|"init / doctor / scan / baseline save / compare / completion"| CLI
  CLI -->|"git log stream"| Repo
  CLI -->|"file read + NCLOC"| Repo
  CLI -->|"stdout / file"| Dev

  subgraph internal [Internal modules]
    GitMiner[Git Change Miner]
    Size[Size Analyzer — NCLOC]
    Hotspot[Hotspot Scorer]
    Reporter[Reporter]
    Doctor[Doctor]
    ScanPreview[Scan scope preview]
  end

  CLI --> Doctor
  CLI --> ScanPreview
  CLI --> GitMiner
  CLI --> Size
  GitMiner --> Hotspot
  Size --> Hotspot
  Hotspot --> Reporter
```

## Pipeline (M57)

```
git log (streaming numstat) → NCLOC size analysis (file-level) → hotspot score → report
```

Optional `--baseline` → compare → delta report. JSON contract **`version: "3.0"`** with `ncloc` on each hotspot. **File hotspots only** — no function granularity, no McCabe, no `ts-morph`.

## CLI commands (M39–M40)

Multi-command CLI via Commander in `bin/hotspot-scanner.ts` with shared wiring in `bin/scan-actions.ts` (flags, I/O, exit mapping only — no domain logic):

| Command | Module | Behavior |
| ------- | ------ | -------- |
| `init [dir]` | `src/config/exemplar.ts` (`writeInitConfig`) | Writes schema-linked exemplar `.hotspot-scanner.json` (`$schema`, `$comments`, realistic `include`/`exclude`); refuses overwrite without `--force` |
| `config validate [path]` | `src/config/validate-config.ts` (`validateHotspotScannerConfigFile`) | Parse/validate config file or directory walk; exit `0` valid / `2` invalid or missing; **does not** require git |
| `config print [path]` | `src/config/print-config.ts` + `merge-options.ts` (`loadMergedScanConfigWithSources`) | Effective merged `since`/`include`/`exclude`/`top`/`concurrency` with per-field `cli` \| `config` \| `default` source tags; `-f, --format text\|json`; scan-like CLI overrides (`--since`, `--include`, `--exclude`, `--top`, `--concurrency`, `--config`); **does not** require git or invoke pipeline stages |
| `doctor [path]` | `src/doctor/` (`runDoctor`, `formatDoctorJsonReport`) | Pre-flight checks: Node `engines`, git on PATH, git repo via shared `resolveScanPipelineContext`, config discovery/validity (unknown keys soft-warn), **`since`** preflight via `probeSinceWindow` (pass / empty warn / git-reject fail), **`scope`** inventory (`previewScanScope` — eligible count parity with `scan --dry-run`), tsconfig/jsconfig info; optional `--include-tests`; `-f, --format text\|json`; aggregate exit policy; **does not** invoke Git Change Miner, size analyzer, scorers, or Reporter |
| `scan [path]` | `src/scan.ts` (`runScan`) via `bin/scan-actions.ts` | Full pipeline (see [Data flow (scan)](#data-flow-scan)); optional `--baseline` → compare path |
| `scan --dry-run` | `src/scan-preview.ts` (`previewScanScope`) | Merges config, validates repo + git, builds `PathScope`, counts via `discoverSourceFiles`; prints config file path (or `none`), remount message when present, unknown config keys when present — **does not** mine git or run NCLOC |
| `baseline save <path>` | `runScan()` + `bin/scan-actions.ts` | Runs full scan, writes loadable `ScanResult` JSON; `--output` default `./hotspot-baseline.json`; `--quiet` / `--no-progress` / `--verbose` / `--warnings` parity with scan (M63) |
| `compare <path> --baseline <file>` | `runScan()` + `src/compare/` + `src/report/` via `bin/scan-actions.ts` | Same compare-and-render sequence as `scan --baseline` |
| `completion <shell>` | `bin/completion-scripts.ts` (`getCompletionScript`) | Static bash/zsh/fish completion script to stdout |

**Path-first argv (M63).** `maybeRewritePathToScan()` in `bin/hotspot-scanner.ts` rewrites `hotspot-scanner <path> …` to `hotspot-scanner scan <path> …` when the first token is `.`, `./…`, absolute, or an existing directory (not a known subcommand, help/version, or flag). Bare invocation (`argv.length <= 2`) still throws help `CliUsageError` (exit `2`).

**Shell completion drift control (M54 + M63).** `bin/completion-scripts.ts` owns bash/zsh/fish scripts; zsh and fish long-flag lists must stay aligned with bash `SCAN_FLAGS` (and baseline subset). Unit tests assert representative flags in all three shells when adding CLI surface.

`--dry-run` rejects `--baseline` (`CliUsageError`); `--format` / `--output` are ignored (plain-text preview on stdout).

## Data flow (scan)

1. CLI dispatches commands; shared scan/compare wiring in `bin/scan-actions.ts`. Scan flags include `--since`; `-f` / `--format`; `-t` / `--top`; `--include` / `--exclude`; `--config`; `--concurrency`; `-o` / `--output`; `--baseline`; `--only`; `--no-triage-hints`; `--no-color`; `--explain`; `--fail-on-explain-miss`; `--strict`; `--dry-run`; `--quiet`; `--no-progress`; `--verbose`; `--warnings`; `--csv-single-file`; `--sequential` / `--no-overlap`.
2. **Monorepo path resolve + config (M43 + M21 + M30)** — `resolveScanPipelineContext()`:
   - `validateRepoPath` → `resolveMonorepoScanPath` → `loadHotspotScannerConfig` (walk from request path) → `mergeScanOptions` (CLI > config > defaults for `since`, `include`, `exclude`, `top`, `concurrency`)
   - Auto-include `{packagePrefix}/**` when remounted and CLI `include` unset
   - Unknown config keys → warn-only `UNKNOWN_CONFIG_KEY` (leftover `granularity` from pre-M57 configs is ignored)
3. **`runScan()`** builds `PathScope`, then:
   - **Overlap (default)** — `GitMiner.mine` (numstat) ∥ `ComplexityAnalyzer.analyze` (NCLOC) under shared `AbortController`; sibling abort on first failure
   - **Sequential opt-out** — `--sequential` / `--no-overlap` runs git then size analysis sequentially
   - **Git Change Miner** — one `git log -M --numstat` stream → `FileChangeStats`; `PathAliasMap` for renames; `filterGitMinerResult()` by `PathScope`; `onProgress({ phase: "git", commitsProcessed })`
   - **Size analyzer (`src/complexity/`)** — discovers in-scope TS/JS files (`git ls-files` preferred, walk fallback); reads file text; `countNcloc()` per file; optional worker-thread pool (`--concurrency`); unreadable files → `READ_FAILED` warning + skip (omit from hotspots); `onProgress({ phase: "complexity", filesProcessed, batchesProcessed, … })`
   - **Post-barrier** — `createHotspotScorer().score(fileStats, nclocResults)` → `ScanResult.hotspots`; `meta.timings` (`gitMs`, `complexityMs`, `totalMs`); `meta.scannerVersion` from cached `getPackageVersion()` (`src/package-meta.ts`)
4. CLI passes `ScanResult` to **Reporter** (`--top` at render time for table/markdown only)
5. With `--baseline` or `compare`, loads baseline, `compareScanResults()`, `renderCompare()`
6. With `--explain <path>`, file-path breakdown on stderr after report (compare mode: delta classification)

### Config file (M21 + M30 + M64)

- **Filename:** `.hotspot-scanner.json` only
- **Keys:** `since`, `include`, `exclude`, `top`, `concurrency` — map to CLI semantics
- **Reserved meta (M64):** `$schema`, `$comment`, `$comments` — name-based skip in `parseHotspotScannerConfig`; not merged, not listed in `unknownKeys`, never emit `UNKNOWN_CONFIG_KEY`
- **Load path:** `LoadedHotspotScannerConfig.path` — absolute path when discovered or explicit; `null` when none
- **Schema:** `schemas/hotspot-scanner-config.json` (`$id` `https://vitals.dev/hotspot-scanner/schemas/hotspot-scanner-config.json`); package export `./schemas/hotspot-scanner-config.json`; init exemplar links `$schema` to that URI
- **CLI-only:** `format`, `output`, `baseline`, `--only`, `--no-triage-hints`, `--no-color`, `--explain`, `--fail-on-explain-miss`, `--strict`, `quiet`, `no-progress`, `verbose`, `warnings`, `csv-single-file`, `sequential`, `includeTests`, `version`
- **Removed (M57):** `granularity` — unknown key, warn-only

### Path scoping (M7 + M30 + M43 + M46 + M48 + M67)

- **Eligible extensions:** `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.mts`, `.cts` (`ELIGIBLE_EXTENSIONS` in `src/complexity/discover.ts`)
- Default artifact and test excludes; `--include-tests` lifts test globs only
- **Built-in test globs:** `DEFAULT_TEST_EXCLUDE_PATTERNS` in `src/paths/scope.ts` — legacy `.ts`/`.tsx`/`.js`/`.jsx` test/spec patterns, `__tests__/`, plus mjs/cjs/mts/cts test/spec parity patterns (M67)
- **No ignore file (M54):** use config `exclude` / CLI `--exclude`
- **Monorepo remount (M43):** nested package cwd → git root + auto-include unless CLI `--include` set

## Key constraints

- Single **numstat** Git log pass for file churn (ADR-2026-020)
- Find-renames (`-M`) on numstat spawn; **no** global `git log --follow`
- Working-tree source only (not historical file versions)
- Unreadable source: `READ_FAILED` warning + skip file (no stub hotspot row)
- Streaming required for large repos (RT-001)
- NCLOC batches via persistent `worker_threads` pool when `concurrency > 1` (M15 + M31)

## Rename confidence (M26, RT-003)

File git miner uses `PathAliasMap` (`src/git/rename.ts`) and `src/git/rename-warnings.ts`. M50 heuristic linking for unlinked delete+add pairs. Warnings use `code: "RENAME_HISTORY_INCOMPLETE"`. M42 appends next-step sentences — codes unchanged.

### Git argv

| Miner | Spawn builder | find-renames | `--follow` |
| ----- | ------------- | ------------ | ---------- |
| File (numstat) | `buildGitLogArgv` in `src/git/spawn.ts` | `-M` | **forbidden** |

### Git spawn failure hints (M65)

When `git log` or `git ls-files` spawn exits non-zero, `GitLogError` (`src/git/spawn.ts`) and `GitLsFilesError` (`src/git/ls-files.ts`) build `message` via `formatGitStderrHint` in `src/git/git-error-hint.ts`:

- **since/date** → fix `--since` or config `since` (relative window or ISO date)
- **shallow** → deepen clone or re-clone without depth limits
- **corrupt / bad-object** → `git fsck` or re-clone

First-match priority: since/date → shallow → corrupt. Unmatched or empty stderr: no `Hint:` line (message shape unchanged). The `stderr` property stays raw git text; only `message` is enriched.

**CLI:** bin prints `error.message` only — no git stderr pattern switches in `bin/`. Exit code for spawn failures remains **1**.

**Sister boundaries (do not duplicate):** M38 `Hint:` tone on resolve-repo not-a-git and `CliUsageError` / `ConfigError` paths; M64 doctor `since` preflight via `probeSinceWindow` (catches invalid `since` before scan). M65 covers scan-time hard spawn failures only — no dedicated not-a-git pattern.

## Diagnostics (M28 + M51 + M58 + M59 + M61 + M63)

Module: `src/diagnostics/` (`logger.ts`, `warning-summary.ts`).

### CLI stderr warning sink (M58 + M63)

`createCliDiagnosticHandlers({ quiet, noProgress, warningsMode, stderrIsTTY?, stderrColumns? })` is **presentation-only**:

- Pipeline / miner still emit the full `ScanWarning[]` into `meta.warnings` and programmatic `onWarning`.
- CLI `--warnings summary` (default) buffers warning/error during the scan. `emitWarningTeaser()` writes one short rollup line (`formatWarningSummaryLine`) immediately before report write; `flushWarnings()` after write emits one aggregated stderr line per `(code, subKind)` group.
- `--warnings full` logs each warning immediately (after clearing any live progress line); `flushWarnings()` clears live progress only — does not re-emit streamed lines.
- `--warnings json` (M63) buffers warnings; `flushWarnings()` after write writes one JSON document to stderr: `{"warnings":ScanWarning[]}` (empty → `{"warnings":[]}`); no teaser. `--quiet` still suppresses info-level entries before buffering.
- Not a config key; does not change the JSON contract.

### Ephemeral TTY progress (M59 + M61)

When `stderrIsTTY` is true (default: `process.stderr.isTTY === true`, injectable in tests):

- Progress for `git`, `complexity`, and `finalize` phases overwrites **one live stderr line** (`\x1b[2K\r` + text; no trailing newline while live).
- **Complexity** (M61): inline fill bar when `totalFiles` is known — TTY `█`/`░`, non-TTY `#`/`-`; honest `filesProcessed/totalFiles` (+ batch when known); omit bar when total unknown; no overall scan percentage.
- **Git** (M61): indeterminate counter only (`git N commits…`); no bar or fake %.
- **Finalize** (M61): body `Finalizing…`; emitted once post-barrier in `runScan`; bypasses throttle; survives through score / compare / render until deferred flush.
- Bar width from `stderrColumns` (default `process.stderr.columns`, injectable) via `resolveProgressBarWidth` (clamped 10–40; fallback 80 columns).
- The live line is cleared on `flushWarnings()`, before handler-driven warning/error/info stderr writes (`warnings=full`), and on phase switch.
- Non-TTY (piped/CI) keeps `\n`-terminated progress lines unchanged (ASCII bar on complexity when total known).
- `--quiet` / `--no-progress` suppress progress entirely (TTY or not), including finalize. Git/complexity throttle intervals unchanged.

### Deferred progress flush (M61 + M68 bookend)

`executeScan` returns `emitWarningTeaser` and `flushWarnings` without calling them before render/write:

| Path | Order (success) |
| ---- | ----------------- |
| `scan` | `emitWarningTeaser()` → write → `flushWarnings()` → timing stderr → `--explain` |
| `compare` / `scan --baseline` | same inside `executeCompareAndRender` |
| `baseline save` | `emitWarningTeaser()` → `writeBaselineJson` → `flushWarnings()` |

M58 clear-before-warning/error/info unchanged. `emitWarningTeaser()` clears live progress and writes the short rollup under `summary` only.

### Table File column (M60)

Scan and compare **table** formats use `src/report/path-column.ts` for the File column:

- **Middle-ellipsis** (Unicode `…`) keeps a path prefix and basename when the path exceeds the column width (e.g. `src/api/v1/…/schema.ts`).
- **Width** derives from `process.stdout.columns` minus a fixed non-File budget (56 chars for scan numeric columns), clamped 16–64; fallback **24** when columns are missing/invalid (pipes, CI).
- Injectable `stdoutColumns` on `renderTable` / `renderCompareTable` options for tests (parity with M59 `stderrIsTTY`).
- Markdown / JSON / CSV emit full paths unchanged.

### Progress phases

| `phase` | Emitter | Counter / body |
| ------- | ------- | -------------- |
| `git` | `GitMiner` numstat stream | `commitsProcessed` — indeterminate counter, no bar |
| `complexity` | Size analyzer / worker pool | `filesProcessed`, `batchesProcessed`, optional `totalFiles` / `totalBatches`; fill bar when total known; `commitsProcessed` is `0` |
| `finalize` | `runScan` post-barrier (once) | `commitsProcessed: 0`; body `Finalizing…`; through score / compare / render until deferred flush |

### Stage timings

```ts
interface ScanStageTimings {
  gitMs: number;
  complexityMs: number;
  totalMs: number;
}
```

File-mode overlap: `gitMs` + `complexityMs` may sum above `totalMs`.

**Presentation (HOTSPOT-1042):** Table and markdown executive summaries include a Timing line when `meta.timings` is present; after successful scan/compare the CLI may echo a brief one-line total on stderr (suppressed under `--quiet`). JSON and CSV payloads unchanged.

### Stable warning codes (M28+ / M57)

| Code | Emitter | Operator interpretation |
| ---- | ------- | ----------------------- |
| `EMPTY_SINCE_WINDOW` | git | No commits in `--since`; widen window |
| `RENAME_HISTORY_INCOMPLETE` | git | Rename tracking incomplete |
| `READ_FAILED` | size analyzer | File I/O failed — file omitted from hotspots |
| `COMPARE_SINCE_MISMATCH` | compare | Baseline/current `since` differ — `--strict` exits `1` after report |
| `MONOREPO_PATH_REMOUNT` | scan prelude | Remounted to git root; auto-include when applicable |
| `UNKNOWN_CONFIG_KEY` | config load | Unknown key(s) — not applied; includes legacy `granularity` |

### Explain breakdown (M42 + M53 + M63)

`--explain <path>` — file path only (repo-relative or absolute under repo). Compare mode explains delta sections (`new` / `removed` / `rank-changed`). `path:function` syntax rejected (`CliUsageError`). Default miss prints not-found on stderr and exits `0` on success; `--fail-on-explain-miss` (M63) exits `1` when target missing (requires `--explain`).

### CSV single-file write path (M63)

`--csv-single-file` with `--format csv` and `--output` is a **bin write-path** choice in `writeRenderedOutput` (not a new `renderCsv` layout): scan writes `hotspots.csv` bundle key to exact `--output`; compare writes `hotspots.new.csv` only. Default M18 stem bundle unchanged when flag omitted.

## Size analysis stage (M57)

```mermaid
flowchart LR
  Discover[discoverSourceFiles] --> Chunk[chunk 50 files]
  Chunk --> Pool["createWorkerPool"]
  Pool --> W1["worker: read + countNcloc"]
  Pool --> W2["worker N"]
  W1 --> Merge[merge by discovery index]
  W2 --> Merge
```

- **Module:** `src/complexity/ncloc.ts` (`countNcloc`), `analyze-file.ts`, `analyze-batch.ts`, `pool.ts`, `worker.ts`
- **NCLOC definition (RT-005):** single-pass state machine — blank lines and comment-only lines do not count; code + trailing `//` counts; `//` inside strings still counts when line has code
- **No AST:** plain text read; no parse-failed stubs

## Orchestration

`src/scan.ts` overlaps git mining and NCLOC analysis by default (M34); `--sequential` opts out (M49). Function mode, function-churn patch stream, and McCabe paths **removed** (M57).

## Hotspot output schema (M57)

Each `HotspotScore` in `ScanResult.hotspots`:

| Field | Source | JSON | Table |
| ----- | ------ | ---- | ----- |
| `filePath` | size result | yes | yes |
| `hotspotScore` | harmonic mean of normalized c/h | yes | yes |
| `complexityNormalized` | log1p+min-max on NCLOC | yes | yes (NLOCN) |
| `churnNormalized` | log1p+min-max | yes | yes (ChurnN) |
| `ncloc` | `ComplexityResult` | yes | yes (NLOC) |
| `commitCount` | `FileChangeStats` | yes | yes (Churn) |
| `linesChanged` | `FileChangeStats` | yes | markdown |
| `authorCount` | `FileChangeStats.authors.size` | yes | yes (Authors) |

JSON `version` is **`"3.0"`**. Field name `complexityNormalized` retained for the normalized size axis `c` (harmonic formula unchanged).

## Export formats (M10, M17, M18, M41, M53)

- **Scan CSV bundle:** `{stem}.meta.json` + `{stem}.hotspots.csv` only (no functions sidecar)
- **Compare CSV bundle:** `compare.meta.json` + hotspot delta trio (`new`, `removed`, `rank-changed`)
- **`--only hotspots`** — only valid section (functions rejected)
- **Triage:** scan rule `dual-signal-hotspot`; compare rules `new-dual-signal`, `rank-worsened`

## JSON Contract (M20 + M57 + M64 + M66)

| File | Root type |
| ---- | --------- |
| `schemas/scan-result.json` | `ScanResult` |
| `schemas/compare-result.json` | `CompareResult` |
| `schemas/hotspot-scanner-config.json` | `.hotspot-scanner.json` config (known keys + reserved meta) |

- **Scan/compare `version: "3.0"`** — `hotspots` + `meta` only; no `functions`, no `granularity`, no `coupling`. **No version bump for M66** — enrichments are additive under `"3.0"` (same pattern as M51 `meta.timings`).
- **Config schema (M64):** documents known keys and reserved meta; `additionalProperties: true` (runtime still warns unknowns); package exports all three schema subpaths
- **Baseline reject:** `1.0`, `2.0`, top-level `coupling`, `cyclomaticComplexity`, `functions`, `parseFailed`, `functionCount` → `BaselineError` + re-scan
- **Contract tests:** `tests/contract/json-schema.test.ts` (scan, compare, config)

### Additive fields under `3.0` (M66)

| Field | Where | Emission / read |
| ----- | ----- | --------------- |
| `meta.scannerVersion` | `ScanMeta`, `CompareMeta` | Always on fresh scan/compare (`getPackageVersion()`); optional in schema for baseline-era docs; preserved when string on load |
| Top-level `$schema` | JSON render only | `renderJson` / `renderCompareJson` inject URL matching schema `$id`; not on in-memory domain types; ignored on baseline parse |
| `scoreDelta`, `nclocDelta`, `commitCountDelta` | `RankChange<HotspotScore>` in compare `rankChanged` | Always on new compares; **not** on `new` / `removed` |

**`$schema` URLs** (`src/report/schema-urls.ts`):

| Payload | URL |
| ------- | --- |
| Scan JSON | `https://vitals.dev/hotspot-scanner/schemas/scan-result.json` |
| Compare JSON | `https://vitals.dev/hotspot-scanner/schemas/compare-result.json` |

**Baseline tolerance:** `loadBaseline` / `parseScanResult` accept `3.0` scans without `scannerVersion` or top-level `$schema`; when `scannerVersion` is present as a string it is preserved on parsed `ScanMeta` (parity with optional `timings`). Non-string `scannerVersion` when the key is present → `BaselineError`.

## Scan compare (M13, M40, M66)

- `baseline save`, `compare --baseline`, `scan --baseline` — hotspots-only deltas
- Entity key: file path
- `since` mismatch → `COMPARE_SINCE_MISMATCH` in `meta.warnings`
- `--top` slices table/markdown only; JSON/CSV full deltas
- **`rankChanged` metric deltas (M66):** each item includes `scoreDelta`, `nclocDelta`, `commitCountDelta` computed as **current − baseline** from the two `ScanResult` hotspot entries. **`entity` remains the baseline `HotspotScore`** (absolute Score/NLOC/Churn columns in table/markdown/CSV use `entity.*`). Reconstruct current metrics: `entity.hotspotScore + scoreDelta`, `entity.ncloc + nclocDelta`, `entity.commitCount + commitCountDelta`. Same-rank files are omitted from `rankChanged` (unchanged). Compare `meta.scannerVersion` records the package version that produced the compare output.
