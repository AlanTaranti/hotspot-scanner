# CONCERNS — @vitals/hotspot-scanner

Fragile areas requiring extra care and test coverage. Enforced by [`.cursor/rules/fragile-areas.mdc`](../../.cursor/rules/fragile-areas.mdc) and edit hooks.

## Git Change Miner (`src/git/`)

**Risk:** Incorrect parsing distorts churn and coupling for all downstream scores.

| Concern                                                           | Mitigation                                                                                                                                                                                                                          |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Streaming parse must not load full log into memory                | Line-by-line processing; test with large fixture                                                                                                                                                                                    |
| Rename handling (`old => new` + `PathAliasMap`; **not** `--follow`) | Global `git log --numstat` has no per-file follow; parse rename lines, `link()` chains, `canonicalize*()` at end; `rename-multi.txt` + `with-renames` fixtures; warn ambiguous paths (`Rename history may be incomplete for: …`, RT-003) |
| Rename blind spots (copy-paste, pre-`--since`, no `old => new`)   | No warning today — history may split across paths; document in output/README; do not add `--follow` globally                                                                                                                        |
| Merge commits, deletes, numstat edge cases                        | Fixture coverage in `tests/fixtures/git-log/`                                                                                                                                                                                       |
| Single-pass produces both `FileChangeStats` and `CoChangeEvent[]` | Unit test both outputs from same input stream                                                                                                                                                                                       |

## Function churn miner (`src/git/function-churn/`, M23)

**Risk:** Hunk overlap mis-attributes churn; patch stream memory use; rename imprecision after moves.

| Concern                                                                          | Mitigation                                                                                                                              |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Patch parse must stream line-by-line (`--unified=0`)                             | No full-repo patch buffer; mock at spawn boundary                                                                                       |
| Overlap uses **current** working-tree `[line, endLine]` vs historical hunk lines | Document post-rename imprecision; reuse `PathAliasMap` + warnings                                                                       |
| Post-rename hunk line mismatch                                                   | `PathAliasMap` canonicalizes paths only; hunk lines are historical vs current `[line, endLine]` — expect mis-attribution after moves; do not invent historical AST |
| Nested / overlapping functions                                                   | Credit all intersecting functions; unit fixtures                                                                                        |
| `linesChanged` per intersecting hunk                                             | Full hunk `+`/`-` delta (no intra-hunk blame); document in tests                                                                        |
| Function mode only                                                               | File mode must not spawn patch stream; integration assert                                                                               |

## Complexity Analyzer (`src/complexity/`)

**Risk:** McCabe implementation bugs or non-standard decision node definitions (RT-005).

| Concern                                                     | Mitigation                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decision nodes: if/else, loops, switch cases, catch, `&&`/`\|\|`/`??`, ternary | Document exact definition; fixture per construct                                                                                                                                                                                                                                    |
| `switch`: per-case vs block counting                        | Pick one definition; lock with tests                                                                                                                                                                                                                                                |
| Function AST collection scope (M22)                         | Collect getters/setters, class field arrows, object-literal methods; naming table in ARCHITECTURE § Function AST collection; fixtures `getters-setters.ts`, `class-field-arrows.ts`, `object-literal-methods.ts`; **do not** change McCabe decision nodes when extending collection |
| Invalid TS/JS syntax                                        | Warn and skip — never abort full scan                                                                                                                                                                                                                                               |
| ts-morph version / exotic syntax                            | Fallback warn-skip; track in tests                                                                                                                                                                                                                                                  |

## Scoring (`src/scoring/`)

**Risk:** Normalization or formula changes silently reorder rankings.

| Concern                                                                           | Mitigation                                                                                                                              |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `hotspotScore = 2ch / (c + h)` (harmonic mean of normalized complexity and churn) | Unit tests with fixed inputs and expected order                                                                                         |
| Normalization strategy (min-max vs log)                                           | Document in code; test edge cases (all zeros, single file)                                                                              |
| Scores are **scan-relative** (log1p + min-max over current result set)            | Not comparable across scans; do not use as CI fail thresholds (STATE: M12 CI gate removed); compare uses rank/delta within paired runs |
| `couplingStrength = coChangeCount / min(commitsA, commitsB)`                      | Test denominator edge cases (zero commits)                                                                                              |
| `--min-cochange` threshold                                                        | Test boundary at N-1, N, N+1                                                                                                            |

## Enriched coupling (`src/scoring/enrich-coupling-static.ts`, M14)

**Risk:** `hasStaticDependency` false negatives mislabel hidden vs expected coupling.

| Concern                                                                                         | Mitigation                                                                                                                                      |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Relative import/require/export resolution only                                                  | No tsconfig `paths`, no package `exports`; missing/unreadable source → `false`; ranking unchanged                                               |
| Renamed-but-unlinked paths may report `false`                                                   | Same PathAliasMap limits as git miner; document; do not invent alias graph in scoring without an explicit milestone                             |

## Performance (cross-cutting)

**Risk RT-001:** Large repos exhaust memory or time.

- Git (file mode): single streaming `git log --numstat` pass (ADR-2026-020)
- Function mode: second `git log -p --unified=0` stream for hunk overlap — both must stream line-by-line; never buffer full log/patch; file mode must not spawn the patch stream
- AST: batch file processing with worker-thread parallelism (M15); default concurrency `min(availableParallelism(), 4)`; each worker owns a fresh ts-morph `Project` per batch
- Manual benchmark before declaring v1 ready

## Hooks enforcement

Edits to `src/git/`, `src/complexity/`, `src/scoring/`, `src/scan.ts`, `src/compare/`, or `schemas/` trigger fragile-area warnings. Tests must be updated before marking tasks Complete.
