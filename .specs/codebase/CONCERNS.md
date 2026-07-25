# CONCERNS — @vitals/hotspot-scanner

Fragile areas requiring extra care and test coverage. Enforced by [`.cursor/rules/fragile-areas.mdc`](../../.cursor/rules/fragile-areas.mdc) and edit hooks.

## Git Change Miner (`src/git/`)

**Risk:** Incorrect parsing distorts churn and coupling for all downstream scores.

| Concern                                                           | Mitigation                                                                                                                                                                                                                          |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Streaming parse must not load full log into memory                | Line-by-line processing; test with large fixture                                                                                                                                                                                    |
| Rename handling (`old => new` + `PathAliasMap`; **not** `--follow`) | Global `git log --numstat` has no per-file follow; both file and function spawns use find-renames (`-M`); parse rename lines, `link()` chains, `canonicalize*()` at end; `rename-multi.txt` + `with-renames` fixtures; ambiguous paths warn (`Rename history may be incomplete for: …`) |
| Rename blind spots (copy-paste, pre-`--since`, no `old => new`)   | M26 (RT-003): `src/git/rename-warnings.ts` — unlinked delete+add heuristic (basename relatedness, capped), `--since`+rename-link truncation warning, retained ambiguous warnings; M42 appends **Next step:** sentences to each message family without changing `code` values; fixtures `rename-unlinked.txt`, `rename-since-truncation.txt`; still no `--follow` globally |
| Merge commits, deletes, numstat edge cases                        | Fixture coverage in `tests/fixtures/git-log/`                                                                                                                                                                                       |
| Stream pair aggregation (`pair → coChangeCount`) for coupling     | M32: increment pair counts during numstat stream — do **not** retain full `coChangeEvents[]` for scoring; unit tests assert `fileStats` + `pairCounts` from same stream; `canonicalizePairCounts` at mine end |
| Mega-commit coupling skip (`MEGA_COMMIT_UNIQUE_FILE_THRESHOLD = 100`) | M32: when unique **in-scope** canonical paths in a commit are **> 100**, skip coupling pair increments for that commit (emit `MEGA_COMMIT_SKIPPED` warnings, capped); **churn** (`FileChangeStats`) still aggregated; path scope applied before mega-guard; rankings may omit pairs from skipped commits — documented exception |

## Function churn miner (`src/git/function-churn/`, M23)

**Risk:** Hunk overlap mis-attributes churn; patch stream memory use; rename imprecision after moves.

| Concern                                                                          | Mitigation                                                                                                                              |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Patch parse must stream line-by-line (`--unified=0`)                             | No full-repo patch buffer; mock at spawn boundary                                                                                       |
| Pathspec-restricted patch stream (M35)                                           | `buildGitPatchLogArgv` appends `--` + paths when non-empty and `paths.length ≤ PATCH_PATHSPEC_FALLBACK_THRESHOLD` (1000); empty `paths` → no spawn; over threshold → unrestricted argv (correctness over ARG_MAX); unit tests in `spawn.test.ts` / `index.test.ts` |
| Pathspec + rename best-effort (M35)                                              | Pathspecs use canonical/current paths from scoped numstat with `-M`; overlap still working-tree `[line, endLine]` vs historical hunk lines — post-rename imprecision unchanged; M26 pós-rename overlap warning once when rename links or ambiguous paths observed; **no historical AST** |
| Overlap uses **current** working-tree `[line, endLine]` vs historical hunk lines | M26: when rename links or ambiguous paths observed, emit pós-rename overlap confidence warning once (`formatFunctionPostRenameOverlapWarning`); file mode silent; do not invent historical AST |
| Post-rename hunk line mismatch                                                   | `PathAliasMap` canonicalizes paths only; hunk lines stay historical vs current `[line, endLine]` — mis-attribution after moves remains possible; M26 avisos only; true fix (historical AST) deferred |
| Nested / overlapping functions                                                   | Credit all intersecting functions; interval index (`functionsIntersectingHunk`) equivalence-tested vs naive `hunkIntersectsFunction`; unit fixtures in `aggregate.test.ts` |
| `linesChanged` per intersecting hunk                                             | Full hunk `+`/`-` delta (no intra-hunk blame); document in tests                                                                        |
| Function mode only                                                               | File mode must not spawn patch stream; integration assert in `scan.integration.test.ts` (HOTSPOT-392, HOTSPOT-397) |
| Zero-churn eligible files omitted from function rankings (M35)                   | Intentional edge: files with no scoped file-level churn in window excluded from AST allowlist and `ScanResult.functions` (file mode still lists them in `hotspots`); integration test adds `src/untouched.ts` on isolated `small-ts` copy |

