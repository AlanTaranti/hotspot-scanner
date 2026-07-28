# CONCERNS — @vitals/hotspot-scanner

Fragile areas requiring extra care and test coverage. Enforced by [`.cursor/rules/fragile-areas.mdc`](../../.cursor/rules/fragile-areas.mdc) and edit hooks.

## CLI bin (`bin/`)

**Risk:** `../src/...` imports in production bin files compile to `dist/bin/` but resolve at runtime to non-existent `dist/src/...` (`ERR_MODULE_NOT_FOUND`). Vitest runs bin from source and does not catch this.

| Concern | Mitigation |
| ------- | ---------- |
| Value imports from `../src/` in `bin/*.ts` | Use `#` aliases only (`#scan`, `#trend`, `#types`, …); ESLint `@typescript-eslint/no-restricted-imports` on `bin/**/*.ts` (excludes `*.test.ts`) |
| Compiled CLI untested after build | `tests/compiled-cli.smoke.test.ts` spawns `node dist/bin/hotspot-scanner.js` — requires `pnpm build` before `pnpm test` |

## Git Change Miner (`src/git/`)

**Risk:** Incorrect parsing distorts churn for all downstream scores.

| Concern                                                           | Mitigation                                                                                                                                                                                                                          |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Streaming parse must not load full log into memory                | Line-by-line processing; test with large fixture                                                                                                                                                                                    |
| Rename handling (`old => new` + `PathAliasMap`; **not** `--follow`) | Global `git log --numstat` has no per-file follow; find-renames (`-M`); parse rename lines, `link()` chains, `canonicalize*()` at end; `rename-multi.txt` + `with-renames` fixtures; ambiguous paths warn |
| Rename blind spots (copy-paste, pre-`--since`, no `old => new`)   | `src/git/rename-warnings.ts` — unlinked delete+add heuristic, heuristic `PathAliasMap.link()`; `--since`+rename-link truncation warning; fixtures `rename-unlinked.txt`, `rename-since-truncation.txt` |
| Merge commits, deletes, numstat edge cases                        | Fixture coverage in `tests/fixtures/git-log/`                                                                                                                                                                                       |
| Per-file history (`--follow`) for trend only                        | `src/git/file-history.ts` — **must not** add `--follow` to scan numstat `buildGitLogArgv`; trend reads historical blobs via `git show`                                                                                              |
| Function-level churn via `git log -p`                               | **Not used** — file-level hotspots only; do not reintroduce a patch-stream / function-churn miner without a feature spec                                                                                                            |

## Complexity trend (`src/trend/`)

**Risk:** Confusion with scan NCLOC or false cliffs from mass reformatting.

| Concern | Mitigation |
| ------- | ---------- |
| Scan uses working-tree NCLOC only | Trend reads historical blobs; documented in ARCHITECTURE + README drill-down |
| Indentation proxy vs AST | Tornhill whitespace rules in `analyzeIndentation`; no ts-morph |
| Prettier / mass-indent cliffs | One-shot format commits can spike `indentMean` → false **deteriorating** or **refactored** `growthPattern`; no formatter detector yet — warn in recipes/README; treat Pattern + sparklines as indicative |
| Growth-pattern false cliffs | `classifyGrowthPattern` thresholds (`REFACTOR_DROP`, `DETERIORATE_RISE`, `MIN_POINTS`) are locked constants — unit tests in `classify.test.ts`; do not special-case blame/format commits without a new feature spec |
| Trend JSON vs scan `3.0` | Separate `schemas/complexity-trend.json` (`version: "3.0"`); `kind: complexity-trend`; required `meta.growthPattern` |

## Hotspot assess (`src/assess/`)

**Risk:** Batch trend cost on large candidate sets; false cliffs inherited from the trend growth-pattern classifier.

| Concern | Mitigation |
| ------- | ---------- |
| N× sequential `runComplexityTrend` after full scan | Document cost in README/recipes/ARCHITECTURE — scan time + per-candidate trend; no parallel pool in MVP; operator caps with `--top` and `--min-hotspot-score` |
| Prettier / mass-indent cliffs on assess rows | Same `classifyGrowthPattern` as `trend`; false **deteriorating** possible — warn in recipes/README; no formatter detector yet |
| Schema isolation | `schemas/hotspot-assess.json` (`version: "1.0"`, `kind: "hotspot-assess"`); no trend `points` on candidates; scan `3.0` and complexity-trend `3.0` unchanged |
| Per-file trend failure mid-batch | Soft-continue — `skipped` / `error` candidate row; exit `0` unless usage/cancel |

