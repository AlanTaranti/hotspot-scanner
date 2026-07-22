# INTEGRATIONS — @vitals/hotspot-scanner

External dependencies and adapter boundaries. No network integrations in v1.

## ts-morph

| Aspect | Detail |
|--------|--------|
| **Role** | AST access for TypeScript/JavaScript files |
| **Adapter** | `ComplexityAnalyzer` in `src/complexity/` (`project.ts` batch adapter) |
| **Version** | `ts-morph@^28` (runtime dependency) |
| **Rule** | Do not import ts-morph outside `src/complexity/` |
| **Failure** | Invalid syntax → log warning, skip file (IMPL §8.4) |
| **Tests** | Mock at adapter boundary; use fixture TS files for real AST tests |

## Git (local binary)

| Aspect | Detail |
|--------|--------|
| **Role** | `git log --numstat` for churn and co-change (rename lines parsed from numstat output) |
| **Adapter** | `GitMiner` in `src/git/` |
| **Invocation** | `child_process` spawn or `simple-git` — encapsulate in one module |
| **Rule** | Do not spawn git subprocess outside `src/git/` |
| **Failure** | Invalid/corrupt repo → clear error, exit != 0 |
| **Tests** | Mock subprocess at `GitMiner` boundary; fixtures for parse logic |

## commander

| Aspect | Detail |
|--------|--------|
| **Role** | CLI flag parsing |
| **Location** | `bin/hotspot-scanner.ts` only |
| **Rule** | No domain logic in bin — delegate to `runScan()` in `src/scan.ts` |

## Adding new dependencies

1. Justify in feature design doc
2. Add entry to this file
3. Encapsulate behind an adapter when touching I/O or external APIs

## Error propagation

Integration errors must include context:

- Git: repo path, git command, stderr snippet
- AST: file path, parse error message
- Do not swallow errors that indicate user misconfiguration (bad path, not a git repo)
