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
| **Rule**       | Do not spawn git subprocess outside `src/git/` **except** documented adapters (`src/paths/resolve-repo.ts` for `rev-parse --show-toplevel`) |
| **Failure**    | Invalid/corrupt repo → clear error, exit != 0                                         |
| **Tests**      | Mock subprocess at `GitMiner` boundary; fixtures for parse logic                      |

### Git toplevel detection (M43, monorepo remount)

| Aspect         | Detail                                                                                |
| -------------- | ------------------------------------------------------------------------------------- |
| **Role**       | `git rev-parse --show-toplevel` to resolve pipeline `repoPath` when scan path is nested inside a git workspace |
| **Adapter**    | `resolveMonorepoScanPath` in `src/paths/resolve-repo.ts`                              |
| **Invocation** | `child_process.execFile` — `git -C <requestPath> rev-parse --show-toplevel`         |
| **Rule**       | Do not spawn `rev-parse` outside `src/paths/resolve-repo.ts`                          |
| **Tests**      | Inject `detectGitToplevel` in `resolve-repo.test.ts`; integration via `scan.test.ts` |

### Tracked file listing (M36, discovery)

| Aspect         | Detail                                                                              |
| -------------- | ----------------------------------------------------------------------------------- |
| **Role**       | `git ls-files -z` for tracked-path discovery before size analysis                   |
| **Adapter**    | `listTrackedFiles` in `src/git/ls-files.ts`                                         |
| **Invocation** | `child_process.spawn` — `git -C <repoPath> ls-files -z`; null-delimited stdout parse |
| **When**       | `discoverSourceFiles` primary path in Git repos; silent walk fallback on failure      |
| **Tests**      | Mock `spawn` in `ls-files.test.ts`; inject `listTrackedFiles` in `discover.test.ts` |

## commander

| Aspect       | Detail                                                            |
| ------------ | ----------------------------------------------------------------- |
| **Role**     | CLI flag parsing                                                  |
| **Location** | `bin/hotspot-scanner.ts` only                                     |
| **Rule**     | No domain logic in bin — delegate to `runScan()` in `src/scan.ts` |

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
