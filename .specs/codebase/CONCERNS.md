# CONCERNS — @vitals/hotspot-scanner

Fragile areas requiring extra care and test coverage. Enforced by [`.cursor/rules/fragile-areas.mdc`](../../.cursor/rules/fragile-areas.mdc) and edit hooks.

## Git Change Miner (`src/git/`)

**Risk:** Incorrect parsing distorts churn and coupling for all downstream scores.

| Concern                                                           | Mitigation                                                                                                                                                                                                                          |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Streaming parse must not load full log into memory                | Line-by-line processing; test with large fixture                                                                                                                                                                                    |
| Rename handling (`old => new` + `PathAliasMap`; **not** `--follow`) | Global `git log --numstat` has no per-file follow; both file and function spawns use find-renames (`-M`); parse rename lines, `link()` chains, `canonicalize*()` at end; `rename-multi.txt` + `with-renames` fixtures; ambiguous paths warn (`Rename history may be incomplete for: …`) |
| Rename blind spots (copy-paste, pre-`--since`, no `old => new`)   | M26 (RT-003): `src/git/rename-warnings.ts` — unlinked delete+add heuristic (basename relatedness, capped), `--since`+rename-link truncation warning, retained ambiguous warnings; fixtures `rename-unlinked.txt`, `rename-since-truncation.txt`; still no `--follow` globally |
| Merge commits, deletes, numstat edge cases                        | Fixture coverage in `tests/fixtures/git-log/`                                                                                                                                                                                       |
| Single-pass produces both `FileChangeStats` and `CoChangeEvent[]` | Unit test both outputs from same input stream                                                                                                                                                                                       |

## Function churn miner (`src/git/function-churn/`, M23)

**Risk:** Hunk overlap mis-attributes churn; patch stream memory use; rename imprecision after moves.

| Concern                                                                          | Mitigation                                                                                                                              |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Patch parse must stream line-by-line (`--unified=0`)                             | No full-repo patch buffer; mock at spawn boundary                                                                                       |
| Overlap uses **current** working-tree `[line, endLine]` vs historical hunk lines | M26: when rename links or ambiguous paths observed, emit pós-rename overlap confidence warning once (`formatFunctionPostRenameOverlapWarning`); file mode silent; do not invent historical AST |
| Post-rename hunk line mismatch                                                   | `PathAliasMap` canonicalizes paths only; hunk lines stay historical vs current `[line, endLine]` — mis-attribution after moves remains possible; M26 avisos only; true fix (historical AST) deferred |
| Nested / overlapping functions                                                   | Credit all intersecting functions; unit fixtures                                                                                        |
| `linesChanged` per intersecting hunk                                             | Full hunk `+`/`-` delta (no intra-hunk blame); document in tests                                                                        |
| Function mode only                                                               | File mode must not spawn patch stream; integration assert                                                                               |

## Complexity Analyzer (`src/complexity/`)

**Risk:** McCabe implementation bugs or non-standard decision node definitions (RT-005).

| Concern                                                     | Mitigation                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decision nodes: if/else, loops, switch cases, catch, `&&`/`\|\|`/`??`, ternary | Document exact definition; fixture per construct                                                                                                                                                                                                                                    |
| `switch`: per-case vs block counting                        | Pick one definition; lock with tests                                                                                                                                                                                                                                                |
| Function AST collection scope (M22, M29)                    | M22: class accessors, class field arrows, object-literal methods. M29: ClassExpression members (same policy as `ClassDeclaration`), object-literal get/set accessors, `=` AssignmentExpression RHS callables; skip body-less non-abstract overload/ambient stubs (implementations and abstract empty-body accessors remain). Naming table in ARCHITECTURE § Function AST collection; fixtures per construct under `tests/fixtures/complexity/`; extend **collection only** — **do not** edit McCabe decision-node kinds in `mccabe.ts` (RT-005) |
| Invalid TS/JS syntax                                        | Warn and skip — never abort full scan; emit `PARSE_FAILED` `ScanWarning` in `meta.warnings` (M28) |
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
| Static edge resolution gaps (relative + tsconfig aliases, M27)                                   | `enrichCouplingStaticDeps` + `TsconfigPathMap`: relative paths; nearest `tsconfig.json`/`jsconfig.json` `paths`/`baseUrl` with shallow `extends`; missing/unreadable source or unresolved alias → no edge; ranking unchanged; **`package.json` `exports`/`imports` still deferred** |
| Renamed-but-unlinked paths may report `false`                                                   | Same PathAliasMap limits as git miner; document; do not invent alias graph in scoring without an explicit milestone                             |

## Performance (cross-cutting)

**Risk RT-001:** Large repos exhaust memory or time.

- Git (file mode): single streaming `git log --numstat` pass (ADR-2026-020)
- Function mode: second `git log -p --unified=0` stream for hunk overlap — both must stream line-by-line; never buffer full log/patch; file mode must not spawn the patch stream
- AST: batch file processing with worker-thread parallelism (M15); default concurrency `min(availableParallelism(), 4)`; override via CLI `--concurrency` or config `concurrency` (M28; precedence CLI > config > default); each worker owns a fresh ts-morph `Project` per batch
- Manual benchmark before declaring v1 ready

## Diagnostics (`meta.warnings`, M28)

**Risk:** Consumers treat `severity` as exit-code signal, or miss structured compare warnings.

| Concern | Mitigation |
| ------- | ---------- |
| Severity vs exit code | Document: `info` / `warning` / `error` classify diagnostics only; scan success exits `0` with warnings |
| Compare `meta.warnings` shape change | `ScanWarning[]` objects (not bare strings); contract tests in `tests/contract/`; reporters use `formatScanWarning()` |
| M26 vs M28 boundary | M28 routes **existing** M26 rename messages under `RENAME_HISTORY_INCOMPLETE` — do not invent new RT-003 warning families in M28 tasks |
| Warning code stability | M28 catalog: `EMPTY_SINCE_WINDOW`, `RENAME_HISTORY_INCOMPLETE`, `PARSE_FAILED`, `COMPARE_SINCE_MISMATCH` — document in README / ARCHITECTURE |

## Hooks enforcement

Edits to `src/git/`, `src/complexity/`, `src/scoring/`, `src/scan.ts`, `src/compare/`, or `schemas/` trigger fragile-area warnings. Tests must be updated before marking tasks Complete.

## Unmitigated — risk × effort

Gaps without product mitigation (only “document / accept / `false`”, or explicitly deferred true fixes). Scales: **Risco** / **Esforço** = A | M | B (impact if left open / cost of the chosen mitigation path).

| Item | Risco | Esforço | Caminho | Backlog |
| ---- | ----- | ------- | ------- | ------- |
| Post-rename hunk line mismatch (true fix) | M | A | Historical AST / per-commit function ranges — **do not prioritize**; M26 avisos shipped | Deferred |
| Enriched coupling: no `package.json` `exports` / `imports` | M→A (monorepos) | A | Resolve package entry points | Deferred |
| Renamed-but-unlinked → `hasStaticDependency: false` | M | M | Doc/warning via PathAliasMap limits; no alias graph in scoring | No dedicated milestone |

```text
                 Esforço B              Esforço M              Esforço A
Risco A     —                      renamed→false          package exports
Risco M     —                      —                      AST histórico
                                                          (não priorizar)
```

**Maintenance:** when an item gains product mitigation (e.g. M26 Done), move it into the matching Concern|Mitigation table above and **remove** it from this matrix; when planning new gaps, update this section.
