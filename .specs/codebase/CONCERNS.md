# CONCERNS — @vitals/hotspot-scanner

Fragile areas requiring extra care and test coverage. Enforced by [`.cursor/rules/fragile-areas.mdc`](../../.cursor/rules/fragile-areas.mdc) and edit hooks.

## Git Change Miner (`src/git/`)

**Risk:** Incorrect parsing distorts churn for all downstream scores.

| Concern                                                           | Mitigation                                                                                                                                                                                                                          |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Streaming parse must not load full log into memory                | Line-by-line processing; test with large fixture                                                                                                                                                                                    |
| Rename handling (`old => new` + `PathAliasMap`; **not** `--follow`) | Global `git log --numstat` has no per-file follow; find-renames (`-M`); parse rename lines, `link()` chains, `canonicalize*()` at end; `rename-multi.txt` + `with-renames` fixtures; ambiguous paths warn |
| Rename blind spots (copy-paste, pre-`--since`, no `old => new`)   | M26 + M50: `src/git/rename-warnings.ts` — unlinked delete+add heuristic, heuristic `PathAliasMap.link()`; `--since`+rename-link truncation warning; fixtures `rename-unlinked.txt`, `rename-since-truncation.txt` |
| Merge commits, deletes, numstat edge cases                        | Fixture coverage in `tests/fixtures/git-log/`                                                                                                                                                                                       |

## Size analyzer / NCLOC (`src/complexity/`)

**Risk:** NCLOC miscounts (RT-005) silently change rankings — comment/string edge cases.

| Concern                                                     | Mitigation                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NCLOC definition: blank lines, comment-only lines excluded | Document in `ncloc.ts`; fixture per construct under `tests/fixtures/complexity/` (or co-located `ncloc.test.ts` cases)                                                                                                                                                            |
| Line comments `//`, block comments `/* */`, JSDoc           | State machine modes; fixture matrix mandatory                                                                                                                                                                                                                                       |
| Code + trailing `//` on same line                           | Counts as one NCLOC line                                                                                                                                                                                                                                                            |
| `//` inside strings/templates                               | Line still counts when it contains code characters outside comment/string modes                                                                                                                                                                                                     |
| Unreadable source file (I/O error)                          | `READ_FAILED` `ScanWarning` in `meta.warnings`; file **omitted** from hotspots (no stub row)                                                                                                                                                                                        |
| Worker pool / concurrency                                   | Equivalence tests inline vs worker paths; `DEFAULT_WORKER_CONCURRENCY` cap documented                                                                                                                                                                                               |

**Historical (superseded M57):** McCabe decision nodes, ts-morph parse gating, `PARSE_FAILED` stubs — retired; see Done specs under `.specs/features/complexity-analyzer/`, `function-granularity/`, etc.

## Scoring (`src/scoring/`)

**Risk:** Normalization or formula changes silently reorder rankings.

| Concern                                                                           | Mitigation                                                                                                                              |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `hotspotScore = 2ch / (c + h)` (harmonic mean; `c` = normalized NCLOC)            | Unit tests with fixed inputs and expected order                                                                                         |
| Normalization strategy (log1p + min-max)                                          | Document in code; test edge cases (all zeros, single file)                                                                              |
| Scores are **scan-relative**                                                      | Not comparable across scans without external diff tooling                                                                 |

## Performance (cross-cutting)

**Risk RT-001:** Large repos exhaust memory or time.

- **Pipeline overlap (M34):** file-mode numstat ∥ NCLOC by default — higher peak RSS than sequential; `--sequential` / `--no-overlap` opt-out (M49)
- **Bench harness (M49):** `pnpm bench` outside `pnpm test` / CI
- **Overlap abort:** sibling `AbortSignal` on git spawn and worker pool
- **User cancel (M51):** `SIGINT`/`SIGTERM` → exit `130`/`143`; no report on cancel
- Git: single streaming `git log --numstat` pass
- Size analysis: batch file reads with worker pool; discovery prefers `git ls-files` (M36)

## Diagnostics (`meta.warnings`, M28)

| Concern | Mitigation |
| ------- | ---------- |
| Severity vs exit code | Document: successful scan exits `0` with warnings |
| Compare `meta.warnings` shape | N/A — compare removed M71; scan `meta.warnings` is `ScanWarning[]`; contract tests |
| Warning code stability | `EMPTY_SINCE_WINDOW`, `RENAME_HISTORY_INCOMPLETE`, `READ_FAILED`, `MONOREPO_PATH_REMOUNT`, `UNKNOWN_CONFIG_KEY` — README / ARCHITECTURE / `docs/warning-codes.md` |

## Scan-result parse (`src/scan-result/`)

**Risk:** Invalid programmatic JSON acceptance or false rejects break library consumers.

| Concern | Mitigation |
| ------- | ---------- |
| `parseScanResult` contract | Co-located `parse-scan-result.test.ts`; rejects pre-3.0 and legacy hotspot fields |
| Error surface | `ScanResultParseError` with scan-oriented hint (no baseline wording) |

## Hooks enforcement

Edits to `src/git/`, `src/complexity/`, `src/scoring/`, `src/scan.ts`, `src/scan-result/`, or `schemas/` trigger fragile-area warnings. Tests must be updated before marking tasks Complete.

## Unmitigated — risk × effort

| Item | Risco | Esforço | Caminho | Backlog |
| ---- | ----- | ------- | ------- | ------- |
| Post-rename path churn split (true fix) | M | A | Historical AST — **do not prioritize**; M26 avisos shipped | Deferred |

**Maintenance:** when an item gains product mitigation, move it into the matching Concern|Mitigation table above and remove from this matrix.