## Complexity Analyzer (`src/complexity/`)

**Risk:** McCabe implementation bugs or non-standard decision node definitions (RT-005).

| Concern                                                     | Mitigation                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decision nodes: if/else, loops, switch cases, catch, `&&`/`\|\|`/`??`, ternary | Document exact definition; fixture per construct                                                                                                                                                                                                                                    |
| `switch`: per-case vs block counting                        | Pick one definition; lock with tests                                                                                                                                                                                                                                                |
| Function AST collection scope (M22, M29)                    | M22: class accessors, class field arrows, object-literal methods. M29: ClassExpression members (same policy as `ClassDeclaration`), object-literal get/set accessors, `=` AssignmentExpression RHS callables; skip body-less non-abstract overload/ambient stubs (implementations and abstract empty-body accessors remain). Naming table in ARCHITECTURE § Function AST collection; fixtures per construct under `tests/fixtures/complexity/`; extend **collection only** — **do not** edit McCabe decision-node kinds in `mccabe.ts` (RT-005) |
| Invalid TS/JS syntax                                        | Warn and skip — never abort full scan; emit `PARSE_FAILED` `ScanWarning` in `meta.warnings` (M28) |
| Function-mode AST allowlist (M35)                           | Optional `pathAllowlist` on `ComplexityAnalyzer.analyze` — discover ∩ allowlist; empty intersection → empty results without workers; file mode omits option (full discovery); unit tests in `index.test.ts` |
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

## Enriched coupling (`src/scoring/enrich-coupling-static.ts`, M14, M33, M44)

**Risk:** `hasStaticDependency` false negatives mislabel hidden vs expected coupling.

