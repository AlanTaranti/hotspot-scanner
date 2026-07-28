# INTEGRATIONS — @vitals/hotspot-scanner

External dependencies and adapter boundaries. No network integrations (zero-network product policy).

## worker_threads (Node.js built-in)

| Aspect      | Detail                                                                                                                 |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Role**    | Parallel batch processing in size analysis stage (M15)                                                                 |
| **Adapter** | `createWorkerPool` in `src/complexity/pool.ts`; worker entry `src/complexity/worker.ts`                                |
| **Default** | `DEFAULT_WORKER_CONCURRENCY` = `min(availableParallelism(), 8)`                                                        |
| **Override**| CLI `--concurrency` or config `concurrency` (M28) → `runScan()` → `createComplexityAnalyzer({ concurrency })`          |
| **Rule**    | Do not spawn worker threads outside `src/complexity/`                                                                  |
| **Failure** | Worker error → reject `analyze()` with `repoPath` and batch path context                                               |
| **Tests**   | Mock `createWorkerPool` at `ComplexityAnalyzer` boundary; `worker.ts` excluded from coverage (runs in separate thread) |

## Git (local binary)

| Aspect         | Detail                                                                                |
| -------------- | ------------------------------------------------------------------------------------- |
| **Role**       | `git log --numstat` for per-file churn (rename lines parsed from numstat output) |
| **Adapter**    | `GitMiner` in `src/git/`                                                              |
| **Invocation** | `child_process.spawn` in `src/git/spawn.ts` — streaming parse                         |
| **Rule**       | Do not spawn git subprocess outside `src/git/` **except** documented adapters (`src/paths/resolve-repo.ts` for `rev-parse --show-toplevel`). **Do not** parse git stderr or add git-error pattern switches in `bin/` — CLI prints `error.message` only |
| **Failure**    | Spawn failures → `GitLogError` / `GitLsFilesError` with repo path, command, raw `stderr`, and optional `\nHint: …` when `formatGitStderrHint` matches (M65); exit `1`. Not-a-git → `resolve-repo` (M38). Invalid `since` at doctor time → `probeSinceWindow` (M64) |
| **Tests**      | Mock subprocess at `GitMiner` boundary; fixtures for parse logic; `git-error-hint.test.ts` for stderr→Hint mapping |

### Git toplevel detection (M43, monorepo remount)

| Aspect         | Detail                                                                                |
| -------------- | ------------------------------------------------------------------------------------- |
| **Role**       | `git rev-parse --show-toplevel` to resolve pipeline `repoPath` when scan path is nested inside a git workspace |
| **Adapter**    | `resolveMonorepoScanPath` in `src/paths/resolve-repo.ts`                              |
| **Invocation** | `child_process.execFile` — `git -C <requestPath> rev-parse --show-toplevel`         |
| **Rule**       | Do not spawn `rev-parse` outside `src/paths/resolve-repo.ts`                          |
| **Tests**      | Inject `detectGitToplevel` in `resolve-repo.test.ts`; integration via `scan.test.ts` |

### Since-window probe (M64, doctor preflight)

| Aspect         | Detail                                                                              |
| -------------- | ----------------------------------------------------------------------------------- |
| **Role**       | Lightweight `git log -1 --since=…` to validate effective merged `since` before scan |
| **Adapter**    | `probeSinceWindow` in `src/git/probe-since.ts`                                        |
| **Invocation** | `child_process.spawn` — `git -C <repoPath> log -1 --since=<since> --format=%s`     |
| **Mapping**    | exit 0 + stdout → `ok`; exit 0 + empty stdout → `empty` (doctor soft warn); non-zero → `invalid` (doctor hard fail) |
| **Consumer**   | `src/doctor/index.ts` (`since` finding) — skipped when git-repo prelude already failed |
| **Tests**      | Mock `spawn` in `probe-since.test.ts`; doctor unit tests inject probe boundary |

### Git stderr hints (M65, scan-time spawn failures)

