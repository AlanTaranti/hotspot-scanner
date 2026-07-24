# CONCERNS — @vitals/hotspot-scanner

Fragile areas requiring extra care and test coverage. Enforced by [`.cursor/rules/fragile-areas.mdc`](../../.cursor/rules/fragile-areas.mdc) and edit hooks.

## Git Change Miner (`src/git/`)

**Risk:** Incorrect parsing distorts churn and coupling for all downstream scores.

| Concern                                                           | Mitigation                                                   |
| ----------------------------------------------------------------- | ------------------------------------------------------------ |
| Streaming parse must not load full log into memory                | Line-by-line processing; test with large fixture             |
| Rename handling (`--follow`)                                      | Dedicated test; warn when history may be incomplete (RT-003) |
| Merge commits, deletes, numstat edge cases                        | Fixture coverage in `tests/fixtures/git-log/`                |
| Single-pass produces both `FileChangeStats` and `CoChangeEvent[]` | Unit test both outputs from same input stream                |

## Function churn miner (`src/git/function-churn/`, M23)

**Risk:** Hunk overlap mis-attributes churn; patch stream memory use; rename imprecision after moves.

| Concern                                                                          | Mitigation                                                        |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Patch parse must stream line-by-line (`--unified=0`)                             | No full-repo patch buffer; mock at spawn boundary                 |
| Overlap uses **current** working-tree `[line, endLine]` vs historical hunk lines | Document post-rename imprecision; reuse `PathAliasMap` + warnings |
| Nested / overlapping functions                                                   | Credit all intersecting functions; unit fixtures                  |
| `linesChanged` per intersecting hunk                                             | Full hunk `+`/`-` delta (no intra-hunk blame); document in tests  |
| Function mode only                                                               | File mode must not spawn patch stream; integration assert         |

## Complexity Analyzer (`src/complexity/`)

**Risk:** McCabe implementation bugs or non-standard decision node definitions (RT-005).

| Concern                                                     | Mitigation                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decision nodes: if/else, loops, switch cases, catch, `&&`/` |                                                                                                                                                                                                                                                                                     | `/`??`, ternary | Document exact definition; fixture per construct |
| `switch`: per-case vs block counting                        | Pick one definition; lock with tests                                                                                                                                                                                                                                                |
| Function AST collection scope (M22)                         | Collect getters/setters, class field arrows, object-literal methods; naming table in ARCHITECTURE § Function AST collection; fixtures `getters-setters.ts`, `class-field-arrows.ts`, `object-literal-methods.ts`; **do not** change McCabe decision nodes when extending collection |
| Invalid TS/JS syntax                                        | Warn and skip — never abort full scan                                                                                                                                                                                                                                               |
| ts-morph version / exotic syntax                            | Fallback warn-skip; track in tests                                                                                                                                                                                                                                                  |

## Scoring (`src/scoring/`)

**Risk:** Normalization or formula changes silently reorder rankings.

| Concern                                                                           | Mitigation                                                 |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `hotspotScore = 2ch / (c + h)` (harmonic mean of normalized complexity and churn) | Unit tests with fixed inputs and expected order            |
| Normalization strategy (min-max vs log)                                           | Document in code; test edge cases (all zeros, single file) |
| `couplingStrength = coChangeCount / min(commitsA, commitsB)`                      | Test denominator edge cases (zero commits)                 |
| `--min-cochange` threshold                                                        | Test boundary at N-1, N, N+1                               |

## Performance (cross-cutting)

**Risk RT-001:** Large repos exhaust memory or time.

- Git: streaming mandatory
- AST: batch file processing with worker-thread parallelism (M15); default concurrency `min(availableParallelism(), 4)`; each worker owns a fresh ts-morph `Project` per batch
- Manual benchmark before declaring v1 ready

## Hooks enforcement

Edits to `src/git/`, `src/complexity/`, `src/scoring/`, `src/scan.ts`, `src/compare/`, or `schemas/` trigger fragile-area warnings. Tests must be updated before marking tasks Complete.