| Concern                                                                                         | Mitigation                                                                                                                                      |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Static edge resolution gaps (relative, M14; tsconfig aliases, M27; package exports/imports, M44) | `enrichCouplingStaticDeps` + `TsconfigPathMap` + `PackageExportsMap`: relative paths; nearest `tsconfig.json`/`jsconfig.json` `paths`/`baseUrl` with shallow `extends`; peer-scoped in-repo `#` `imports` and `exports`/`main` (no `node_modules`); missing/unreadable source or unresolved specifier → no edge; ranking unchanged — see [ARCHITECTURE § Enriched coupling](ARCHITECTURE.md#enriched-coupling-m14-m27-m33-m44) |
| Repeated enrich I/O on hub files (dense pair graphs)                                            | M33: per-call peer-scoped `StaticEdgeGraph` — one read/parse per unique participant path; O(1) pair labeling via adjacency lookup — see [ARCHITECTURE § Enriched coupling](ARCHITECTURE.md#enriched-coupling-m14-m27-m33-m44) |
| Renamed-but-unlinked paths may report `false`                                                   | Same PathAliasMap limits as git miner; document; do not invent alias graph in scoring without an explicit milestone                             |

## Performance (cross-cutting)

**Risk RT-001:** Large repos exhaust memory or time.

- **Pipeline overlap (M34):** file mode runs numstat mining and complexity analysis concurrently — peak RSS is **higher** than sequential stages because git stream aggregates and complexity worker/AST batches can be live at the same time; function mode still sequences numstat before complexity (M35 `pathAllowlist` needs scoped churn keys) and never overlaps function-churn with numstat; rankings and JSON contract unchanged; no CI peak-RSS gate (qualitative trade-off for operators/benchmarks)
- **Overlap abort:** on first mining/analysis failure, `runScan()` aborts the sibling stage (`child.kill` on git spawn, worker terminate on complexity pool), awaits settlement, and rethrows the original error — avoids orphan git children/workers and partial rankings
- Git (file mode): single streaming `git log --numstat` pass (ADR-2026-020); coupling pair counts aggregated during the stream (M32) — no retained `coChangeEvents[]` for scoring; mega-commit guard skips coupling when unique in-scope files `> 100` (churn still counted)
- Function mode (M35): second `git log -p --unified=0` stream for hunk overlap — pathspec-restricted to churned eligible paths when under `PATCH_PATHSPEC_FALLBACK_THRESHOLD` (1000); empty allowlist skips spawn; over threshold falls back to unrestricted stream; both modes must stream line-by-line; never buffer full log/patch; **file mode must not spawn the patch stream**
- Function mode AST (M35): complexity limited to scoped numstat churn ∩ eligible extensions via `pathAllowlist` — zero-churn eligible files intentionally omitted from `functions` output
- Function-churn CPU (M35): interval index (`functionsIntersectingHunk`) replaces naive function×hunk nested loop hot path; semantics locked by equivalence tests vs `hunkIntersectsFunction`
- AST: batch file processing with persistent worker-thread pool (M15 + M31); default concurrency `min(availableParallelism(), 8)` (M36; override via CLI `--concurrency` or config `concurrency` — precedence CLI > config > default); each worker (and inline `concurrency === 1` session) reuses one ts-morph `Project` across batches with source files cleared between `loadBatch` calls; parse gating locked to syntactic diagnostics only (`getSyntacticDiagnostics`) — no semantic/pre-emit work (RT-005)
- Discovery (M36): `discoverSourceFiles` prefers `git ls-files` (tracked-only) + PathScope/extension filter; silent walk fallback on git failure or non-git trees; higher default concurrency increases peak AST heap — use `--concurrency` to lower on memory-constrained hosts
- Enrich (M33): `enrichCouplingStaticDeps` builds a per-call peer-scoped edge cache — one read/parse per unique coupling participant; pair labeling via O(1) graph lookup (see [ARCHITECTURE § Enriched coupling](ARCHITECTURE.md#enriched-coupling-m14-m27-m33-m44))
- Manual benchmark before declaring v1 ready

## Diagnostics (`meta.warnings`, M28)

**Risk:** Consumers treat `severity` as exit-code signal, or miss structured compare warnings.

| Concern | Mitigation |
| ------- | ---------- |
| Severity vs exit code | Document: `info` / `warning` / `error` classify diagnostics only; scan success exits `0` with warnings |
| Compare `meta.warnings` shape change | `ScanWarning[]` objects (not bare strings); contract tests in `tests/contract/`; reporters use `formatScanWarning()` |
| M26 vs M28 boundary | M28 routes **existing** M26 rename messages under `RENAME_HISTORY_INCOMPLETE` — do not invent new RT-003 warning families in M28 tasks |
| M42 rename next-steps | Append actionable next-step copy to M26 message families only — **no** new or renamed warning `code` values |
| Complexity progress (M42) | `onProgress({ phase: "complexity", … })` from analyzer/pool; CLI `--no-progress` no-ops the shared `onProgress` hook — no separate complexity silence path |
| Warning code stability | M28 catalog (+ M32 `MEGA_COMMIT_SKIPPED`): `EMPTY_SINCE_WINDOW`, `RENAME_HISTORY_INCOMPLETE`, `PARSE_FAILED`, `COMPARE_SINCE_MISMATCH`, `MEGA_COMMIT_SKIPPED` — document in README / ARCHITECTURE |

## Hooks enforcement

Edits to `src/git/`, `src/complexity/`, `src/scoring/`, `src/scan.ts`, `src/compare/`, or `schemas/` trigger fragile-area warnings. Tests must be updated before marking tasks Complete.

## Unmitigated — risk × effort

Gaps without product mitigation (only “document / accept / `false`”, or explicitly deferred true fixes). Scales: **Risco** / **Esforço** = A | M | B (impact if left open / cost of the chosen mitigation path).

| Item | Risco | Esforço | Caminho | Backlog |
| ---- | ----- | ------- | ------- | ------- |
| Post-rename hunk line mismatch (true fix) | M | A | Historical AST / per-commit function ranges — **do not prioritize**; M26 avisos shipped | Deferred |
| Renamed-but-unlinked → `hasStaticDependency: false` | M | M | Doc/warning via PathAliasMap limits; no alias graph in scoring | No dedicated milestone |

```text
                 Esforço B              Esforço M              Esforço A
Risco A     —                      renamed→false          —
Risco M     —                      —                      AST histórico
                                                          (não priorizar)
```

**Maintenance:** when an item gains product mitigation (e.g. M26 Done), move it into the matching Concern|Mitigation table above and **remove** it from this matrix; when planning new gaps, update this section.
