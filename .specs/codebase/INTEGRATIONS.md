# INTEGRATIONS — @taranti/hotspot-scanner

External dependencies and adapter boundaries. No network integrations (zero-network product policy).

## worker_threads (Node.js built-in)

| Aspect       | Detail                                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| **Role**     | Parallel batch processing in size analysis stage                                                               |
| **Adapter**  | `createWorkerPool` in `src/complexity/pool.ts`; worker entry `src/complexity/worker.ts`                        |
| **Default**  | `DEFAULT_WORKER_CONCURRENCY` = `min(availableParallelism(), 8)`                                                |
| **Override** | CLI `--concurrency` or config `concurrency` → `runScan()` → `createComplexityAnalyzer({ concurrency })`        |
| **Rule**     | Do not spawn worker threads outside `src/complexity/`                                                          |
| **Failure**  | Worker error → reject `analyze()` with `repoPath` and batch path context                                       |
| **Tests**    | Mock `createWorkerPool` at `ComplexityAnalyzer` boundary; `worker.ts` excluded from coverage (separate thread) |

## Git (local binary)

| Aspect         | Detail                                                                                                                                                                                                                                                                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Role**       | `git log --numstat` for per-file churn (rename lines parsed from numstat output)                                                                                                                                                                                                                                                                      |
| **Adapter**    | `GitMiner` in `src/git/`                                                                                                                                                                                                                                                                                                                              |
| **Invocation** | `child_process.spawn` in `src/git/spawn.ts` — streaming parse                                                                                                                                                                                                                                                                                         |
| **Rule**       | Do not spawn git outside documented sites: `src/git/` (numstat, ls-files, probe-since, file-history); `src/paths/resolve-repo.ts` (`rev-parse --show-toplevel`); `src/doctor/index.ts` `isGitOnPath()` (`spawnSync("git", ["--version"])`). **Do not** parse git stderr or add git-error pattern switches in `bin/` — CLI prints `error.message` only |
| **Failure**    | Spawn failures → `GitLogError` / `GitLsFilesError` with repo path, command, raw `stderr`, and optional `\nHint: …` when `formatGitStderrHint` matches; exit `1`. Not-a-git → `resolve-repo`. Invalid `since` at doctor time → `probeSinceWindow`                                                                                                      |
| **Tests**      | Mock subprocess at `GitMiner` boundary; fixtures for parse logic; `git-error-hint.test.ts` for stderr→Hint mapping                                                                                                                                                                                                                                    |

### Git toplevel detection

| Aspect         | Detail                                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| **Role**       | `git rev-parse --show-toplevel` to resolve pipeline `repoPath` when scan path is nested inside a git workspace |
| **Adapter**    | `resolveMonorepoScanPath` in `src/paths/resolve-repo.ts`                                                       |
| **Invocation** | `child_process.execFile` — `git -C <requestPath> rev-parse --show-toplevel`                                    |
| **Rule**       | Do not spawn `rev-parse` outside `src/paths/resolve-repo.ts`                                                   |
| **Tests**      | Inject `detectGitToplevel` in `resolve-repo.test.ts`; integration via `scan.test.ts`                           |

### Tracked file listing

| Aspect         | Detail                                                                               |
| -------------- | ------------------------------------------------------------------------------------ |
| **Role**       | `git ls-files -z` for tracked-path discovery before size analysis                    |
| **Adapter**    | `listTrackedFiles` in `src/git/ls-files.ts`                                          |
| **Invocation** | `child_process.spawn` — `git -C <repoPath> ls-files -z`; null-delimited stdout parse |
| **When**       | `discoverSourceFiles` primary path in Git repos; silent walk fallback on failure     |
| **Tests**      | Mock `spawn` in `ls-files.test.ts`; inject `listTrackedFiles` in `discover.test.ts`  |

### Since-window probe

| Aspect         | Detail                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Role**       | Lightweight `git log -1 --since=…` to validate effective merged `since` before scan                                 |
| **Adapter**    | `probeSinceWindow` in `src/git/probe-since.ts`                                                                      |
| **Invocation** | `child_process.spawn` — `git -C <repoPath> log -1 --since=<since> --format=%s`                                      |
| **Mapping**    | exit 0 + stdout → `ok`; exit 0 + empty stdout → `empty` (doctor soft warn); non-zero → `invalid` (doctor hard fail) |
| **Consumer**   | `src/doctor/index.ts` (`since` finding) — skipped when git-repo prelude already failed                              |
| **Tests**      | Mock `spawn` in `probe-since.test.ts`; doctor unit tests inject probe boundary                                      |

### Git stderr hints