## Size analyzer / NCLOC (`src/complexity/`)

**Risk:** NCLOC miscounts (RT-005) silently change rankings — comment/string edge cases. Do not reintroduce McCabe, ts-morph, or `PARSE_FAILED` stubs without a feature spec.

| Concern                                                     | Mitigation                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NCLOC definition: blank lines, comment-only lines excluded | Document in `ncloc.ts`; fixture per construct under `tests/fixtures/complexity/` (or co-located `ncloc.test.ts` cases)                                                                                                                                                            |
| Line comments `//`, block comments `/* */`, JSDoc           | State machine modes; fixture matrix mandatory                                                                                                                                                                                                                                       |
| Code + trailing `//` on same line                           | Counts as one NCLOC line                                                                                                                                                                                                                                                            |
| `//` inside strings/templates                               | Line still counts when it contains code characters outside comment/string modes                                                                                                                                                                                                     |
| Unreadable source file (I/O error)                          | `READ_FAILED` `ScanWarning` in `meta.warnings`; file **omitted** from hotspots (no stub row)                                                                                                                                                                                        |
| Worker pool / concurrency                                   | Equivalence tests inline vs worker paths; `DEFAULT_WORKER_CONCURRENCY` cap documented                                                                                                                                                                                               |

## Scoring (`src/scoring/`)

**Risk:** Normalization or formula changes silently reorder rankings.

| Concern                                                                           | Mitigation                                                                                                                              |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `hotspotScore = 2ch / (c + h)` (harmonic mean; `c` = normalized NCLOC)            | Unit tests with fixed inputs and expected order                                                                                         |
| Normalization strategy (log1p + min-max)                                          | Document in code; test edge cases (all zeros, single file)                                                                              |
| Scores are **scan-relative**                                                      | Not comparable across scans without external diff tooling                                                                 |

## Performance (cross-cutting)

**Risk RT-001:** Large repos exhaust memory or time.

- **Pipeline overlap:** numstat ∥ NCLOC by default — higher peak RSS than sequential; `--sequential` / `--no-overlap` opt-out
- **Bench harness:** `pnpm bench` outside `pnpm test` / CI
- **Overlap abort:** sibling `AbortSignal` on git spawn and worker pool
- **User cancel:** `SIGINT`/`SIGTERM` → exit `130`/`143`; no report on cancel
- Git: single streaming `git log --numstat` pass
- Size analysis: batch file reads with worker pool; discovery prefers `git ls-files`

## Diagnostics (`meta.warnings`)

| Concern | Mitigation |
| ------- | ---------- |
| Severity vs exit code | Document: successful scan exits `0` with warnings |
| Warnings shape | No compare warnings shape; scan `meta.warnings` is `ScanWarning[]`; contract tests |
| Warning code stability | Stable codes — README / ARCHITECTURE / [`docs/warning-codes.md`](../../docs/warning-codes.md) |

## Scan-result parse (`src/scan-result/`)

**Risk:** Invalid programmatic JSON acceptance or false rejects break library consumers.

| Concern | Mitigation |
| ------- | ---------- |
| `parseScanResult` contract | Co-located `parse-scan-result.test.ts`; rejects pre-3.0 and legacy hotspot fields |
| Error surface | `ScanResultParseError` with scan-oriented hint (no baseline wording) |

## Hooks enforcement

Edits to `src/git/`, `src/complexity/`, `src/scoring/`, `src/scan.ts`, `src/scan-result/`, `src/trend/`, `src/assess/`, or `schemas/` require corresponding tests before marking tasks Complete. Cursor fragile-area globs cover git/complexity/scoring/scan/scan-result/schemas — treat trend/assess as equally sensitive even when hook globs lag.

## Unmitigated — risk × effort

| Item | Risk | Effort | Path | Backlog |
| ---- | ---- | ------ | ---- | ------- |
| Post-rename path churn split (true fix) | M | A | Historical AST — **do not prioritize**; heuristic rename warnings already cover partial cases | Deferred |

**Maintenance:** when an item gains product mitigation, move it into the matching Concern|Mitigation table above and remove from this matrix.
