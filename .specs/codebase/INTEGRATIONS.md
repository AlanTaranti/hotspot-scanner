# INTEGRATIONS — @vitals/hotspot-scanner

External dependencies and adapter boundaries. No network integrations in v1.

## ts-morph

| Aspect      | Detail                                                                 |
| ----------- | ---------------------------------------------------------------------- |
| **Role**    | AST access for TypeScript/JavaScript files                             |
| **Adapter** | `ComplexityAnalyzer` in `src/complexity/` (`project.ts` batch adapter) |
| **Version** | `ts-morph@^28` (runtime dependency)                                    |
| **Rule**    | Do not import ts-morph outside `src/complexity/`                       |
| **Failure** | Invalid syntax → `PARSE_FAILED` `ScanWarning`, skip file (see CONCERNS.md)                                             |
| **Tests**   | Mock at adapter boundary; use fixture TS files for real AST tests      |

## worker_threads (Node.js built-in)

| Aspect      | Detail                                                                                                                 |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Role**    | Parallel batch processing in complexity stage (M15)                                                                    |
| **Adapter** | `createWorkerPool` in `src/complexity/pool.ts`; worker entry `src/complexity/worker.ts`                                |
| **Default** | `DEFAULT_WORKER_CONCURRENCY` = `min(availableParallelism(), 4)`                                                        |
| **Override**| CLI `--concurrency` or config `concurrency` (M28) → `runScan()` → `createComplexityAnalyzer({ concurrency })`          |
| **Rule**    | Do not spawn worker threads outside `src/complexity/`                                                                  |
| **Failure** | Worker error → reject `analyze()` with `repoPath` and batch path context                                               |
| **Tests**   | Mock `createWorkerPool` at `ComplexityAnalyzer` boundary; `worker.ts` excluded from coverage (runs in separate thread) |

## Git (local binary)

| Aspect         | Detail                                                                                |
| -------------- | ------------------------------------------------------------------------------------- |
| **Role**       | `git log --numstat` for churn and co-change (rename lines parsed from numstat output) |
| **Adapter**    | `GitMiner` in `src/git/`                                                              |
| **Invocation** | `child_process.spawn` in `src/git/spawn.ts` — streaming parse                         |
| **Rule**       | Do not spawn git subprocess outside `src/git/`                                        |
| **Failure**    | Invalid/corrupt repo → clear error, exit != 0                                         |
| **Tests**      | Mock subprocess at `GitMiner` boundary; fixtures for parse logic                      |

### Function churn patch stream (M23, function mode only)

| Aspect         | Detail                                                                              |
| -------------- | ----------------------------------------------------------------------------------- |
| **Role**       | `git log -p --unified=0` for per-function hunk-overlap churn                        |
| **Adapter**    | `createFunctionChurnMiner` in `src/git/function-churn/`                             |
| **Invocation** | `streamGitPatchLog` in `src/git/function-churn/spawn.ts` — streaming parse          |
| **When**       | Only when `--granularity function`; skipped when no functions                       |
| **Tests**      | Mock at `FunctionChurnMiner` / spawn boundary; fixtures `tests/fixtures/git-patch/` |

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
| **Failure** | Invalid patterns propagate at scope creation; CLI rejects empty patterns            |
| **Tests**   | Real pattern behavior in `src/paths/scope.test.ts` — do not mock picomatch          |

## Adding new dependencies

1. Justify in feature design doc
2. Add entry to this file
3. Encapsulate behind an adapter when touching I/O or external APIs

## Error propagation

Integration errors must include context:

- Git: repo path, git command, stderr snippet
- AST: file path, parse error message
- Do not swallow errors that indicate user misconfiguration (bad path, not a git repo)