| Aspect         | Detail                                                                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Role**       | Append actionable `\nHint: …` to `GitLogError` / `GitLsFilesError` `message` when stderr matches locked families (since/date, shallow, corrupt) |
| **Adapter**    | `formatGitStderrHint` in `src/git/git-error-hint.ts`; called from error constructors in `spawn.ts` and `ls-files.ts`                            |
| **Rule**       | Enrichment owned by `src/git/` only — **forbidden** in `bin/` (no ad-hoc git stderr parsing outside `src/git/`)                                 |
| **Boundaries** | Not-a-git `Hint:` stays on `resolve-repo`. Doctor `since` preflight stays on `probeSinceWindow`. Hint helper has no dedicated not-a-git pattern |
| **Tests**      | `git-error-hint.test.ts`; constructor assertions in `spawn.test.ts` and `ls-files.test.ts`                                                      |

### File history

| Aspect         | Detail                                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Role**       | Per-file revision list + blob contents for `runComplexityTrend` (indentation + NCLOC series)                          |
| **Adapter**    | `listFileRevisions` / `showFileAtRevision` in `src/git/file-history.ts`                                               |
| **Invocation** | `child_process.spawn` — path-scoped `git log` with **`--follow` default**; `git show <rev>:path` for historical blobs |
| **Rule**       | Trend-only — **forbidden** to add `--follow` to scan numstat `buildGitLogArgv` in `spawn.ts`                          |
| **Tests**      | Co-located `file-history` / trend tests; fixture `tests/fixtures/repos/trend-indent/`                                 |

### Doctor git PATH probe

| Aspect         | Detail                                                                                |
| -------------- | ------------------------------------------------------------------------------------- |
| **Role**       | Detect whether `git` is on `PATH` before other doctor git findings                    |
| **Adapter**    | `isGitOnPath` in `src/doctor/index.ts`                                                |
| **Invocation** | `child_process.spawnSync` — `git --version`                                           |
| **Rule**       | Doctor-only PATH probe — do not use for scan/trend mining; mining stays in `src/git/` |
| **Tests**      | Doctor unit tests mock `spawnSync` at the `isGitOnPath` boundary                      |

## commander

| Aspect       | Detail                                                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| **Role**     | CLI flag parsing                                                                                                             |
| **Location** | `bin/hotspot-scanner.ts` (+ `bin/*-actions.ts` wiring)                                                                       |
| **Rule**     | No domain logic in bin — delegate to `runScan`, `runComplexityTrend`, `runAssess`, `runDoctor`, and config helpers in `src/` |

## picomatch

| Aspect      | Detail                                                                              |
| ----------- | ----------------------------------------------------------------------------------- |
| **Role**    | Glob pattern matching for path scoping (`--include`, `--exclude`, default excludes) |
| **Adapter** | `src/paths/scope.ts` only                                                           |
| **Version** | `picomatch@^4` (runtime dependency)                                                 |
| **Rule**    | Do not import picomatch outside `src/paths/`                                        |
| **Tests**   | Real pattern behavior in `src/paths/scope.test.ts`                                  |

## node:fs (ownership)

| Ownership                      | Location                                  |
| ------------------------------ | ----------------------------------------- |
| NCLOC / discovery file reads   | `src/complexity/`                         |
| Config load + exemplar write   | `src/config/`                             |
| `package.json` version read    | `src/package-meta.ts`                     |
| CLI `--output` / report writes | `bin/*-actions.ts`                        |
| **Forbidden**                  | `src/report/` — pure formatters (no `fs`) |

## Published JSON schemas

Contracts under `schemas/` (`scan-result`, `hotspot-scanner-config`, `complexity-trend`, `hotspot-assess`) are exported via `package.json` `exports`. Design, versions, and parse rules: [ARCHITECTURE.md](ARCHITECTURE.md).

## Not used

- No ts-morph / AST McCabe runtime — NCLOC is plain file read + state machine (`ncloc.ts`). Anti-regression: [CONCERNS.md](CONCERNS.md).
- No `git log -p` function-churn stream — file-level hotspots only. Do not reintroduce without a feature spec.

## Adding new dependencies

1. Justify in feature design doc
2. Add entry to this file
3. Encapsulate behind an adapter when touching I/O or external APIs

## Error propagation

Integration errors must include context:

- Git: repo path, git command, stderr snippet
- Size analysis: file path, read error message (`READ_FAILED`)
- Doctor PATH: git missing on `PATH` must surface as a doctor finding, not a swallowed spawn
- Config / exemplar FS: path and I/O reason
- Do not swallow errors that indicate user misconfiguration (bad path, not a git repo)