| Aspect         | Detail                                                                                |
| -------------- | ------------------------------------------------------------------------------------- |
| **Role**       | Append actionable `\nHint: …` to `GitLogError` / `GitLsFilesError` `message` when stderr matches locked families (since/date, shallow, corrupt) |
| **Adapter**    | `formatGitStderrHint` in `src/git/git-error-hint.ts`; called from error constructors in `spawn.ts` and `ls-files.ts` |
| **Rule**       | Enrichment owned by `src/git/` only — **forbidden** in `bin/` (no ad-hoc git stderr parsing outside `src/git/`) |
| **Boundaries** | Not-a-git `Hint:` remains on `resolve-repo` (M38). Doctor `since` preflight remains `probeSinceWindow` (M64). M65 does not add a dedicated not-a-git pattern or doctor probe |
| **Tests**      | `git-error-hint.test.ts`; constructor assertions in `spawn.test.ts` and `ls-files.test.ts` |

### Tracked file listing (M36, discovery)

| Aspect         | Detail                                                                              |
| -------------- | ----------------------------------------------------------------------------------- |
| **Role**       | `git ls-files -z` for tracked-path discovery before size analysis                   |
| **Adapter**    | `listTrackedFiles` in `src/git/ls-files.ts`                                         |
| **Invocation** | `child_process.spawn` — `git -C <repoPath> ls-files -z`; null-delimited stdout parse |
| **When**       | `discoverSourceFiles` primary path in Git repos; silent walk fallback on failure      |
| **Tests**      | Mock `spawn` in `ls-files.test.ts`; inject `listTrackedFiles` in `discover.test.ts` |

### File history (M72, complexity trend)

| Aspect         | Detail                                                                                |
| -------------- | ------------------------------------------------------------------------------------- |
| **Role**       | Per-file revision list + blob contents for `runComplexityTrend` (indentation + NCLOC series) |
| **Adapter**    | `listFileRevisions` / `showFileAtRevision` in `src/git/file-history.ts`              |
| **Invocation** | `child_process.spawn` — path-scoped `git log` with **`--follow` default**; `git show <rev>:path` for historical blobs |
| **Rule**       | Trend-only — **forbidden** to add `--follow` to scan numstat `buildGitLogArgv` in `spawn.ts` |
| **Tests**      | Co-located `file-history` / trend tests; fixture `tests/fixtures/repos/trend-indent/` |

## commander

| Aspect       | Detail                                                            |
| ------------ | ----------------------------------------------------------------- |
| **Role**     | CLI flag parsing                                                  |
| **Location** | `bin/hotspot-scanner.ts` (+ `bin/*-actions.ts` wiring)            |
| **Rule**     | No domain logic in bin — delegate to `runScan`, `runComplexityTrend`, `runAssess`, `runDoctor`, and config helpers in `src/` |

## Scan result parse (`src/scan-result/`)

| Aspect      | Detail                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------- |
| **Role**    | Validate programmatic scan JSON (`version: "3.0"`) via `parseScanResult`                     |
| **Adapter** | `parseScanResult` / `ScanResultParseError` in `src/scan-result/parse-scan-result.ts`         |
| **Rule**    | No auto-migration of legacy shapes; reject unsupported fields (`coupling`, `functions`, etc.) |
| **Failure** | `ScanResultParseError` with scan-oriented re-scan hint (no CLI loader — library-only)        |
| **Tests**   | Co-located `parse-scan-result.test.ts`; contract tests validate schema separately            |

## picomatch

| Aspect      | Detail                                                                              |
| ----------- | ----------------------------------------------------------------------------------- |
| **Role**    | Glob pattern matching for path scoping (`--include`, `--exclude`, default excludes) |
| **Adapter** | `src/paths/scope.ts` only                                                           |
| **Version** | `picomatch@^4` (runtime dependency)                                                 |
| **Rule**    | Do not import picomatch outside `src/paths/`                                        |
| **Tests**   | Real pattern behavior in `src/paths/scope.test.ts`                                  |

## Removed integrations (M57)

| Dependency | Former role | M57 outcome |
| ---------- | ----------- | ----------- |
| **ts-morph** | AST + McCabe in `src/complexity/` | **Removed** — NCLOC uses plain file read + state machine (`ncloc.ts`) |
| **Function-churn patch stream** | `git log -p` in `src/git/function-churn/` | **Removed** — file hotspots only |

## Adding new dependencies

1. Justify in feature design doc
2. Add entry to this file
3. Encapsulate behind an adapter when touching I/O or external APIs

## Error propagation

Integration errors must include context:

- Git: repo path, git command, stderr snippet
- Size analysis: file path, read error message (`READ_FAILED`)
- Do not swallow errors that indicate user misconfiguration (bad path, not a git repo)
